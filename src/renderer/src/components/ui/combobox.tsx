import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxItem {
  value: string
  label: string
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText
}: {
  items: ComboboxItem[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = items.find((i) => i.value === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <Search className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.map((i) => (
              <li key={i.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(i.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
                    i.value === value && 'bg-accent'
                  )}
                >
                  {i.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">{emptyText ?? '—'}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
