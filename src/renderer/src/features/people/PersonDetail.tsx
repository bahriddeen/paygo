import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, Pencil, Trash2, Plus, Check, History } from 'lucide-react'
import {
  useClientBalance,
  useTransactions,
  useCreateTransaction,
  useAddPayment,
  useUpdateTransaction,
  useDeleteTransaction,
  useUpdatePayment,
  useDeletePayment,
  useClientPayments,
  useTransactionPayments,
  useTransactionLineItems,
  type Client,
  type ClientKind,
  type TransactionWithBalance
} from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { formatDate } from '@/lib/date'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useDirectSend } from '@/lib/useDirectSend'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionEditForm } from '../transactions/TransactionEditForm'
import { PaymentForm } from '../transactions/PaymentForm'
import { PaymentEditForm } from '../transactions/PaymentEditForm'
import { TransactionRow } from '../transactions/TransactionRow'
import { PaymentHistoryList, type HistoryItem } from '../transactions/PaymentHistoryList'
import { TransactionSummary } from '../transactions/TransactionSummary'

/** Maps a thrown repository error to a translated, user-facing message —
 *  raw messages like "updatePayment: amount 500 exceeds remaining 300" are
 *  written for developers, not shop owners, and aren't localized. */
function paymentErrorMessage(err: unknown, t: (key: string) => string): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('exceeds remaining')) return t('tx.amountExceedsRemaining')
  return t('common.genericError')
}

export function PersonDetail({
  client,
  branchId,
  kind = 'client',
  onEdit,
  onDelete
}: {
  client: Client
  branchId: number
  kind?: ClientKind
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const balance = useClientBalance(client.id)
  const txns = useTransactions({ branchId, clientId: client.id })
  const createTx = useCreateTransaction()
  const directSend = useDirectSend()
  const addPay = useAddPayment()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()
  const updatePay = useUpdatePayment()
  const deletePay = useDeletePayment()

  const [addOpen, setAddOpen] = useState(false)
  const [addWide, setAddWide] = useState(false)
  const [editWide, setEditWide] = useState(false)
  const [payTarget, setPayTarget] = useState<TransactionWithBalance | null>(null)
  const [payPicker, setPayPicker] = useState(false)
  const [editTarget, setEditTarget] = useState<TransactionWithBalance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TransactionWithBalance | null>(null)
  const [historyTarget, setHistoryTarget] = useState<TransactionWithBalance | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<HistoryItem | null>(null)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<HistoryItem | null>(null)
  const [editPaymentError, setEditPaymentError] = useState('')
  const [deletePaymentError, setDeletePaymentError] = useState('')
  const clientHistory = useClientPayments(historyOpen ? client.id : undefined)
  const txHistory = useTransactionPayments(historyTarget?.id)
  const txHistoryLineItems = useTransactionLineItems(historyTarget?.id)

  // The payment being edited may belong to the currently open per-transaction
  // history (where we know its parent's remaining, for the "can't exceed
  // remaining" bar) or the person-level "all history" list (where we don't).
  const editPaymentMaxAmount =
    editPayment && historyTarget
      ? historyTarget.remaining + editPayment.amount
      : undefined

  const lend = (balance.data ?? []).filter((b) => b.direction === 'lend')
  const borrow = (balance.data ?? []).filter((b) => b.direction === 'borrow')
  const openDebts = (txns.data ?? []).filter((tx) => tx.direction === 'lend' && tx.remaining > 0)

  function startPayment(): void {
    if (openDebts.length === 0) return
    if (openDebts.length === 1) setPayTarget(openDebts[0])
    else setPayPicker(true)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <div className="flex items-start gap-4">
        <Avatar name={client.name} seed={client.id} className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{client.name}</h1>
          {client.phone ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              {client.phone}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('history.aria')}
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t('common.edit')} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('clients.delete')}
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {client.description ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">{client.description}</p>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-5">
        {lend.length === 0 && borrow.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('clients.noDebt')}</p>
        ) : (
          <div className="space-y-4">
            {lend.map((b) => (
              <div key={`l-${b.currency}`}>
                <p className="text-xs text-muted-foreground">{b.currency}</p>
                <p className="font-mono text-3xl font-semibold tabular-nums text-destructive">
                  {formatMoney(b.remaining, b.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{t('clients.debtLabel')}</p>
              </div>
            ))}
            {borrow.map((b) => (
              <p key={`b-${b.currency}`} className="text-sm">
                <span className="text-muted-foreground">{t('main.youOwe')}: </span>
                <span className="font-mono font-medium tabular-nums text-primary">
                  {formatMoney(b.remaining, b.currency)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          {t('clients.addDebt')}
        </Button>
        <Button
          variant="outline"
          disabled={openDebts.length === 0}
          className="h-12 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          onClick={startPayment}
        >
          <Check className="size-4" />
          {t('clients.payment')}
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">{t('main.recentActivity')}</h2>
        <div className="rounded-lg border border-border bg-card">
          {txns.data && txns.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {txns.data.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  locale={i18n.language}
                  onPay={setPayTarget}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                  onHistory={setHistoryTarget}
                />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('main.emptyRecentTitle')}
            </p>
          )}
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setAddWide(false)
        }}
        title={t('common.newTransaction')}
        size={addWide ? 'lg' : 'md'}
      >
        <TransactionForm
          branchId={branchId}
          clients={[client]}
          defaultDirection={kind === 'supplier' ? 'borrow' : 'lend'}
          pending={createTx.isPending}
          onLineItemsChange={setAddWide}
          onCancel={() => {
            setAddOpen(false)
            setAddWide(false)
          }}
          onSubmit={(input) =>
            createTx.mutate(input, {
              onSuccess: (created) => {
                setAddOpen(false)
                setAddWide(false)
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
      </Modal>

      <Modal open={payPicker} onClose={() => setPayPicker(false)} title={t('clients.payment')}>
        <ul className="space-y-2">
          {openDebts.map((tx) => (
            <li key={tx.id}>
              <button
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  setPayPicker(false)
                  setPayTarget(tx)
                }}
              >
                <span className="truncate">
                  {tx.description || formatDate(tx.issued_at, i18n.language)}
                </span>
                <span className="font-mono tabular-nums">{formatMoney(tx.remaining, tx.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={payTarget !== null} onClose={() => setPayTarget(null)} title={t('tx.recordPayment')}>
        {payTarget ? (
          <PaymentForm
            transaction={payTarget}
            pending={addPay.isPending}
            onCancel={() => setPayTarget(null)}
            onSubmit={(input) =>
              addPay.mutate(input, {
                onSuccess: (created) => {
                  setPayTarget(null)
                  toast.pushUndo(t('toast.paymentAdded'), t('toast.undo'), () =>
                    deletePay.mutate(created.id)
                  )
                }
              })
            }
          />
        ) : null}
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => {
          setEditTarget(null)
          setEditWide(false)
        }}
        title={t('tx.editTitle')}
        size={editWide ? 'lg' : 'md'}
      >
        {editTarget ? (
          <TransactionEditForm
            transaction={editTarget}
            pending={updateTx.isPending}
            onLineItemsChange={setEditWide}
            onCancel={() => {
              setEditTarget(null)
              setEditWide(false)
            }}
            onSubmit={(patch) =>
              updateTx.mutate(
                { id: editTarget.id, patch },
                {
                  onSuccess: () => {
                    setEditTarget(null)
                    setEditWide(false)
                  }
                }
              )
            }
          />
        ) : null}
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('history.title')}>
        <PaymentHistoryList
          payments={clientHistory.data ?? []}
          onEdit={setEditPayment}
          onDelete={setDeletePaymentTarget}
        />
      </Modal>

      <Modal
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        title={t('history.title')}
        size="lg"
      >
        {historyTarget ? (
          <div className="space-y-3">
            <TransactionSummary tx={historyTarget} lineItems={txHistoryLineItems.data ?? []} />
            <PaymentHistoryList
              payments={txHistory.data ?? []}
              onEdit={setEditPayment}
              onDelete={setDeletePaymentTarget}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editPayment !== null}
        onClose={() => {
          setEditPayment(null)
          setEditPaymentError('')
        }}
        title={t('tx.editPaymentTitle')}
      >
        {editPayment ? (
          <div className="space-y-3">
            {editPaymentError ? (
              <p className="text-sm text-destructive">{editPaymentError}</p>
            ) : null}
            <PaymentEditForm
              payment={editPayment}
              currency={editPayment.currency}
              maxAmount={editPaymentMaxAmount}
              pending={updatePay.isPending}
              onCancel={() => {
                setEditPayment(null)
                setEditPaymentError('')
              }}
              onSubmit={(patch) => {
                setEditPaymentError('')
                updatePay.mutate(
                  { id: editPayment.id, patch },
                  {
                    onSuccess: () => setEditPayment(null),
                    onError: (err) =>
                      setEditPaymentError(paymentErrorMessage(err, t))
                  }
                )
              }}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deletePaymentTarget !== null}
        onClose={() => {
          setDeletePaymentTarget(null)
          setDeletePaymentError('')
        }}
        title={t('tx.deletePayment')}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('tx.deletePaymentConfirm')}</p>
          {deletePaymentError ? (
            <p className="text-sm text-destructive">{deletePaymentError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeletePaymentTarget(null)
                setDeletePaymentError('')
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletePaymentTarget) {
                  setDeletePaymentError('')
                  deletePay.mutate(deletePaymentTarget.id, {
                    onSuccess: () => setDeletePaymentTarget(null),
                    onError: (err) =>
                      setDeletePaymentError(paymentErrorMessage(err, t))
                  })
                }
              }}
            >
              {t('tx.deletePayment')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={t('tx.delete')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('tx.deleteConfirm')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteTx.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
                }
              }}
            >
              {t('tx.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
