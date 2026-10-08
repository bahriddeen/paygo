import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

const SIZE_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-2xl'
} as const

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md'
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: keyof typeof SIZE_CLASS
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${SIZE_CLASS[size]} rounded-lg border border-border bg-card shadow-lg transition-[max-width] duration-200`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
