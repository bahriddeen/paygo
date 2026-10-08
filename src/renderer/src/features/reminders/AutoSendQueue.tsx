import { useEffect, useRef, useState } from 'react'
import { BatchProgressModal } from './BatchProgressModal'
import type { QueueDebtor } from './ReminderQueue'
import type { BatchProgress, BatchDone } from '@/lib/api'

/** Ban-risk mitigation delay between sends — shared with ScheduledReminderRunner. */
export const MIN_DELAY_SEC = 20
export const MAX_DELAY_SEC = 60

/**
 * Auto-sends the queue via the linked WhatsApp connection (Baileys), one
 * message at a time with a randomized delay between sends. Shown instead of
 * the manual ReminderQueue when WhatsApp is connected — see
 * src/main/whatsapp/client.ts for why the delay exists (ban-risk mitigation,
 * not a UX choice).
 */
export function AutoSendQueue({
  debtors,
  onClose
}: {
  debtors: QueueDebtor[]
  onClose: () => void
}) {
  const [results, setResults] = useState<(boolean | null)[]>(() => debtors.map(() => null))
  const [sentCount, setSentCount] = useState(0)
  const [done, setDone] = useState<BatchDone | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const offProgress = window.api.whatsapp.onBatchProgress((p: BatchProgress) => {
      setResults((prev) => {
        const next = [...prev]
        next[p.sent - 1] = p.ok
        return next
      })
      setSentCount(p.sent)
    })
    const offDone = window.api.whatsapp.onBatchDone((d: BatchDone) => setDone(d))
    return () => {
      offProgress()
      offDone()
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void window.api.whatsapp.sendBatch(
      debtors.map((d) => ({ phone: d.phone, message: d.message, name: d.name })),
      MIN_DELAY_SEC,
      MAX_DELAY_SEC
    )
  }, [debtors])

  return (
    <BatchProgressModal
      items={debtors.map((d) => ({ key: d.client_id, name: d.name }))}
      results={results}
      sent={sentCount}
      total={debtors.length}
      done={done !== null}
      cancelled={done?.cancelled ?? false}
      sentOk={done?.sentOk ?? 0}
      sentFail={done?.sentFail ?? 0}
      onCancel={() => void window.api.whatsapp.cancelBatch()}
      onClose={onClose}
    />
  )
}
