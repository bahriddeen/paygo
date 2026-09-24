import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { CURRENCY_CODES, toMinor, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateInputToUnix, todayInput } from '@/lib/date'
import { useAppSettings } from '@/app/SettingsProvider'
import type { Client, Direction, NewTransactionInput } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function TransactionForm({
  branchId,
  clients,
  defaultDirection = 'lend',
  onSubmit,
  onCancel,
  pending
}: {
  branchId: number
  clients: Client[]
  defaultDirection?: Direction
  onSubmit: (input: NewTransactionInput) => void
  onCancel: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  const { defaultCurrency } = useAppSettings()
  const [direction, setDirection] = useState<Direction>(defaultDirection)
  const [clientId, setClientId] = useState<string>(clients[0] ? String(clients[0].id) : '')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayInput())
  const [due, setDue] = useState('')
  const [error, setError] = useState('')

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('tx.noClients')}</p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!clientId || !Number.isFinite(value) || value <= 0) {
      setError(t('tx.amount'))
      return
    }
    onSubmit({
      branch_id: branchId,
      client_id: Number(clientId),
      direction,
      amount: toMinor(value, currency),
      currency,
      description: note.trim() || null,
      issued_at: dateInputToUnix(date),
      due_at: due ? dateInputToUnix(due) : null
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Direction — green = they owe you, red = you owe */}
      <div className="grid grid-cols-2 gap-2">
        {(['lend', 'borrow'] as const).map((d) => {
          const active = direction === d
          const activeCls =
            d === 'lend'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300'
          return (
            <button
              type="button"
              key={d}
              onClick={() => setDirection(d)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                active ? activeCls : 'border-border bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              {t(`tx.${d}`)}
            </button>
          )
        })}
      </div>

      <div className="space-y-1.5">
        <Label>{t('tx.client')}</Label>
        <Combobox
          items={clients.map((c) => ({ value: String(c.id), label: c.name }))}
          value={clientId}
          onChange={setClientId}
          placeholder={t('tx.selectClient')}
          searchPlaceholder={t('clients.searchPlaceholder')}
          emptyText={t('clients.noResults')}
        />
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">{t('tx.amount')}</Label>
          <Input
            id="tx-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-currency">{t('tx.currency')}</Label>
          <select
            id="tx-currency"
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
          <Label htmlFor="tx-date">{t('tx.date')}</Label>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-due">{t('tx.dueDate')}</Label>
          <Input id="tx-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-note">{t('tx.note')}</Label>
        <Input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} />
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
