import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Clock, CircleCheck, Search } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import { useAppSettings } from '@/app/SettingsProvider'
import { useTransactions } from '@/lib/api'
import { formatMoney, type CurrencyCode } from '@/lib/format'
import { formatDate, daysBetween } from '@/lib/date'
import { useListControls } from '@/lib/useListControls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pager } from '@/components/ui/pager'
import { EmptyState } from '@/components/EmptyState'
import { ReminderQueue, type QueueDebtor } from './ReminderQueue'

interface DebtorGroup {
  client_id: number
  name: string
  phone: string | null
  amounts: { currency: CurrencyCode; amount: number }[]
  maxDays: number
}

function fillTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? '')
}

export default function RemindersPage() {
  const { t, i18n } = useTranslation()
  const { activeBranchId } = useBranch()
  const { raw: settings } = useAppSettings()
  const branchId = activeBranchId ?? undefined
  const overdue = useTransactions(branchId ? { branchId, overdue: true } : undefined)
  const upcoming = useTransactions(branchId ? { branchId, dueSoonWithin: 7 * 86400 } : undefined)
  const [queue, setQueue] = useState<QueueDebtor[] | null>(null)

  const groups = useMemo<DebtorGroup[]>(() => {
    const now = Math.floor(Date.now() / 1000)
    const map = new Map<number, DebtorGroup>()
    for (const tx of overdue.data ?? []) {
      let g = map.get(tx.client_id)
      if (!g) {
        g = { client_id: tx.client_id, name: tx.client_name, phone: tx.client_phone, amounts: [], maxDays: 0 }
        map.set(tx.client_id, g)
      }
      const found = g.amounts.find((a) => a.currency === tx.currency)
      if (found) found.amount += tx.remaining
      else g.amounts.push({ currency: tx.currency, amount: tx.remaining })
      if (tx.due_at) g.maxDays = Math.max(g.maxDays, daysBetween(tx.due_at, now))
    }
    return [...map.values()]
  }, [overdue.data])

  const ctrl = useListControls(groups, (g) => g.name, 12)

  const amountsStr = (g: DebtorGroup): string =>
    g.amounts.map((a) => formatMoney(a.amount, a.currency)).join(', ')

  const buildMessage = (g: DebtorGroup): string => {
    const vars = { name: g.name, amount: amountsStr(g), days: String(g.maxDays) }
    const stored = settings[`wa_template_${i18n.language}`]
    return stored ? fillTemplate(stored, vars) : t('reminders.waTemplate', vars)
  }

  const remind = (g: DebtorGroup): void => {
    if (g.phone) void window.api.whatsapp.open(g.phone, buildMessage(g))
  }

  // "Remind all" queues the currently filtered debtors who have a phone.
  const startQueue = (): void => {
    const list: QueueDebtor[] = ctrl.filtered
      .filter((g) => g.phone)
      .map((g) => ({
        client_id: g.client_id,
        name: g.name,
        phone: g.phone as string,
        amounts: g.amounts,
        maxDays: g.maxDays,
        message: buildMessage(g)
      }))
    if (list.length > 0) setQueue(list)
  }

  const filteredWithPhone = ctrl.filtered.filter((g) => g.phone).length
  const waEnabled = settings['whatsapp_enabled'] === '1'

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.reminders')}</h1>
        {waEnabled && filteredWithPhone > 0 ? (
          <Button onClick={startQueue}>
            <MessageCircle className="size-4" />
            {t('reminders.remindAll')} ({filteredWithPhone})
          </Button>
        ) : null}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{t('main.overdue')}</h2>
          {groups.length > 0 ? (
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ctrl.query}
                onChange={(e) => ctrl.setQuery(e.target.value)}
                placeholder={t('reminders.searchByName')}
                className="pl-9"
              />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card">
          {groups.length === 0 ? (
            <EmptyState icon={CircleCheck} tone="positive" title={t('main.noOverdue')} />
          ) : ctrl.total === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('reminders.noResults')}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {ctrl.pageItems.map((g) => (
                  <li key={g.client_id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.phone ?? t('reminders.noPhone')}
                        <span className="ml-2 text-destructive">
                          {t('tx.overdueBy', { days: g.maxDays })}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-destructive">
                      {amountsStr(g)}
                    </span>
                    {waEnabled ? (
                      <Button variant="outline" size="sm" disabled={!g.phone} onClick={() => remind(g)}>
                        <MessageCircle className="size-4" />
                        {t('reminders.whatsapp')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Pager
                page={ctrl.page}
                totalPages={ctrl.totalPages}
                total={ctrl.total}
                pageSize={ctrl.pageSize}
                onPage={ctrl.setPage}
              />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{t('reminders.upcoming')}</h2>
        <div className="rounded-lg border border-border bg-card">
          {upcoming.data && upcoming.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {upcoming.data.map((tx) => (
                <li key={tx.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.client_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.due_at ? formatDate(tx.due_at, i18n.language) : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {formatMoney(tx.remaining, tx.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Clock} title={t('reminders.emptyUpcoming')} />
          )}
        </div>
      </section>

      {queue ? <ReminderQueue debtors={queue} onClose={() => setQueue(null)} /> : null}
    </div>
  )
}
