import { cn } from '@/lib/utils'

const COLORS = [
  'bg-blue-500',
  'bg-pink-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-fuchsia-500'
]

/** Colored square with the name's initial. Color is stable per `seed` (client id). */
export function Avatar({
  name,
  seed,
  className
}: {
  name: string
  seed: number
  className?: string
}) {
  const color = COLORS[Math.abs(seed) % COLORS.length]
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl font-semibold text-white',
        color,
        className
      )}
    >
      {letter}
    </span>
  )
}
