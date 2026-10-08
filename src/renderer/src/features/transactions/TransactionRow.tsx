import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import { formatDate, daysBetween } from '@/lib/date'
import type { TransactionWithBalance } from '@/lib/api'

export function TransactionRow({
  tx,
  onPay,
  onEdit,
  onDelete,
  onHistory,
  showOverdue,
  locale
}: {
  tx: TransactionWithBalance
  onPay: (tx: TransactionWithBalance) => void
  onEdit?: (tx: TransactionWithBalance) => void
  onDelete?: (tx: TransactionWithBalance) => void
  onHistory?: (tx: TransactionWithBalance) => void
  showOverdue?: boolean
  locale: string
}) {
  const { t } = useTranslation()
  const isOpen = tx.remaining > 0
  const nowSec = Math.floor(Date.now() / 1000)
  const overdueDays = tx.due_at ? daysBetween(tx.due_at, nowSec) : 0

  return (
    <li
      className={cn(
        'group flex items-center gap-4 px-5 py-3',
        onHistory ? 'cursor-pointer hover:bg-accent/50' : ''
      )}
      onClick={onHistory ? () => onHistory(tx) : undefined}
    >
      <div className="min-w-0 flex-1">
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
          <p className="truncate text-sm font-medium">{tx.client_name}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDate(tx.issued_at, locale)}
          {tx.description ? ` — ${tx.description}` : ''}
          {showOverdue && overdueDays > 0 ? (
            <span className="ml-2 text-destructive">{t('tx.overdueBy', { days: overdueDays })}</span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {formatMoney(tx.amount, tx.currency)}
        </p>
        {isOpen ? (
          <p className="text-xs text-muted-foreground">
            {t('tx.remaining')}: {formatMoney(tx.remaining, tx.currency)}
          </p>
        ) : (
          <p className="text-xs text-primary">{t('tx.settled')}</p>
        )}
      </div>
      <div
        className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen ? (
          <Button variant="outline" size="sm" onClick={() => onPay(tx)}>
            {t('tx.recordPayment')}
          </Button>
        ) : null}
        {onHistory ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('history.aria')}
            onClick={() => onHistory(tx)}
          >
            <History className="size-4" />
          </Button>
        ) : null}
        {onEdit ? (
          <Button variant="ghost" size="icon" aria-label={t('common.edit')} onClick={() => onEdit(tx)}>
            <Pencil className="size-4" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('tx.delete')}
            className="text-destructive"
            onClick={() => onDelete(tx)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </li>
  )
}
