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

export type WaStatus = { connected: boolean; phone: string | null; connecting: boolean }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sock: any = null
let connecting = false
let connectedPhone: string | null = null
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
  return { connected: !!connectedPhone, phone: connectedPhone, connecting }
}

export async function connectWa(): Promise<void> {
  if (sock || connecting) return
  connecting = true
  listeners.status(getStatus())

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
  } = await import('@whiskeysockets/baileys')
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir())

  sock = makeWASocket({ auth: state, printQRInTerminal: false })
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update: Record<string, unknown>) => {
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
      connectedPhone = cleanPhone(sock.user?.id)
      listeners.status(getStatus())
    }

    if (connection === 'close') {
      connecting = false
      connectedPhone = null
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      sock = null
      listeners.status(getStatus())
      if (!loggedOut) {
        // Transient disconnect (network, server restart) — try again.
        void connectWa()
      }
    }
  })
}

export async function logoutWa(): Promise<void> {
  if (sock) {
    await sock.logout().catch(() => {})
    sock = null
  }
  connecting = false
  connectedPhone = null
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
