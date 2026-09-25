import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, XCircle, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { QueueDebtor } from './ReminderQueue'
import type { BatchProgress, BatchDone } from '@/lib/api'

const MIN_DELAY_SEC = 10
const MAX_DELAY_SEC = 30

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
  const { t } = useTranslation()
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

  function cancel(): void {
    void window.api.whatsapp.cancelBatch()
  }

  return (
    <Modal open onClose={done ? onClose : cancel} title={t('reminders.autoSendTitle')}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {t('reminders.queueProgress', { current: Math.min(sentCount + 1, debtors.length), total: debtors.length })}
          </span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(sentCount / debtors.length) * 100}%` }}
            />
          </div>
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {debtors.map((d, i) => {
            const result = results[i]
            return (
              <li
                key={d.client_id}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="truncate">{d.name}</span>
                {result === true ? (
                  <CircleCheck className="size-4 shrink-0 text-primary" />
                ) : result === false ? (
                  <XCircle className="size-4 shrink-0 text-destructive" />
                ) : i === sentCount && !done ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
              </li>
            )
          })}
        </ul>

        {done ? (
          <p className="text-sm text-muted-foreground">
            {done.cancelled
              ? t('reminders.autoSendCancelled', { ok: done.sentOk, total: done.total })
              : t('reminders.autoSendDone', { ok: done.sentOk, fail: done.sentFail })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('reminders.autoSendDelayHint')}</p>
        )}

        <div className="flex justify-end gap-2">
          {done ? (
            <Button onClick={onClose}>{t('reminders.close')}</Button>
          ) : (
            <Button variant="outline" onClick={cancel}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
