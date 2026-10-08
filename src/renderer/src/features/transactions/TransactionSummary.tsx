import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import { formatDate } from '@/lib/date'
import type { TransactionWithBalance, LineItem } from '@/lib/api'

/** Read-only header shown above a transaction's payment history: who/what/when
 *  the debt is, plus its line items (if any) — so the amount breakdown is
 *  visible before scrolling down to the payments themselves. */
export function TransactionSummary({
  tx,
  lineItems
}: {
  tx: TransactionWithBalance
  lineItems: LineItem[]
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3 border-b border-border pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                tx.direction === 'lend'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
              )}
            >
              {t(tx.direction === 'lend' ? 'tx.lendShort' : 'tx.borrowShort')}
            </span>
            <p className="truncate text-sm font-semibold">{tx.client_name}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(tx.issued_at)}
            {tx.due_at ? ` · ${t('tx.dueDate')}: ${formatDate(tx.due_at)}` : ''}
          </p>
          {tx.description ? <p className="mt-1 text-sm">{tx.description}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatMoney(tx.amount, tx.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx.remaining > 0
              ? `${t('tx.remaining')}: ${formatMoney(tx.remaining, tx.currency)}`
              : t('tx.settled')}
          </p>
        </div>
      </div>

      {lineItems.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col style={{ width: '60px' }} />
              <col style={{ width: '84px' }} />
              <col style={{ width: '112px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium">{t('tx.lineItems.product')}</th>
                <th className="px-1 py-1.5 text-left font-medium">{t('tx.lineItems.quantity')}</th>
                <th className="px-1 py-1.5 text-right font-medium">{t('tx.lineItems.price')}</th>
                <th className="px-2 py-1.5 text-right font-medium">{t('tx.lineItems.total')}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="truncate px-2 py-1">{item.product}</td>
                  <td className="px-1 py-1 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {formatMoney(item.unit_price, tx.currency)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {formatMoney(item.total, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
