import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Payment, PaymentWithTransaction } from '@/lib/api'

export type HistoryItem = Payment | PaymentWithTransaction

function hasDirection(p: HistoryItem): p is PaymentWithTransaction {
  return 'direction' in p
}

const METHOD_KEYS: Record<string, string> = {
  cash: 'tx.methodCash',
  card: 'tx.methodCard',
  transfer: 'tx.methodTransfer'
}

/** Read-only list of past payments, shared by the per-transaction history
 *  modal and the person-level "all history" modal — the latter's items also
 *  carry which transaction (direction/description) each payment belongs to. */
export function PaymentHistoryList({
  payments,
  onEdit,
  onDelete
}: {
  payments: HistoryItem[]
  /** When provided, each row gets edit/delete icon buttons — lets a shop
   *  owner correct or remove a mis-entered payment after the fact. */
  onEdit?: (payment: HistoryItem) => void
  onDelete?: (payment: HistoryItem) => void
}) {
  const { t } = useTranslation()

  if (payments.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
  }

  return (
    <ul className="max-h-96 divide-y divide-border overflow-y-auto">
      {payments.map((p) => {
        const methodLabel = p.method ? t(METHOD_KEYS[p.method] ?? '') || p.method : null
        return (
          <li key={p.id} className="group flex items-center justify-between gap-3 px-1 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatDateTime(p.paid_at)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hasDirection(p) ? (
                  <span
                    className={cn(
                      'font-medium',
                      p.direction === 'lend' ? 'text-emerald-600' : 'text-rose-600'
                    )}
                  >
                    {t(p.direction === 'lend' ? 'tx.lendShort' : 'tx.borrowShort')}
                  </span>
                ) : null}
                {hasDirection(p) && p.description ? ` — ${p.description}` : ''}
                {methodLabel ? ` · ${methodLabel}` : ''}
                {p.note ? ` · ${p.note}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatMoney(p.amount, p.currency)}
              </span>
              {onEdit || onDelete ? (
                <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  {onEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.edit')}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('tx.deletePayment')}
                      className="text-destructive"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
