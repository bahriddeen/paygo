import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatMoney, toMinor, type CurrencyCode } from '@/lib/format'
import { sanitizeAmountInput } from '@/lib/amount'

export interface LineItemRow {
  key: string
  product: string
  quantity: string
  price: string
}

export function emptyLineItemRow(): LineItemRow {
  return { key: crypto.randomUUID(), product: '', quantity: '', price: '' }
}

export function lineItemTotal(row: LineItemRow, currency: CurrencyCode): number {
  const qty = parseFloat(row.quantity.replace(',', '.'))
  const price = parseFloat(row.price.replace(',', '.'))
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return Math.round(qty * toMinor(price, currency))
}

export function lineItemsGrandTotal(rows: LineItemRow[], currency: CurrencyCode): number {
  return rows.reduce((sum, row) => sum + lineItemTotal(row, currency), 0)
}

export function LineItemsTable({
  currency,
  rows,
  onChange
}: {
  currency: CurrencyCode
  rows: LineItemRow[]
  onChange: (rows: LineItemRow[]) => void
}) {
  const { t } = useTranslation()
  const dragIndex = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function updateRow(key: string, patch: Partial<LineItemRow>): void {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function deleteRow(key: string): void {
    onChange(rows.filter((row) => row.key !== key))
  }

  function addRow(): void {
    onChange([...rows, emptyLineItemRow()])
  }

  function handleDrop(targetIndex: number): void {
    const from = dragIndex.current
    dragIndex.current = null
    setOverIndex(null)
    if (from === null || from === targetIndex) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next)
  }

  const grandTotal = lineItemsGrandTotal(rows, currency)

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: '24px' }} />
              <col />
              <col style={{ width: '60px' }} />
              <col style={{ width: '84px' }} />
              <col style={{ width: '136px' }} />
              <col style={{ width: '32px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th />
                <th className="px-2 py-1.5 text-left font-medium">{t('tx.lineItems.product')}</th>
                <th className="px-1 py-1.5 text-left font-medium">{t('tx.lineItems.quantity')}</th>
                <th className="px-1 py-1.5 text-left font-medium">{t('tx.lineItems.price')}</th>
                <th className="px-2 py-1.5 text-right font-medium">{t('tx.lineItems.total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={
                    overIndex === index ? 'border-t-2 border-primary' : 'border-t border-border'
                  }
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverIndex(index)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(index)
                  }}
                >
                  <td className="px-1 text-center">
                    <span
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null
                        setOverIndex(null)
                      }}
                      className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </span>
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={row.product}
                      onChange={(e) => updateRow(row.key, { product: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.key, { quantity: sanitizeAmountInput(e.target.value) })
                      }
                      className="h-8 px-1.5 text-right"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) =>
                        updateRow(row.key, { price: sanitizeAmountInput(e.target.value) })
                      }
                      className="h-8 px-1.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {formatMoney(lineItemTotal(row, currency), currency)}
                  </td>
                  <td className="px-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => deleteRow(row.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-2 py-1.5 text-sm font-medium">
            <span>{t('tx.lineItems.grandTotal')}</span>
            <span className="tabular-nums">{formatMoney(grandTotal, currency)}</span>
          </div>
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" />
        {t('tx.lineItems.addRow')}
      </Button>
    </div>
  )
}
