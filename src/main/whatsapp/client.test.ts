import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

type Handler = (u: Record<string, unknown>) => void

const h = vi.hoisted(() => {
  class FakeSock {
    handlers = new Map<string, Handler[]>()
    user: { id: string } | undefined = undefined
    end = vi.fn()
    logout = vi.fn(async () => {})
    sendMessage = vi.fn(async () => ({}))
    ev = {
      on: (event: string, fn: Handler): void => {
        this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn])
      }
    }
    emit(event: string, payload: Record<string, unknown>): void {
      for (const fn of this.handlers.get(event) ?? []) fn(payload)
    }
    open(id = '998901234567:5@s.whatsapp.net'): void {
      this.user = { id }
      this.emit('connection.update', { connection: 'open' })
    }
    close(statusCode?: number): void {
      this.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode } } }
      })
    }
  }
  return { dir: '', sockets: [] as FakeSock[], FakeSock, throwOnCreate: false }
})

vi.mock('electron', () => ({ app: { getPath: () => h.dir } }))
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:qr' } }))
vi.mock('@whiskeysockets/baileys', async () => {
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
  const path = await vi.importActual<typeof import('node:path')>('node:path')
  return {
    default: () => {
      if (h.throwOnCreate) throw new Error('corrupt creds')
      const s = new h.FakeSock()
      h.sockets.push(s)
      return s
    },
    useMultiFileAuthState: async (dir: string) => {
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, 'creds.json')
      // Like Baileys: an unreadable creds file is treated as fresh creds.
      let creds: Record<string, unknown> = { registered: false }
      try {
        creds = JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch {
        creds = { registered: false }
      }
      return { state: { creds }, saveCreds: () => {} }
    },
    DisconnectReason: { loggedOut: 401, badSession: 500, multideviceMismatch: 411 }
  }
})

const LOGGED_OUT = 401
const CONNECTION_LOST = 408

/** Let the dynamic import + async auth-state setup inside connectWa settle.
 *  Generous on purpose: a cold mocked import can take dozens of ticks, and a
 *  too-short flush makes "no socket was created" assertions pass vacuously. */
async function flush(): Promise<void> {
  for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r))
}

function sessionDir(): string {
  return join(h.dir, 'whatsapp-session')
}

/** linked=true mirrors what a real QR scan leaves behind in Baileys 6.7:
 *  `me` is set but `registered` stays false (only the pairing-code flow sets it). */
function writeSession(linked: boolean): void {
  mkdirSync(sessionDir(), { recursive: true })
  const creds = linked
    ? { registered: false, me: { id: '998901234567:5@s.whatsapp.net' } }
    : { registered: false }
  writeFileSync(join(sessionDir(), 'creds.json'), JSON.stringify(creds))
}

async function load(): Promise<typeof import('./client')> {
  vi.resetModules()
  return import('./client')
}

beforeEach(() => {
  h.dir = mkdtempSync(join(tmpdir(), 'wa-test-'))
  h.sockets.length = 0
  h.throwOnCreate = false
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(h.dir, { recursive: true, force: true })
})

describe('autoConnectWa (app launch)', () => {
  it('does nothing when no session was ever linked', async () => {
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    expect(h.sockets).toHaveLength(0)
    expect(wa.getStatus()).toMatchObject({ connected: false, connecting: false, error: null })
  })

  it('does nothing for a session that never finished a QR scan (no me)', async () => {
    writeSession(false)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    expect(h.sockets).toHaveLength(0)
  })

  it('does nothing for an unreadable creds file', async () => {
    mkdirSync(sessionDir(), { recursive: true })
    writeFileSync(join(sessionDir(), 'creds.json'), '{not json')
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    expect(h.sockets).toHaveLength(0)
  })

  it('silently resumes a linked session and reports connected', async () => {
    writeSession(true)
    const wa = await load()
    const statuses: { connected: boolean }[] = []
    wa.onWaEvents({ status: (s) => statuses.push(s) })
    wa.autoConnectWa()
    await flush()
    expect(h.sockets).toHaveLength(1)
    expect(wa.getStatus().connecting).toBe(true)
    h.sockets[0].open()
    expect(wa.getStatus()).toMatchObject({ connected: true, phone: '998901234567', error: null })
    expect(statuses.at(-1)?.connected).toBe(true)
  })
})

describe('QR-linked session (regression: registered stays false after a QR scan)', () => {
  it('a manual Connect resumes it instead of wiping it', async () => {
    writeSession(true)
    const wa = await load()
    void wa.connectWa()
    await flush()
    expect(existsSync(join(sessionDir(), 'creds.json'))).toBe(true)
    expect(h.sockets).toHaveLength(1)
    h.sockets[0].open()
    expect(wa.getStatus()).toMatchObject({ connected: true })
  })
})

describe('linked session drops (offline / network loss)', () => {
  it('keeps retrying with backoff, warns (without wiping) after 5 failures, and recovers', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()

    // Seven drops in a row — the old cap of 3 would have shown "connection_failed".
    for (let i = 0; i < 7; i++) {
      h.sockets.at(-1)!.close(undefined) // offline and a corrupt session look identical
      expect(wa.getStatus()).toMatchObject({
        connected: false,
        connecting: true,
        error: i + 1 >= 5 ? 'reconnecting_slow' : null
      })
      const before = h.sockets.length
      // No immediate hammering — waits before retrying.
      await flush()
      expect(h.sockets).toHaveLength(before)
      await vi.advanceTimersByTimeAsync(Math.min(60_000, 2_000 * 2 ** i))
      await flush()
      expect(h.sockets).toHaveLength(before + 1)
    }
    expect(existsSync(join(sessionDir(), 'creds.json'))).toBe(true)

    // Network back → connected, warning cleared.
    h.sockets.at(-1)!.open()
    expect(wa.getStatus()).toMatchObject({ connected: true, error: null })
  })

  it('logout during a pending retry cancels it', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    h.sockets[0].close(CONNECTION_LOST)
    await wa.logoutWa()
    await vi.advanceTimersByTimeAsync(120_000)
    await flush()
    expect(h.sockets).toHaveLength(1)
    expect(wa.getStatus()).toMatchObject({ connected: false, connecting: false })
  })
})

describe('unlinked from the phone', () => {
  it('wipes the dead session, shows logged_out, and does not retry', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    h.sockets[0].open()
    h.sockets[0].close(LOGGED_OUT)
    expect(wa.getStatus()).toMatchObject({ connected: false, connecting: false, error: 'logged_out' })
    expect(existsSync(sessionDir())).toBe(false)
    await vi.advanceTimersByTimeAsync(120_000)
    await flush()
    expect(h.sockets).toHaveLength(1)
  })

  it.each([
    ['badSession', 500],
    ['multideviceMismatch', 411]
  ])('treats %s as a dead session too', async (_name, code) => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    h.sockets[0].close(code)
    expect(wa.getStatus()).toMatchObject({ connecting: false, error: 'logged_out' })
    expect(existsSync(sessionDir())).toBe(false)
  })

  it('a fresh connect after logged_out starts clean (QR pairing path)', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    h.sockets[0].close(LOGGED_OUT)
    void wa.connectWa()
    await flush()
    expect(h.sockets).toHaveLength(2)
    expect(wa.getStatus()).toMatchObject({ connecting: true, error: null })
  })
})

describe('corrupt linked session', () => {
  it('a setup crash surfaces an error instead of retrying forever', async () => {
    writeSession(true)
    h.throwOnCreate = true
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    expect(wa.getStatus()).toMatchObject({ connected: false, connecting: false, error: 'corrupt creds' })
    h.throwOnCreate = false
    await vi.advanceTimersByTimeAsync(120_000)
    await flush()
    expect(h.sockets).toHaveLength(0)
  })
})

describe('connect timeout', () => {
  it('closes the half-open socket and allows a new attempt', async () => {
    const wa = await load()
    void wa.connectWa()
    await flush()
    await vi.advanceTimersByTimeAsync(25_000)
    expect(h.sockets[0].end).toHaveBeenCalled()
    expect(wa.getStatus()).toMatchObject({ connecting: false, error: 'timeout' })

    // The ended socket's late close event must not trigger a retry.
    h.sockets[0].close(CONNECTION_LOST)
    await vi.advanceTimersByTimeAsync(60_000)
    await flush()
    expect(h.sockets).toHaveLength(1)

    void wa.connectWa()
    await flush()
    expect(h.sockets).toHaveLength(2)
  })

  it('a linked session that times out retries instead of erroring', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    await vi.advanceTimersByTimeAsync(25_000)
    expect(h.sockets[0].end).toHaveBeenCalled()
    expect(wa.getStatus()).toMatchObject({ connecting: true, error: null })
    await vi.advanceTimersByTimeAsync(2_000)
    await flush()
    expect(h.sockets).toHaveLength(2)
  })
})

describe('first-time pairing (no linked session)', () => {
  it('still gives up after 3 consecutive failures with connection_failed', async () => {
    const wa = await load()
    void wa.connectWa()
    await flush()
    for (let i = 0; i < 3; i++) {
      h.sockets.at(-1)!.emit('connection.update', { connection: 'connecting' })
      h.sockets.at(-1)!.close(CONNECTION_LOST)
      await flush()
    }
    expect(wa.getStatus()).toMatchObject({ connected: false, connecting: false, error: 'connection_failed' })
  })
})

describe('sendOne', () => {
  it('reports not_connected when offline, ok when connected', async () => {
    writeSession(true)
    const wa = await load()
    const item = { phone: '+998 90 123', message: 'hi', name: 'Ali' }
    expect(await wa.sendOne(item)).toEqual({ ok: false, error: 'not_connected' })
    wa.autoConnectWa()
    await flush()
    h.sockets[0].open()
    expect(await wa.sendOne(item)).toEqual({ ok: true })
    expect(h.sockets[0].sendMessage).toHaveBeenCalledWith('99890123@s.whatsapp.net', { text: 'hi' })
  })

  it('reports the send error', async () => {
    writeSession(true)
    const wa = await load()
    wa.autoConnectWa()
    await flush()
    h.sockets[0].open()
    h.sockets[0].sendMessage.mockRejectedValueOnce(new Error('boom'))
    expect(await wa.sendOne({ phone: '1234', message: 'x', name: 'y' })).toEqual({
      ok: false,
      error: 'boom'
    })
  })
})
