import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Send } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import {
  useLicenseStatus,
  useAppVersion,
  useCreateBranch,
  useRenameBranch,
  useDeleteBranch,
  useSettings,
  useSetSetting
} from '@/lib/api'
import { CURRENCY_CODES } from '@/lib/format'
import { defaultWaTemplate } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DataBackup } from './DataBackup'

const selectClass =
  'h-9 appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const textareaClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function ChangePinForm() {
  const { t } = useTranslation()
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [cf, setCf] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setMsg(null)
    if (!/^\d{4}$/.test(nw)) {
      setMsg({ ok: false, text: t('lock.createHint') })
      return
    }
    if (nw !== cf) {
      setMsg({ ok: false, text: t('lock.mismatch') })
      return
    }
    const r = await window.api.lock.change(cur, nw)
    if (r.ok) {
      setMsg({ ok: true, text: t('settings.pinChanged') })
      setCur('')
      setNw('')
      setCf('')
    } else {
      setMsg({ ok: false, text: t('settings.wrongCurrentPin') })
    }
  }

  const pinProps = { type: 'password', inputMode: 'numeric' as const, maxLength: 4 }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cur-pin">{t('settings.currentPin')}</Label>
        <Input id="cur-pin" {...pinProps} value={cur} onChange={(e) => setCur(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-pin">{t('settings.newPin')}</Label>
          <Input id="new-pin" {...pinProps} value={nw} onChange={(e) => setNw(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-pin">{t('settings.confirmPin')}</Label>
          <Input id="cf-pin" {...pinProps} value={cf} onChange={(e) => setCf(e.target.value)} />
        </div>
      </div>
      {msg ? (
        <p className={msg.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>{msg.text}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!cur || !nw || !cf}>
          {t('settings.changePin')}
        </Button>
      </div>
    </form>
  )
}

function BranchManager() {
  const { t } = useTranslation()
  const { branches } = useBranch()
  const create = useCreateBranch()
  const rename = useRenameBranch()
  const del = useDeleteBranch()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {branches.map((b) => (
          <div key={b.id} className="flex items-center gap-2">
            <Input
              defaultValue={b.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== b.name) rename.mutate({ id: b.id, name: v })
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              aria-label={t('clients.delete')}
              onClick={() =>
                del.mutate(b.id, {
                  onSuccess: (r) => setError(r.ok ? '' : t('settings.branchDeleteError'))
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('settings.branchName')}
        />
        <Button
          disabled={!newName.trim()}
          onClick={() => create.mutate(newName.trim(), { onSuccess: () => setNewName('') })}
        >
          {t('settings.addBranch')}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const license = useLicenseStatus()
  const version = useAppVersion()
  const settingsQuery = useSettings()
  const setSetting = useSetSetting()
  const raw = settingsQuery.data

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t('nav.settings')}</h1>

      {raw ? (
        <Section title={t('settings.general')}>
          <Row label={t('settings.defaultCurrency')}>
            <select
              className={selectClass}
              value={raw['default_currency'] ?? 'UZS'}
              onChange={(e) => setSetting.mutate({ key: 'default_currency', value: e.target.value })}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Row>
        </Section>
      ) : null}

      <Section title={t('settings.security')}>
        <ChangePinForm />
      </Section>

      <Section title={t('settings.branches')}>
        <BranchManager />
      </Section>

      <DataBackup />

      {raw ? (
        <Section title={t('settings.whatsappTemplate')}>
          <div className="space-y-3">
            {(['ru', 'ky', 'uz'] as const).map((lang) => (
              <div key={lang} className="space-y-1.5">
                <Label>{lang.toUpperCase()}</Label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  defaultValue={raw[`wa_template_${lang}`] || defaultWaTemplate(lang)}
                  onBlur={(e) =>
                    setSetting.mutate({ key: `wa_template_${lang}`, value: e.target.value })
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t('settings.templateHint')}</p>
          </div>
        </Section>
      ) : null}

      <Section title={t('settings.about')}>
        <Row label={t('settings.version')}>
          <span className="font-mono text-sm">{version.data ?? '…'}</span>
        </Row>
        <Row label={t('settings.activationStatus')}>
          <span className="text-sm">{license.data?.activated ? t('settings.activated') : '—'}</span>
        </Row>
        <Row label={t('settings.notifications')}>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.api.notify(t('appName'), t('settings.testNotificationBody'))
            }
          >
            {t('settings.testNotification')}
          </Button>
        </Row>
        <div className="border-t border-border pt-4">
          <p className="text-sm font-medium">{t('settings.privacy')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('settings.privacyBody')}</p>
        </div>
      </Section>

      <Section title={t('settings.support')}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t('settings.supportBody')}</p>
          <Button
            className="shrink-0"
            onClick={() => window.open('https://t.me/talk2bahriddin_bot')}
          >
            <Send className="size-4" />
            {t('settings.contactTelegram')}
          </Button>
        </div>
      </Section>
    </div>
  )
}
