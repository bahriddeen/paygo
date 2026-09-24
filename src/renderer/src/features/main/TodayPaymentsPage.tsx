import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Wallet, Search } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import { useBranchPayments } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { formatDate } from '@/lib/date'
import { useListControls } from '@/lib/useListControls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pager } from '@/components/ui/pager'
import { EmptyState } from '@/components/EmptyState'

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

export default function TodayPaymentsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { activeBranchId } = useBranch()
  const now = Math.floor(Date.now() / 1000)
  const payments = useBranchPayments(
    activeBranchId ? { branchId: activeBranchId, from: startOfToday(), to: now + 1 } : undefined
  )
  const ctrl = useListControls(payments.data ?? [], (p) => p.client_name, 15)

  const methodLabel = (m: string | null): string =>
    m === 'cash' ? t('tx.methodCash') : m === 'card' ? t('tx.methodCard') : m === 'transfer' ? t('tx.methodTransfer') : ''

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label={t('main.back')} onClick={() => navigate('/main')}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{t('main.todayPayments')}</h1>
        </div>
        {payments.data && payments.data.length > 0 ? (
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
        {!payments.data || payments.data.length === 0 ? (
          <EmptyState icon={Wallet} title={t('main.noPaymentsToday')} />
        ) : ctrl.total === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t('reminders.noResults')}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {ctrl.pageItems.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/clients/${p.client_id}`)}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.client_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(p.paid_at, i18n.language)}
                        {p.method ? ` · ${methodLabel(p.method)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-primary">
                      +{formatMoney(p.amount, p.currency)}
                    </span>
                  </button>
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
    </div>
  )
}
