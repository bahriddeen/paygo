import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CURRENCIES, CURRENCY_CODES, toMinor, formatMoney, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateInputToUnix, unixToDateInput } from '@/lib/date'
import type { TransactionWithBalance, TransactionPatchInput } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function TransactionEditForm({
  transaction,
  onSubmit,
  onCancel,
  pending
}: {
  transaction: TransactionWithBalance
  onSubmit: (patch: TransactionPatchInput) => void
  onCancel: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(
    String(transaction.amount / 10 ** CURRENCIES[transaction.currency].decimals)
  )
  const [currency, setCurrency] = useState<CurrencyCode>(transaction.currency)
  const [description, setDescription] = useState(transaction.description ?? '')
  const [date, setDate] = useState(unixToDateInput(transaction.issued_at))
  const [due, setDue] = useState(transaction.due_at ? unixToDateInput(transaction.due_at) : '')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    setError('')
    const value = parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('tx.amount'))
      return
    }
    const minor = toMinor(value, currency)
    if (minor < transaction.paid) {
      setError(t('tx.amountBelowPaid'))
      return
    }
    onSubmit({
      amount: minor,
      currency,
      description: description.trim() || null,
      issued_at: dateInputToUnix(date),
      due_at: due ? dateInputToUnix(due) : null
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {transaction.paid > 0 ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('tx.settled')}: {formatMoney(transaction.paid, transaction.currency)}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="etx-amount">{t('tx.amount')}</Label>
          <Input
            id="etx-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="etx-currency">{t('tx.currency')}</Label>
          <select
            id="etx-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className={selectClass}
          >
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="etx-date">{t('tx.date')}</Label>
          <Input id="etx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="etx-due">{t('tx.dueDate')}</Label>
          <Input id="etx-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="etx-note">{t('tx.note')}</Label>
        <Input id="etx-note" value={description} onChange={(e) => setDescription(e.target.value)} />
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
