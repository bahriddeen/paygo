import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'neutral'
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  body?: string
  action?: ReactNode
  tone?: 'neutral' | 'positive'
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          tone === 'positive' ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {body ? <p className="max-w-xs text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {action}
    </div>
  )
}
