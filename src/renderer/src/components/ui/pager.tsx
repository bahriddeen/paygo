import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

/** Compact pager: "from–to / total" with prev/next. Hidden when it all fits one page. */
export function Pager({
  page,
  totalPages,
  total,
  pageSize,
  onPage
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  if (total <= pageSize) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {from}–{to} / {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
