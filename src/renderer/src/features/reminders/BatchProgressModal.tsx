import { useTranslation } from 'react-i18next'
import { CircleCheck, XCircle, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

export interface BatchProgressItem {
  key: number | string
  name: string
}

/**
 * Presentational list + progress bar + cancel/close for a WhatsApp auto-send
 * batch — shared by the manual "remind all" queue (AutoSendQueue, which owns
 * and starts the batch) and the recurring scheduled send (which runs from
 * ScheduledReminderStatus context since it has no page of its own to live on).
 */
export function BatchProgressModal({
  items,
  results,
  sent,
  total,
  done,
  cancelled,
  sentOk,
  sentFail,
  onCancel,
  onClose
}: {
  items: BatchProgressItem[]
  results: (boolean | null)[]
  sent: number
  total: number
  done: boolean
  cancelled: boolean
  sentOk: number
  sentFail: number
  onCancel: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <Modal open onClose={done ? onClose : onCancel} title={t('reminders.autoSendTitle')}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {t('reminders.queueProgress', { current: Math.min(sent + (done ? 0 : 1), total), total })}
          </span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border">
          {items.map((d, i) => {
            const result = results[i]
            const sending = i === sent && !done && result === null
            return (
              <li
                key={d.key}
                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <span className="truncate">{d.name}</span>
                {result === true ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
                    {t('reminders.statusSent')}
                    <CircleCheck className="size-4" />
                  </span>
                ) : result === false ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-destructive">
                    {t('reminders.statusFailed')}
                    <XCircle className="size-4" />
                  </span>
                ) : sending ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {t('reminders.statusSending')}
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('reminders.statusPending')}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {done ? (
          <p className="text-sm text-muted-foreground">
            {cancelled
              ? t('reminders.autoSendCancelled', { ok: sentOk, total })
              : t('reminders.autoSendDone', { ok: sentOk, fail: sentFail })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('reminders.autoSendDelayHint')}</p>
        )}

        <div className="flex justify-end gap-2">
          {done ? (
            <Button onClick={onClose}>{t('reminders.close')}</Button>
          ) : (
            <Button variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
