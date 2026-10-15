import { join } from 'node:path'
import { readFileSync, rmSync } from 'node:fs'
import { app } from 'electron'
import QRCode from 'qrcode'

/**
 * Unofficial WhatsApp Web automation (Baileys) — links the shop owner's own
 * WhatsApp as a "linked device" (same mechanism as WhatsApp Web) and can
 * then send messages without a manual click. This is explicitly against
 * WhatsApp's Terms of Service and risks the linked number being banned for
 * automated bulk messaging; it was implemented at the user's explicit,
 * informed request after being told that risk clearly. The batch sender
 * enforces a randomized delay between messages specifically to reduce (not
 * eliminate) that risk. See INFO.md before touching this module.
 */

export type WaStatus = { connected: boolean; phone: string | null; connecting: boolean; error: string | null }
export type BatchItem = { phone: string; message: string; name: string }
export type BatchProgress = {
  sent: number
  total: number
  name: string
  phone: string
  ok: boolean
  error?: string
}
export type BatchDone = { sentOk: number; sentFail: number; total: number; cancelled: boolean }

type Listeners = {
  qr: (dataUrl: string) => void
  status: (status: WaStatus) => void
  progress: (p: BatchProgress) => void
  done: (d: BatchDone) => void
}

const CONNECT_TIMEOUT_MS = 25_000
const MAX_CONSECUTIVE_FAILURES = 3
// Backoff for reconnecting an already-linked session: 2s, 4s, 8s … capped.
const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 60_000
// After this many failed resumes in a row, keep retrying but tell the user —
// a corrupt session fails with the same (undefined) close code as being
// offline, so only the user can tell which it is.
const RESUME_WARN_AFTER = 5

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sock: any = null
let connecting = false
let connectedPhone: string | null = null
let lastError: string | null = null
let connectAttempt = 0
let consecutiveFailures = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let batchCancelled = false
let batchRunning = false

const listeners: Listeners = {
  qr: () => {},
  status: () => {},
  progress: () => {},
  done: () => {}
}

export function onWaEvents(l: Partial<Listeners>): void {
  Object.assign(listeners, l)
}

function sessionDir(): string {
  return join(app.getPath('userData'), 'whatsapp-session')
}

function cleanPhone(id: string | undefined): string | null {
  if (!id) return null
  return id.split(':')[0].split('@')[0]
}

export function getStatus(): WaStatus {
  return { connected: !!connectedPhone, phone: connectedPhone, connecting, error: lastError }
}

/**
 * A session is linked once WhatsApp has assigned this device an identity
 * (`creds.me`) — that's what Baileys itself checks to choose "log in" over
 * "show a QR" (socket.js). NOT `creds.registered`: in Baileys 6.7 that flag
 * is only set by the pairing-code flow and stays false after a QR scan, so
 * checking it treated every QR-linked session as unlinked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLinked(creds: any): boolean {
  return typeof creds?.me?.id === 'string' && creds.me.id.length > 0
}

/** True when a linked session is saved on disk. */
function hasLinkedSession(): boolean {
  try {
    return isLinked(JSON.parse(readFileSync(join(sessionDir(), 'creds.json'), 'utf8')))
  } catch {
    return false
  }
}

/**
 * Called once on app launch. The session survives restarts on disk, but the
 * socket doesn't — without this the app looked "disconnected" after every
 * reopen until the user found Settings → Connect. Only resumes a linked
 * session; never starts QR pairing on its own.
 */
export function autoConnectWa(): void {
  if (hasLinkedSession()) void connectWa()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function endSocket(s: any): void {
  try {
    s?.end?.(undefined)
  } catch {
    // already closed
  }
}

/**
 * A linked session that drops (offline at launch, network blip, WhatsApp
 * server restart) is still valid — keep retrying with backoff and never
 * surface an error, since the error UI's only action is "Reset", which
 * would delete a perfectly good session.
 */
function scheduleResumeRetry(): void {
  consecutiveFailures++
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (consecutiveFailures - 1))
  connecting = true
  lastError = consecutiveFailures >= RESUME_WARN_AFTER ? 'reconnecting_slow' : null
  listeners.status(getStatus())
  retryTimer = setTimeout(() => {
    retryTimer = null
    connecting = false
    void connectWa({ isRetry: true })
  }, delay)
}

function failAttempt(attemptId: number, message: string, resumed: boolean): void {
  if (attemptId !== connectAttempt) return // a newer attempt has already superseded this one
  connectAttempt++ // so the socket we're about to end can't fire this attempt's close handler
  const dead = sock
  sock = null
  connectedPhone = null
  endSocket(dead)
  if (resumed) {
    scheduleResumeRetry()
    return
  }
  connecting = false
  lastError = message
  listeners.status(getStatus())
}

export async function connectWa(opts: { isRetry?: boolean } = {}): Promise<void> {
  if (sock || connecting) return
  connecting = true
  lastError = null
  listeners.status(getStatus())

  const attemptId = ++connectAttempt
  let gotFirstEvent = false
  let resumed = false

  const timeout = setTimeout(() => {
    if (gotFirstEvent) return // a real signal already arrived; let Baileys' own protocol handle it
    failAttempt(attemptId, 'timeout', resumed)
  }, CONNECT_TIMEOUT_MS)

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason
    } = await import('@whiskeysockets/baileys')

    let { state, saveCreds } = await useMultiFileAuthState(sessionDir())
    if (!opts.isRetry && !isLinked(state.creds)) {
      // Never linked (no QR scan ever completed): leftover creds from an
      // abandoned or interrupted pairing can make Baileys hang instead of
      // cleanly showing a fresh QR, so start clean. Nothing of value is lost —
      // there's no linked identity here yet.
      //
      // Only on a fresh, user-initiated connect though (isRetry false) —
      // never on the internal reconnect-after-close below. That path can
      // fire mid-pairing (a transient close right after the QR scan is
      // normal), and wiping there would destroy the in-progress handshake
      // the phone is actively waiting on, which looks like the phone-side
      // "Linking…" spinner hanging forever.
      rmSync(sessionDir(), { recursive: true, force: true })
      ;({ state, saveCreds } = await useMultiFileAuthState(sessionDir()))
    }
    resumed = isLinked(state.creds)

    if (attemptId !== connectAttempt) return // superseded while awaiting setup
    sock = makeWASocket({ auth: state, printQRInTerminal: false })
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update: Record<string, unknown>) => {
      if (attemptId !== connectAttempt) return
      gotFirstEvent = true
      clearTimeout(timeout)

      const { connection, qr, lastDisconnect } = update as {
        connection?: string
        qr?: string
        lastDisconnect?: { error?: { output?: { statusCode?: number } } }
      }

      if (qr) {
        QRCode.toDataURL(qr)
          .then((dataUrl) => listeners.qr(dataUrl))
          .catch(() => {})
      }

      if (connection === 'open') {
        connecting = false
        lastError = null
        consecutiveFailures = 0
        connectedPhone = cleanPhone(sock.user?.id)
        listeners.status(getStatus())
      }

      if (connection === 'close') {
        connectedPhone = null
        sock = null
        const statusCode = lastDisconnect?.error?.output?.statusCode
        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.badSession ||
          statusCode === DisconnectReason.multideviceMismatch
        ) {
          // The device was unlinked from the phone, or WhatsApp rejected the
          // saved session (bad/mismatched session files).
          // Those credentials can never connect again — delete them so the
          // next Connect goes straight to a fresh QR instead of hanging on a
          // dead session, and tell the user to re-link.
          connecting = false
          consecutiveFailures = 0
          rmSync(sessionDir(), { recursive: true, force: true })
          lastError = 'logged_out'
          listeners.status(getStatus())
          return
        }
        if (resumed) {
          scheduleResumeRetry()
          return
        }
        connecting = false
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          lastError = 'connection_failed'
          listeners.status(getStatus())
          return
        }
        listeners.status(getStatus())
        void connectWa({ isRetry: true }) // transient disconnect mid-pairing — try again, keep whatever session state exists
      }
    })
  } catch (err) {
    clearTimeout(timeout)
    // A throw during setup (unreadable/corrupt session files, broken module)
    // isn't a network blip — retrying can't fix it, so surface it (the
    // Reset button relinks) rather than spin silently forever. Real network
    // drops arrive as 'close' events above, not here.
    failAttempt(attemptId, err instanceof Error ? err.message : String(err), false)
  }
}

export async function logoutWa(): Promise<void> {
  connectAttempt++ // supersede any in-flight connect attempt
  consecutiveFailures = 0
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (sock) {
    await sock.logout().catch(() => {})
    sock = null
  }
  connecting = false
  connectedPhone = null
  lastError = null
  rmSync(sessionDir(), { recursive: true, force: true })
  listeners.status(getStatus())
}

let cancelSleep: (() => void) | null = null

export function cancelBatch(): void {
  batchCancelled = true
  cancelSleep?.() // wake the in-progress inter-message delay immediately instead of waiting it out
}

const randomDelayMs = (minSec: number, maxSec: number): number =>
  (minSec + Math.random() * Math.max(0, maxSec - minSec)) * 1000

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      cancelSleep = null
      resolve()
    }, ms)
    cancelSleep = () => {
      clearTimeout(timer)
      cancelSleep = null
      resolve()
    }
  })

/**
 * Sends one message outside the batch pipeline: independent of a running
 * batch (no progress/done events, so a batch UI never mistakes it for one of
 * its own items) and it reports its own result.
 */
export async function sendOne(item: BatchItem): Promise<{ ok: boolean; error?: string }> {
  if (!sock || !connectedPhone) return { ok: false, error: 'not_connected' }
  const digits = item.phone.replace(/\D/g, '')
  try {
    await sock.sendMessage(`${digits}@s.whatsapp.net`, { text: item.message })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sendBatch(
  items: BatchItem[],
  opts: { minDelaySec: number; maxDelaySec: number }
): Promise<void> {
  if (!sock || !connectedPhone) return
  if (batchRunning) return

  batchRunning = true
  batchCancelled = false
  let sentOk = 0
  let sentFail = 0

  for (let i = 0; i < items.length; i++) {
    if (batchCancelled) break
    const item = items[i]
    const digits = item.phone.replace(/\D/g, '')
    const jid = `${digits}@s.whatsapp.net`
    try {
      await sock.sendMessage(jid, { text: item.message })
      sentOk++
      listeners.progress({ sent: i + 1, total: items.length, name: item.name, phone: item.phone, ok: true })
    } catch (err) {
      sentFail++
      listeners.progress({
        sent: i + 1,
        total: items.length,
        name: item.name,
        phone: item.phone,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
    if (i < items.length - 1 && !batchCancelled) {
      await sleep(randomDelayMs(opts.minDelaySec, opts.maxDelaySec))
    }
  }

  batchRunning = false
  listeners.done({ sentOk, sentFail, total: items.length, cancelled: batchCancelled })
}
