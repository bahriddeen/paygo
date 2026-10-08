import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CURRENCIES, CURRENCY_CODES, toMinor, formatMoney, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateInputToUnix, unixToDateInput } from '@/lib/date'
import { useTransactionLineItems } from '@/lib/api'
import { LineItemsTable, lineItemsGrandTotal, type LineItemRow } from './LineItemsTable'
import type { TransactionWithBalance, TransactionPatchInput } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function TransactionEditForm({
  transaction,
  onSubmit,
  onCancel,
  pending,
  onLineItemsChange
}: {
  transaction: TransactionWithBalance
  onSubmit: (patch: TransactionPatchInput) => void
  onCancel: () => void
  pending?: boolean
  /** Fires whenever the line-items table goes from empty to non-empty or back —
   * lets the enclosing Modal widen itself while the table is in use. */
  onLineItemsChange?: (hasLineItems: boolean) => void
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
  const [lineItems, setLineItems] = useState<LineItemRow[]>([])
  const [seeded, setSeeded] = useState(false)
  const existingLineItems = useTransactionLineItems(transaction.id)

  useEffect(() => {
    if (seeded || !existingLineItems.data) return
    if (existingLineItems.data.length > 0) {
      setLineItems(
        existingLineItems.data.map((item) => ({
          key: crypto.randomUUID(),
          product: item.product,
          quantity: String(item.quantity),
          price: String(item.unit_price / 10 ** CURRENCIES[transaction.currency].decimals)
        }))
      )
    }
    setSeeded(true)
  }, [seeded, existingLineItems.data, transaction.currency])

  const hasLineItems = lineItems.length > 0

  useEffect(() => {
    onLineItemsChange?.(hasLineItems)
  }, [hasLineItems, onLineItemsChange])

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    setError('')

    if (hasLineItems) {
      const invalid = lineItems.some(
        (row) =>
          !row.product.trim() ||
          !Number.isFinite(parseFloat(row.quantity.replace(',', '.'))) ||
          !Number.isFinite(parseFloat(row.price.replace(',', '.')))
      )
      if (invalid) {
        setError(t('tx.amount'))
        return
      }
    }

    const minor = hasLineItems
      ? lineItemsGrandTotal(lineItems, currency)
      : toMinor(parseFloat(amount.replace(',', '.')), currency)
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t('tx.amount'))
      return
    }
    if (minor < transaction.paid) {
      setError(t('tx.amountBelowPaid'))
      return
    }
    onSubmit({
      amount: minor,
      currency,
      description: description.trim() || null,
      issued_at: dateInputToUnix(date),
      due_at: due ? dateInputToUnix(due) : null,
      line_items: hasLineItems
        ? lineItems.map((row) => ({
            product: row.product.trim(),
            quantity: parseFloat(row.quantity.replace(',', '.')),
            unit_price: toMinor(parseFloat(row.price.replace(',', '.')), currency)
          }))
        : null
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
            value={
              hasLineItems
                ? String(lineItemsGrandTotal(lineItems, currency) / 10 ** CURRENCIES[currency].decimals)
                : amount
            }
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            readOnly={hasLineItems}
            disabled={hasLineItems}
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

      <LineItemsTable currency={currency} rows={lineItems} onChange={setLineItems} />

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
