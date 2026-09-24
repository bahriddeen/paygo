import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Users, Folder } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import {
  useClients,
  useTransactions,
  useCategories,
  useCreateClient,
  useUpdateClient,
  useArchiveClient,
  type Client,
  type ClientKind
} from '@/lib/api'
import { formatMoney, type CurrencyCode } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { PersonForm, type PersonFormValues } from './PersonForm'
import { PersonDetail } from './PersonDetail'
import { CategoryManager } from './CategoryManager'
import { trustColorClass } from './TrustLevel'

type Editing = Client | null | undefined
type SortKey = 'name' | 'newest' | 'oldest' | 'debt' | 'overdue'
type FilterKey = 'all' | 'debtors' | 'overdue' | 'overpaid' | 'nodebt'

interface Summary {
  lend: Map<CurrencyCode, number>
  overdue: boolean
  lendTotal: number
  borrowTotal: number
}

const selectClass =
  'h-9 appearance-none rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function StatMini({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', tone === 'danger' && 'text-destructive')}>
        {value}
      </p>
    </div>
  )
}

/**
 * Shared master-detail list for both Clients and Suppliers — they're the
 * same underlying `clients` rows (a `kind` tag), same transaction engine,
 * just a different nav section and a few labels.
 */
export function PeopleListPage({ kind }: { kind: ClientKind }) {
  const { t } = useTranslation()
  const { id: routeId } = useParams()
  const { activeBranchId } = useBranch()
  const branchId = activeBranchId ?? undefined
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(routeId ? Number(routeId) : null)

  // Preselect a client when navigated to /clients/:id (e.g. from a drill-down).
  useEffect(() => {
    if (routeId) setSelectedId(Number(routeId))
  }, [routeId])
  const [editing, setEditing] = useState<Editing>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  const clients = useClients(branchId ? { branchId, search, kind } : undefined)
  // Open transactions for the whole branch (both kinds) — filtered below to
  // this section's client ids so a Suppliers page never counts client debt.
  const openTx = useTransactions(branchId ? { branchId, onlyOpen: true } : undefined)
  const categories = useCategories(branchId, kind)
  const createM = useCreateClient()
  const updateM = useUpdateClient()
  const archiveM = useArchiveClient()

  const summary = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const m = new Map<number, Summary>()
    for (const tx of openTx.data ?? []) {
      let s = m.get(tx.client_id)
      if (!s) {
        s = { lend: new Map(), overdue: false, lendTotal: 0, borrowTotal: 0 }
        m.set(tx.client_id, s)
      }
      if (tx.direction === 'lend') {
        s.lend.set(tx.currency, (s.lend.get(tx.currency) ?? 0) + tx.remaining)
        s.lendTotal += tx.remaining
        if (tx.due_at && tx.due_at < now && tx.remaining > 0) s.overdue = true
      } else {
        s.borrowTotal += tx.remaining
      }
    }
    return m
  }, [openTx.data])

  function primaryDebt(clientId: number): { currency: CurrencyCode; amount: number } | null {
    const lend = summary.get(clientId)?.lend
    if (!lend) return null
    const arr = [...lend.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .filter((a) => a.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    return arr[0] ?? null
  }

  // Kind-scoped stats, computed from this section's own client list rather
  // than the branch-wide dashboard (which mixes clients and suppliers).
  const kindStats = useMemo(() => {
    let debtorCount = 0
    const totals = new Map<CurrencyCode, number>()
    for (const c of clients.data ?? []) {
      const s = summary.get(c.id)
      if (!s) continue
      if (s.lendTotal > 0) debtorCount++
      for (const [currency, amount] of s.lend) {
        totals.set(currency, (totals.get(currency) ?? 0) + amount)
      }
    }
    const outstanding = [...totals.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount)
    return { debtorCount, outstanding }
  }, [clients.data, summary])

  const rows = useMemo(() => {
    let r = clients.data ?? []
    if (selectedCategory !== null) r = r.filter((c) => c.group_id === selectedCategory)
    r = r.filter((c) => {
      const s = summary.get(c.id)
      const lend = s?.lendTotal ?? 0
      const borrow = s?.borrowTotal ?? 0
      switch (filter) {
        case 'debtors':
          return lend > 0
        case 'overdue':
          return s?.overdue ?? false
        case 'overpaid':
          return borrow > 0
        case 'nodebt':
          return lend === 0 && borrow === 0
        default:
          return true
      }
    })
    return [...r].sort((a, b) => {
      const sa = summary.get(a.id)
      const sb = summary.get(b.id)
      switch (sort) {
        case 'newest':
          return b.created_at - a.created_at
        case 'oldest':
          return a.created_at - b.created_at
        case 'debt':
          // Currencies aren't summed (UZS/KGS/USD aren't fungible) — sort by
          // each client's largest single-currency debt, the figure shown in the row.
          return (primaryDebt(b.id)?.amount ?? 0) - (primaryDebt(a.id)?.amount ?? 0)
        case 'overdue':
          return Number(sb?.overdue ?? false) - Number(sa?.overdue ?? false)
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [clients.data, selectedCategory, filter, sort, summary])

  const selected = (clients.data ?? []).find((c) => c.id === selectedId) ?? null

  const sectionTitle = kind === 'supplier' ? t('nav.suppliers') : t('nav.clients')
  const addLabel = kind === 'supplier' ? t('suppliers.addSupplier') : t('clients.addClient')
  const editLabel = kind === 'supplier' ? t('suppliers.editSupplier') : t('clients.editClient')
  const deleteConfirmBody = kind === 'supplier' ? t('suppliers.deleteConfirm') : t('clients.deleteConfirm')
  const selectPrompt = kind === 'supplier' ? t('suppliers.selectPrompt') : t('clients.selectPrompt')
  const emptyMessage = kind === 'supplier' ? t('pages.suppliersEmpty') : t('pages.clientsEmpty')

  function submit(v: PersonFormValues): void {
    if (!branchId) return
    const fields = {
      name: v.name,
      phone: v.phone || null,
      description: v.description || null,
      trust_level: v.trust_level,
      group_id: v.group_id
    }
    if (editing) {
      updateM.mutate({ id: editing.id, patch: fields }, { onSuccess: () => setEditing(undefined) })
    } else {
      createM.mutate(
        { branch_id: branchId, kind, ...fields },
        {
          onSuccess: (c) => {
            setEditing(undefined)
            setSelectedId(c.id)
          }
        }
      )
    }
  }

  const tabClass = (active: boolean): string =>
    cn(
      'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'border-transparent bg-foreground text-background'
        : 'border-border bg-background text-muted-foreground hover:bg-accent'
    )

  return (
    <div className="flex h-full min-h-0">
      {/* Left: list */}
      <div className="flex w-[380px] shrink-0 flex-col border-r border-border">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">
              {sectionTitle} <span className="font-normal text-muted-foreground">· {rows.length}</span>
            </h1>
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="size-4" />
              {addLabel}
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('clients.searchPlaceholder')}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label={t('clients.sortBy')}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={selectClass}
            >
              <option value="name">{t('clients.sortName')}</option>
              <option value="newest">{t('clients.sortNewest')}</option>
              <option value="oldest">{t('clients.sortOldest')}</option>
              <option value="debt">{t('clients.sortDebt')}</option>
              <option value="overdue">{t('clients.sortOverdue')}</option>
            </select>
            <select
              aria-label={t('clients.filter')}
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
              className={selectClass}
            >
              <option value="all">{t('clients.filterAll')}</option>
              <option value="debtors">{t('clients.filterDebtors')}</option>
              <option value="overdue">{t('clients.filterOverdue')}</option>
              <option value="overpaid">{t('clients.filterOverpaid')}</option>
              <option value="nodebt">{t('clients.filterNoDebt')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button className={tabClass(selectedCategory === null)} onClick={() => setSelectedCategory(null)}>
              {t('clients.allClients')}
            </button>
            {(categories.data ?? []).map((cat) => (
              <button
                key={cat.id}
                className={tabClass(selectedCategory === cat.id)}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
                <span className="text-xs opacity-70">{cat.count}</span>
              </button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={t('clients.manageFolders')}
              onClick={() => setManageOpen(true)}
            >
              <Folder className="size-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <StatMini label={sectionTitle} value={String((clients.data ?? []).length)} />
              <StatMini label={t('stats.debtors')} value={String(kindStats.debtorCount)} />
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t('clients.totalDebt')}</p>
              {kindStats.outstanding.length === 0 ? (
                <p className="text-sm font-semibold tabular-nums text-destructive">0</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {kindStats.outstanding.map((a) => (
                    <span
                      key={a.currency}
                      className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-destructive"
                    >
                      {formatMoney(a.amount, a.currency)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {search ? t('clients.noResults') : emptyMessage}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((c) => {
                const debt = primaryDebt(c.id)
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                        selectedId === c.id && 'bg-accent'
                      )}
                    >
                      <Avatar name={c.name} seed={c.id} className="size-11 text-base" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('size-2 shrink-0 rounded-full', trustColorClass(c.trust_level))} />
                          <p className="truncate text-sm font-medium">{c.name}</p>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.phone || c.description || ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'font-mono text-sm font-semibold tabular-nums',
                            debt ? 'text-destructive' : 'text-muted-foreground'
                          )}
                        >
                          {debt ? formatMoney(debt.amount, debt.currency) : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {debt ? t('clients.debtLabel') : t('clients.noDebt')}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected && branchId ? (
          <PersonDetail
            client={selected}
            branchId={branchId}
            kind={kind}
            onEdit={() => setEditing(selected)}
            onDelete={() => setConfirmDelete(selected)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="size-7" />
            </span>
            <div>
              <p className="text-lg font-semibold">{sectionTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectPrompt}</p>
            </div>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" />
              {addLabel}
            </Button>
          </div>
        )}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? editLabel : addLabel}>
        <PersonForm
          initial={editing}
          categories={categories.data ?? []}
          onSubmit={submit}
          onCancel={() => setEditing(undefined)}
          pending={createM.isPending || updateM.isPending}
        />
      </Modal>

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title={t('clients.delete')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{deleteConfirmBody}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDelete) return
                const id = confirmDelete.id
                archiveM.mutate(id, {
                  onSuccess: () => {
                    setConfirmDelete(null)
                    if (selectedId === id) setSelectedId(null)
                  }
                })
              }}
            >
              {t('clients.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {branchId ? (
        <CategoryManager
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          branchId={branchId}
          kind={kind}
        />
      ) : null}
    </div>
  )
}
