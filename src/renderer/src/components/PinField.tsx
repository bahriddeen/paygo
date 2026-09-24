import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Four-digit PIN entry. Calls onComplete when 4 digits are entered, then clears. */
export function PinField({
  onComplete,
  error,
  onChange
}: {
  onComplete: (pin: string) => void
  error?: string
  onChange?: () => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function update(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    setValue(digits)
    onChange?.()
    if (digits.length === 4) {
      onComplete(digits)
      setValue('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={ref}
          value={value}
          onChange={(e) => update(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-label="PIN"
          className="absolute inset-0 z-10 h-full w-full cursor-default opacity-0"
        />
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'flex size-12 items-center justify-center rounded-md border text-2xl',
                error
                  ? 'border-destructive'
                  : value.length === i
                    ? 'border-primary'
                    : 'border-input'
              )}
            >
              {value[i] ? '•' : ''}
            </div>
          ))}
        </div>
      </div>
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
