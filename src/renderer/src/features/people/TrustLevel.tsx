import { cn } from '@/lib/utils'

// Trust scale 1–5: red (risky) → emerald (trusted).
const COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
  4: 'bg-lime-500',
  5: 'bg-emerald-600'
}

const LEVELS = [1, 2, 3, 4, 5]

export function trustColorClass(level: number): string {
  return COLORS[level] ?? 'bg-muted'
}

export function TrustDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${level}/5`} aria-label={`${level}/5`}>
      {LEVELS.map((n) => (
        <span
          key={n}
          className={cn('size-2 rounded-full', n <= level ? COLORS[level] : 'bg-muted')}
        />
      ))}
    </span>
  )
}

export function TrustSelector({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {LEVELS.map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          aria-label={String(n)}
          className={cn(
            'size-7 rounded-full border transition',
            n <= value ? `${COLORS[value]} border-transparent` : 'border-border bg-background hover:bg-accent'
          )}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">{value}/5</span>
    </div>
  )
}
