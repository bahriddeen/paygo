import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const UNDO_DURATION_MS = 5000

interface ToastItem {
  id: number
  message: string
  undo?: { label: string; onUndo: () => void }
  error?: boolean
}

interface ToastContextValue {
  /** `onExpire` runs only if the toast times out without Undo being pressed. */
  pushUndo: (message: string, undoLabel: string, onUndo: () => void, onExpire?: () => void) => void
  pushError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function ToastProgress({ duration }: { duration: number }) {
  const [shrink, setShrink] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShrink(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/15">
      <div
        className="h-full bg-primary ease-linear"
        style={{
          width: shrink ? '0%' : '100%',
          transitionProperty: 'width',
          transitionDuration: `${duration}ms`
        }}
      />
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const pushUndo = useCallback(
    (message: string, undoLabel: string, onUndo: () => void, onExpire?: () => void) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, undo: { label: undoLabel, onUndo } }])
      timers.current.set(
        id,
        // Undo calls remove(), which clears this timer — so onExpire never
        // fires for an undone action.
        setTimeout(() => {
          remove(id)
          onExpire?.()
        }, UNDO_DURATION_MS)
      )
    },
    [remove]
  )

  const pushError = useCallback(
    (message: string) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, error: true }])
      timers.current.set(
        id,
        setTimeout(() => remove(id), UNDO_DURATION_MS)
      )
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ pushUndo, pushError }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-3 shadow-lg"
          >
            <span className={toast.error ? 'text-sm text-destructive' : 'text-sm'}>
              {toast.message}
            </span>
            {toast.undo ? (
              <button
                type="button"
                className="text-sm font-semibold text-destructive hover:underline"
                onClick={() => {
                  toast.undo?.onUndo()
                  remove(toast.id)
                }}
              >
                {toast.undo.label}
              </button>
            ) : null}
            <ToastProgress duration={UNDO_DURATION_MS} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
