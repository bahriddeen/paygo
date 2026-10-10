import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CURRENCIES, formatMoney, toMinor, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateTimeInputToUnix, unixToDateInput, unixToTimeInput } from '@/lib/date'
import type { Payment, PaymentPatchInput, PaymentWithTransaction } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function PaymentEditForm({
  payment,
  currency,
  maxAmount,
  onSubmit,
  onCancel,
  pending
}: {
  payment: Payment | PaymentWithTransaction
  currency: CurrencyCode
  /** Highest amount this payment can be corrected to — omitted when the caller
   *  doesn't have the parent transaction's remaining at hand; the server still
   *  enforces the real limit either way. */
  maxAmount?: number
  onSubmit: (patch: PaymentPatchInput) => void
  onCancel: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(
    String(payment.amount / 10 ** CURRENCIES[currency].decimals)
  )
  const [method, setMethod] = useState(payment.method ?? 'cash')
  const [date, setDate] = useState(unixToDateInput(payment.paid_at))
  const [time, setTime] = useState(unixToTimeInput(payment.paid_at))
  const [note, setNote] = useState(payment.note ?? '')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('tx.paymentAmount'))
      return
    }
    const minor = toMinor(value, currency)
    if (maxAmount !== undefined && minor > maxAmount) {
      setError(t('tx.amountExceedsRemaining'))
      return
    }
    onSubmit({
      amount: minor,
      method,
      note: note.trim() || null,
      paid_at: dateTimeInputToUnix(date, time)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {maxAmount !== undefined ? (
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('tx.remaining')}</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatMoney(maxAmount, currency)}
          </span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="epay-amount">{t('tx.paymentAmount')}</Label>
        <Input
          id="epay-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="epay-method">{t('tx.method')}</Label>
        <select
          id="epay-method"
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
          <Label htmlFor="epay-date">{t('tx.date')}</Label>
          <Input id="epay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="epay-time">{t('tx.time')}</Label>
          <Input id="epay-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="epay-note">{t('tx.note')}</Label>
        <Input id="epay-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
