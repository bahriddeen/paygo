import { join } from 'node:path'
import { rmSync } from 'node:fs'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sock: any = null
let connecting = false
let connectedPhone: string | null = null
let lastError: string | null = null
let connectAttempt = 0
let consecutiveFailures = 0
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

function failAttempt(attemptId: number, message: string): void {
  if (attemptId !== connectAttempt) return // a newer attempt has already superseded this one
  connecting = false
  sock = null
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

  const timeout = setTimeout(() => {
    if (gotFirstEvent) return // a real signal already arrived; let Baileys' own protocol handle it
    failAttempt(attemptId, 'timeout')
  }, CONNECT_TIMEOUT_MS)

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason
    } = await import('@whiskeysockets/baileys')

    let { state, saveCreds } = await useMultiFileAuthState(sessionDir())
    if (!opts.isRetry && !state.creds.registered) {
      // A half-linked session — a QR was scanned but pairing never fully
      // completed (interrupted by an earlier bug, a crash, or the phone
      // unlinking this device afterward) — leaves creds.json with
      // registered:false but the identity/keys already populated. Baileys
      // then hangs trying to resume that instead of cleanly requesting a
      // fresh QR. Never attempt to resume an unregistered session; always
      // start clean instead.
      //
      // Only on a fresh, user-initiated connect though (isRetry false) —
      // never on the internal reconnect-after-close below. That path can
      // fire mid-pairing (a transient close between scanning the QR and
      // registered flipping true is normal), and wiping there would
      // destroy the in-progress handshake the phone is actively waiting
      // on, which looks like the phone-side "Linking…" spinner hanging
      // forever.
      rmSync(sessionDir(), { recursive: true, force: true })
      ;({ state, saveCreds } = await useMultiFileAuthState(sessionDir()))
    }

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
        connecting = false
        connectedPhone = null
        sock = null
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        if (loggedOut) {
          consecutiveFailures = 0
          listeners.status(getStatus())
          return
        }
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          lastError = 'connection_failed'
          listeners.status(getStatus())
          return
        }
        listeners.status(getStatus())
        void connectWa({ isRetry: true }) // transient disconnect — try again, keep whatever session state exists
      }
    })
  } catch (err) {
    clearTimeout(timeout)
    failAttempt(attemptId, err instanceof Error ? err.message : String(err))
  }
}

export async function logoutWa(): Promise<void> {
  connectAttempt++ // supersede any in-flight connect attempt
  consecutiveFailures = 0
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

export function cancelBatch(): void {
  batchCancelled = true
}

const randomDelayMs = (minSec: number, maxSec: number): number =>
  (minSec + Math.random() * Math.max(0, maxSec - minSec)) * 1000

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

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
