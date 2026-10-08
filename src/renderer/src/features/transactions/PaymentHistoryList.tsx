import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/lib/format'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Payment, PaymentWithTransaction } from '@/lib/api'

type HistoryItem = Payment | PaymentWithTransaction

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
export function PaymentHistoryList({ payments }: { payments: HistoryItem[] }) {
  const { t } = useTranslation()

  if (payments.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
  }

  return (
    <ul className="max-h-96 divide-y divide-border overflow-y-auto">
      {payments.map((p) => {
        const methodLabel = p.method ? t(METHOD_KEYS[p.method] ?? '') || p.method : null
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 px-1 py-3">
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
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
              {formatMoney(p.amount, p.currency)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
