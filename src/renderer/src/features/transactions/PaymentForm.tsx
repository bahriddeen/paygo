import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatMoney, toMinor } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateTimeInputToUnix, todayInput, nowTimeInput } from '@/lib/date'
import type { NewPaymentInput, TransactionWithBalance } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function PaymentForm({
  transaction,
  onSubmit,
  onCancel,
  pending
}: {
  transaction: TransactionWithBalance
  onSubmit: (input: NewPaymentInput) => void
  onCancel: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(todayInput())
  const [time, setTime] = useState(nowTimeInput())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('tx.paymentAmount'))
      return
    }
    const minor = toMinor(value, transaction.currency)
    if (minor > transaction.remaining) {
      setError(t('tx.amountExceedsRemaining'))
      return
    }
    onSubmit({
      transaction_id: transaction.id,
      amount: minor,
      method,
      note: note.trim() || null,
      paid_at: dateTimeInputToUnix(date, time)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">{t('tx.remaining')}</span>
        <span className="font-mono font-semibold tabular-nums">
          {formatMoney(transaction.remaining, transaction.currency)}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-amount">{t('tx.paymentAmount')}</Label>
        <Input
          id="pay-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-method">{t('tx.method')}</Label>
        <select
          id="pay-method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className={selectClass}
        >
          <option value="cash">{t('tx.methodCash')}</option>
          <option value="card">{t('tx.methodCard')}</option>
          <option value="transfer">{t('tx.methodTransfer')}</option>
        </select>
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-date">{t('tx.date')}</Label>
          <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-time">{t('tx.time')}</Label>
          <Input id="pay-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-note">{t('tx.note')}</Label>
        <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('tx.recordPayment')}
        </Button>
      </div>
    </form>
  )
}
