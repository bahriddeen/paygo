import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useLicenseStatus } from '@/lib/api'
import { AuthCard } from '@/components/AuthCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ActivationGate({ children }: { children: ReactNode }) {
  const status = useLicenseStatus()
  if (status.isLoading) return null
  if (status.data?.activated) return <>{children}</>
  return <ActivationScreen />
}

function ActivationScreen() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await window.api.license.activate(code.trim())
    setBusy(false)
    if (result.ok) {
      void qc.invalidateQueries({ queryKey: ['license-status'] })
    } else {
      setError(t('activation.invalid'))
    }
  }

  return (
    <AuthCard title={t('activation.title')} subtitle={t('activation.prompt')}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          placeholder={t('activation.placeholder')}
          autoFocus
          className="font-mono text-xs"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
          {t('activation.activate')}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">{t('activation.contactHint')}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://t.me/talk2bahriddin_bot')}
        >
          <Send className="size-4" />
          {t('activation.contactTelegram')}
        </Button>
      </div>
    </AuthCard>
  )
}
