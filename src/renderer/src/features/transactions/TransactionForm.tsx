import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { CURRENCY_CODES, toMinor, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'
import { dateInputToUnix, todayInput } from '@/lib/date'
import { useAppSettings } from '@/app/SettingsProvider'
import { useCategories, useCreateClient } from '@/lib/api'
import { PersonForm, type PersonFormValues } from '../people/PersonForm'
import type { Client, ClientKind, Direction, NewTransactionInput } from '@/lib/api'

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
  const [addingPerson, setAddingPerson] = useState(false)

  // New-person defaults to the kind implied by the current direction — a
  // debt "lent" is naturally to a client, one "borrowed" from a supplier.
  const personKind: ClientKind = direction === 'borrow' ? 'supplier' : 'client'
  const categories = useCategories(branchId, personKind)
  const createClient = useCreateClient()

  function submitNewPerson(v: PersonFormValues): void {
    createClient.mutate(
      {
        branch_id: branchId,
        kind: personKind,
        name: v.name,
        phone: v.phone || null,
        description: v.description || null,
        trust_level: v.trust_level,
        group_id: v.group_id
      },
      {
        onSuccess: (c) => {
          setClientId(String(c.id))
          setAddingPerson(false)
        }
      }
    )
  }

  if (addingPerson) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          {personKind === 'supplier' ? t('suppliers.addSupplier') : t('clients.addClient')}
        </h3>
        <PersonForm
          categories={categories.data ?? []}
          onSubmit={submitNewPerson}
          onCancel={() => setAddingPerson(false)}
          pending={createClient.isPending}
        />
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('tx.noClients')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => setAddingPerson(true)}>
            <Plus className="size-4" />
            {personKind === 'supplier' ? t('suppliers.addSupplier') : t('clients.addClient')}
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
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Combobox
              items={clients.map((c) => ({ value: String(c.id), label: c.name }))}
              value={clientId}
              onChange={setClientId}
              placeholder={t('tx.selectClient')}
              searchPlaceholder={t('clients.searchPlaceholder')}
              emptyText={t('clients.noResults')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label={personKind === 'supplier' ? t('suppliers.addSupplier') : t('clients.addClient')}
            onClick={() => setAddingPerson(true)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
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
