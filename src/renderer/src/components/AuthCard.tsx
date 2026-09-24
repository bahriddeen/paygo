import type { ReactNode } from 'react'
import { NotebookText } from 'lucide-react'

/** Full-screen centered card for the pre-app gates (activation, lock). */
export function AuthCard({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <NotebookText className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
