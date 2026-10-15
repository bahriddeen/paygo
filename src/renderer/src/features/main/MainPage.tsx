import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, ReceiptText, CircleCheck, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Pager } from '@/components/ui/pager'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/ui/toast'
import { useListControls } from '@/lib/useListControls'
import { useBranch } from '@/app/BranchProvider'
import {
  useDashboard,
  useTransactions,
  useClients,
  useCreateTransaction,
  useAddPayment,
  useDeleteTransaction,
  useDeletePayment,
  type TransactionWithBalance
} from '@/lib/api'
import { formatMoney, type CurrencyCode } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDirectSend } from '@/lib/useDirectSend'
import { TransactionForm } from '../transactions/TransactionForm'
import { PaymentForm } from '../transactions/PaymentForm'
import { TransactionRow } from '../transactions/TransactionRow'

type Amounts = { currency: CurrencyCode; amount: number }[]

function SummaryCell({
  label,
  amounts,
  meta,
  tone,
  onClick
}: {
  label: string
  amounts: Amounts
  meta: string
  tone?: 'danger'
  onClick?: () => void
}) {
  const sorted = [...amounts].sort((a, b) => b.amount - a.amount)
  const [primary, ...rest] = sorted
  const clickable = !!onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        'group flex-1 px-6 py-5 text-left transition-colors',
        clickable && 'hover:bg-accent'
      )}
    >
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        {clickable ? (
          <ChevronRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
        ) : null}
      </p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-semibold tabular-nums',
          !primary ? 'text-muted-foreground' : tone === 'danger' ? 'text-destructive' : ''
        )}
      >
        {primary ? formatMoney(primary.amount, primary.currency) : '0'}
      </p>
      {rest.length > 0 ? (
        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {rest.map((a) => formatMoney(a.amount, a.currency)).join(', ')}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
    </button>
  )
}

export default function MainPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { activeBranchId } = useBranch()
  const branchId = activeBranchId ?? undefined

  const dash = useDashboard(branchId)
  const recent = useTransactions(branchId ? { branchId, limit: 8 } : undefined)
  const overdue = useTransactions(branchId ? { branchId, overdue: true } : undefined)
  const clientsQ = useClients(branchId ? { branchId, sort: 'name' } : undefined)
  const createTx = useCreateTransaction()
  const directSend = useDirectSend()
  const addPay = useAddPayment()
  const deleteTx = useDeleteTransaction()
  const deletePay = useDeletePayment()

  const [txOpen, setTxOpen] = useState(false)
  const [txWide, setTxWide] = useState(false)
  const [payFor, setPayFor] = useState<TransactionWithBalance | null>(null)
  const ovCtrl = useListControls(overdue.data ?? [], (tx) => tx.client_name, 8)

  // The global "New transaction" shortcut (Ctrl/Cmd+N) navigates here with
  // ?new=1 from anywhere in the app; pick it up once and open the modal.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setTxOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const s = dash.data

  const newTxButton = (
    <Button onClick={() => setTxOpen(true)}>
      <Plus className="size-4" />
      {t('common.newTransaction')}
    </Button>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.main')}</h1>
        {newTxButton}
      </div>

      {/* Summary band — one surface with internal rules */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex divide-x divide-border">
          <SummaryCell
            label={t('main.outstanding')}
            amounts={s?.outstanding ?? []}
            meta={`${t('main.debtorsCount', { count: s?.outstandingClients ?? 0 })}, ${t('main.debtsCount', { count: s?.openDebts ?? 0 })}`}
          />
          <SummaryCell
            label={t('main.todayPayments')}
            amounts={s?.todayPayments ?? []}
            meta={t('main.paymentsCount', { count: s?.todayPaymentsCount ?? 0 })}
            onClick={() => navigate('/payments/today')}
          />
          <SummaryCell
            label={t('main.overdue')}
            amounts={s?.overdue ?? []}
            meta={t('main.debtsCount', { count: s?.overdueCount ?? 0 })}
            tone="danger"
            onClick={() => navigate('/overdue')}
          />
        </div>
        {s && s.youOwe.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3 text-sm">
            <span className="text-muted-foreground">{t('main.youOwe')}:</span>
            {s.youOwe.map((a) => (
              <span
                key={a.currency}
                className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium tabular-nums"
              >
                {formatMoney(a.amount, a.currency)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('main.recentActivity')}</h2>
          {newTxButton}
        </div>
        <div className="rounded-lg border border-border bg-card">
          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.data.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} locale={i18n.language} onPay={setPayFor} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={t('main.emptyRecentTitle')}
              body={t('main.emptyRecentBody')}
              action={newTxButton}
            />
          )}
        </div>
      </section>

      {/* Overdue */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{t('main.overdue')}</h2>
          {overdue.data && overdue.data.length > 0 ? (
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ovCtrl.query}
                onChange={(e) => ovCtrl.setQuery(e.target.value)}
                placeholder={t('reminders.searchByName')}
                className="pl-9"
              />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card">
          {!overdue.data || overdue.data.length === 0 ? (
            <EmptyState icon={CircleCheck} tone="positive" title={t('main.noOverdue')} />
          ) : ovCtrl.total === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('reminders.noResults')}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {ovCtrl.pageItems.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    locale={i18n.language}
                    showOverdue
                    onPay={setPayFor}
                  />
                ))}
              </ul>
              <Pager
                page={ovCtrl.page}
                totalPages={ovCtrl.totalPages}
                total={ovCtrl.total}
                pageSize={ovCtrl.pageSize}
                onPage={ovCtrl.setPage}
              />
            </>
          )}
        </div>
      </section>

      <Modal
        open={txOpen}
        onClose={() => {
          setTxOpen(false)
          setTxWide(false)
        }}
        title={t('common.newTransaction')}
        size={txWide ? 'lg' : 'md'}
      >
        {branchId ? (
          <TransactionForm
            branchId={branchId}
            clients={clientsQ.data ?? []}
            pending={createTx.isPending}
            onLineItemsChange={setTxWide}
            onCancel={() => {
              setTxOpen(false)
              setTxWide(false)
            }}
            onSubmit={(input) =>
              createTx.mutate(input, {
                onSuccess: (created) => {
                  setTxOpen(false)
                  setTxWide(false)
                  const client = (clientsQ.data ?? []).find((c) => c.id === created.client_id)
                  // WhatsApp goes out only once the undo window has passed.
                  toast.pushUndo(
                    t('toast.transactionAdded'),
                    t('toast.undo'),
                    () => deleteTx.mutate(created.id),
                    () => directSend(created, client)
                  )
                }
              })
            }
          />
        ) : null}
      </Modal>

      <Modal open={payFor !== null} onClose={() => setPayFor(null)} title={t('tx.recordPayment')}>
        {payFor ? (
          <PaymentForm
            transaction={payFor}
            pending={addPay.isPending}
            onCancel={() => setPayFor(null)}
            onSubmit={(input) =>
              addPay.mutate(input, {
                onSuccess: (created) => {
                  setPayFor(null)
                  toast.pushUndo(t('toast.paymentAdded'), t('toast.undo'), () =>
                    deletePay.mutate(created.id)
                  )
                }
              })
            }
          />
        ) : null}
      </Modal>
    </div>
  )
}
