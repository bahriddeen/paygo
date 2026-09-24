import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, SkipForward, CircleCheck } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatMoney, type CurrencyCode } from '@/lib/format'

export interface QueueDebtor {
  client_id: number
  name: string
  phone: string
  amounts: { currency: CurrencyCode; amount: number }[]
  maxDays: number
  message: string
}

/**
 * Sends reminders one debtor at a time instead of opening every chat at once.
 * The user opens a chat, sends it in WhatsApp, then advances to the next.
 */
export function ReminderQueue({
  debtors,
  onClose
}: {
  debtors: QueueDebtor[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const done = index >= debtors.length
  const current = debtors[index]

  const amountsStr = (d: QueueDebtor): string =>
    d.amounts.map((a) => formatMoney(a.amount, a.currency)).join(', ')

  const openAndNext = (): void => {
    if (current) void window.api.whatsapp.open(current.phone, current.message)
    setIndex((i) => i + 1)
  }

  return (
    <Modal open onClose={onClose} title={t('reminders.queueTitle')}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
            <CircleCheck className="size-6" />
          </span>
          <p className="text-sm font-medium">{t('reminders.queueDone')}</p>
          <Button variant="outline" onClick={onClose}>
            {t('reminders.close')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('reminders.queueProgress', { current: index + 1, total: debtors.length })}
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(index / debtors.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-base font-semibold">{current.name}</p>
            <p className="text-sm text-muted-foreground">{current.phone}</p>
            <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-destructive">
              {amountsStr(current)}
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {current.message}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>
              <SkipForward className="size-4" />
              {t('reminders.skip')}
            </Button>
            <Button onClick={openAndNext}>
              <MessageCircle className="size-4" />
              {t('reminders.openAndNext')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
