import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Small info icon that reveals an explanation on hover or keyboard focus. */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Flip above the icon when there isn't room below.
  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setAbove(window.innerHeight - rect.bottom < 120)
  }, [open])

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className={cn(
            'absolute left-1/2 z-50 w-60 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-md',
            above ? 'bottom-6' : 'top-6'
          )}
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
