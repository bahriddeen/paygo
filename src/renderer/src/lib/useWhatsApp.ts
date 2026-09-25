import { useEffect, useState } from 'react'
import type { WaStatus } from './api'

/** Connection state for the (unofficial, opt-in) WhatsApp auto-sender. */
export function useWhatsAppConnection(): {
  status: WaStatus
  qr: string | null
  connect: () => void
  logout: () => void
} {
  const [status, setStatus] = useState<WaStatus>({
    connected: false,
    phone: null,
    connecting: false,
    error: null
  })
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    window.api.whatsapp.status().then(setStatus)
    const offStatus = window.api.whatsapp.onStatus((s) => {
      setStatus(s)
      if (s.connected || s.error) setQr(null)
    })
    const offQr = window.api.whatsapp.onQr((dataUrl) => setQr(dataUrl))
    return () => {
      offStatus()
      offQr()
    }
  }, [])

  return {
    status,
    qr,
    connect: () => {
      setQr(null)
      void window.api.whatsapp.connect()
    },
    logout: () => {
      setQr(null)
      void window.api.whatsapp.logout()
    }
  }
}
