import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useLockStatus } from '@/lib/api'
import { AuthCard } from '@/components/AuthCard'
import { PinField } from '@/components/PinField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LockValue {
  canLock: boolean
  lock: () => void
}
const LockContext = createContext<LockValue>({ canLock: false, lock: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useLock(): LockValue {
  return useContext(LockContext)
}

type Mode = 'verify' | 'recover' | 'create'

export function LockGate({ children }: { children: ReactNode }) {
  const status = useLockStatus()
  const [unlocked, setUnlocked] = useState(false)
  const [pinCreated, setPinCreated] = useState(false)
  const [mode, setMode] = useState<Mode>('verify')

  if (status.isLoading) return null

  const hasPin = !!status.data?.hasPin

  if (!unlocked) {
    if (!hasPin) {
      return (
        <PinCreate
          onDone={() => {
            setPinCreated(true)
            setUnlocked(true)
          }}
        />
      )
    }
    if (mode === 'recover') {
      return (
        <PinRecover
          onVerified={() => setMode('create')}
          onCancel={() => setMode('verify')}
        />
      )
    }
    if (mode === 'create') {
      return (
        <PinCreate
          onDone={() => {
            setPinCreated(true)
            setUnlocked(true)
          }}
        />
      )
    }
    return <PinVerify onUnlock={() => setUnlocked(true)} onForgot={() => setMode('recover')} />
  }

  return (
    <LockContext.Provider value={{ canLock: hasPin || pinCreated, lock: () => setUnlocked(false) }}>
      {children}
    </LockContext.Provider>
  )
}

function PinVerify({ onUnlock, onForgot }: { onUnlock: () => void; onForgot: () => void }) {
  const { t } = useTranslation()
  const [error, setError] = useState('')

  async function handle(pin: string): Promise<void> {
    const result = await window.api.lock.verify(pin)
    if (result.ok) onUnlock()
    else setError(t('lock.wrong'))
  }

  return (
    <AuthCard title={t('lock.enter')}>
      <PinField onComplete={handle} error={error} onChange={() => setError('')} />
      <button
        type="button"
        onClick={onForgot}
        className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {t('lock.forgot')}
      </button>
    </AuthCard>
  )
}

function PinRecover({ onVerified, onCancel }: { onVerified: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(): Promise<void> {
    setBusy(true)
    setError('')
    const result = await window.api.lock.recover(code.trim())
    setBusy(false)
    if (result.ok) onVerified()
    else setError(t('lock.recoverInvalid'))
  }

  return (
    <AuthCard title={t('lock.recoverTitle')} subtitle={t('lock.recoverPrompt')}>
      <div className="space-y-3">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          placeholder={t('lock.recoverPlaceholder')}
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={busy || !code.trim()} onClick={handleSubmit}>
          {t('lock.recoverSubmit')}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t('lock.recoverBack')}
        </button>
      </div>
    </AuthCard>
  )
}

function PinCreate({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handle(pin: string): Promise<void> {
    if (first === null) {
      setFirst(pin)
      return
    }
    if (pin !== first) {
      setError(t('lock.mismatch'))
      setFirst(null)
      return
    }
    await window.api.lock.setPin(pin)
    void qc.invalidateQueries({ queryKey: ['lock-status'] })
    onDone()
  }

  return (
    <AuthCard
      title={first === null ? t('lock.create') : t('lock.confirm')}
      subtitle={first === null ? t('lock.createHint') : undefined}
    >
      <PinField
        key={first === null ? 'first' : 'second'}
        onComplete={handle}
        error={error}
        onChange={() => setError('')}
      />
    </AuthCard>
  )
}
