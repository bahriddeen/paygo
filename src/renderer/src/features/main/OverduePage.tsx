import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CircleCheck, Search } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import { useTransactions } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { formatDate, daysBetween } from '@/lib/date'
import { useListControls } from '@/lib/useListControls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pager } from '@/components/ui/pager'
import { EmptyState } from '@/components/EmptyState'

export default function OverduePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { activeBranchId } = useBranch()
  const overdue = useTransactions(
    activeBranchId ? { branchId: activeBranchId, overdue: true } : undefined
  )
  const now = Math.floor(Date.now() / 1000)
  const ctrl = useListControls(overdue.data ?? [], (tx) => tx.client_name, 15)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label={t('main.back')} onClick={() => navigate('/main')}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{t('main.overdue')}</h1>
        </div>
        {overdue.data && overdue.data.length > 0 ? (
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
        {!overdue.data || overdue.data.length === 0 ? (
          <EmptyState icon={CircleCheck} tone="positive" title={t('main.noOverdue')} />
        ) : ctrl.total === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t('reminders.noResults')}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {ctrl.pageItems.map((tx) => {
                const days = tx.due_at ? daysBetween(tx.due_at, now) : 0
                return (
                  <li key={tx.id}>
                    <button
                      onClick={() => navigate(`/clients/${tx.client_id}`)}
                      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.client_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.due_at ? formatDate(tx.due_at, i18n.language) : ''}
                          {days > 0 ? (
                            <span className="ml-2 text-destructive">{t('tx.overdueBy', { days })}</span>
                          ) : null}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-destructive">
                        {formatMoney(tx.remaining, tx.currency)}
                      </span>
                    </button>
                  </li>
                )
              })}
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
    </div>
  )
}
