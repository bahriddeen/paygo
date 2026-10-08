import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Send, AlertTriangle } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import {
  useLicenseStatus,
  useAppVersion,
  useCreateBranch,
  useRenameBranch,
  useDeleteBranch,
  useSettings,
  useSetSetting,
  useResetAccount
} from '@/lib/api'
import { CURRENCY_CODES } from '@/lib/format'
import { defaultWaTemplate } from '@/lib/i18n'
import { useWhatsAppConnection } from '@/lib/useWhatsApp'
import { formatDate } from '@/lib/date'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { PinField } from '@/components/PinField'
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

function WhatsAppConnection() {
  const { t } = useTranslation()
  const { status, qr, connect, logout } = useWhatsAppConnection()

  if (status.connected) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2">
        <div>
          <p className="text-sm font-medium">{t('settings.waConnected')}</p>
          <p className="font-mono text-xs text-muted-foreground">{status.phone}</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          {t('settings.waDisconnect')}
        </Button>
      </div>
    )
  }

  const errorText =
    status.error === 'timeout'
      ? t('settings.waErrorTimeout')
      : status.error === 'connection_failed'
        ? t('settings.waErrorFailed')
        : status.error
          ? t('settings.waErrorGeneric')
          : null

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{t('settings.waNotConnected')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.waConnectHint')}</p>
        </div>
        {!qr ? (
          <Button size="sm" className="shrink-0" onClick={connect} disabled={status.connecting}>
            {status.connecting ? t('settings.waConnecting') : t('settings.waConnect')}
          </Button>
        ) : null}
      </div>
      {qr ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <img src={qr} alt="QR" className="size-48 rounded-md border border-border" />
          <p className="text-center text-xs text-muted-foreground">{t('settings.waScanHint')}</p>
        </div>
      ) : null}
      {errorText ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p className="text-xs text-destructive">{errorText}</p>
          <Button variant="outline" size="sm" className="shrink-0" onClick={logout}>
            {t('settings.waReset')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ScheduleReminderSettings({
  raw,
  setSetting
}: {
  raw: Record<string, string | null>
  setSetting: ReturnType<typeof useSetSetting>
}) {
  const { t, i18n } = useTranslation()
  const { status: waStatus } = useWhatsAppConnection()

  if (!waStatus.connected) return null

  const enabled = raw['reminder_schedule_enabled'] === '1'
  const intervalDays = raw['reminder_schedule_interval_days'] || '4'
  const time = raw['reminder_schedule_time'] || '09:00'
  const lastSent = Number(raw['reminder_schedule_last_sent'] ?? '0')

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setSetting.mutate({
              key: 'reminder_schedule_enabled',
              value: e.target.checked ? '1' : '0'
            })
            // Clearing last_sent on disable means re-enabling is treated as a
            // first-ever run (fires once today's time has passed) instead of
            // waiting out the interval from whenever it was last turned on —
            // this is also how a user forces a resend without a dedicated button.
            if (!e.target.checked) {
              setSetting.mutate({ key: 'reminder_schedule_last_sent', value: '0' })
            }
          }}
          className="size-4 rounded border-input"
        />
        {t('settings.scheduleReminderEnabled')}
      </label>
      <p className="text-xs text-muted-foreground">{t('settings.scheduleReminderHint')}</p>
      {enabled ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>{t('settings.scheduleIntervalLabel')}</Label>
            <Input
              type="number"
              min={1}
              max={30}
              defaultValue={intervalDays}
              className="w-24"
              onBlur={(e) =>
                setSetting.mutate({
                  key: 'reminder_schedule_interval_days',
                  value: String(Math.min(30, Math.max(1, Number(e.target.value) || 1)))
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('settings.scheduleTimeLabel')}</Label>
            <Input
              type="time"
              defaultValue={time}
              className="w-32"
              onBlur={(e) =>
                setSetting.mutate({ key: 'reminder_schedule_time', value: e.target.value })
              }
            />
          </div>
          {lastSent ? (
            <p className="text-xs text-muted-foreground">
              {t('settings.scheduleLastSent', { date: formatDate(lastSent, i18n.language) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DeleteAccountSection() {
  const { t } = useTranslation()
  const reset = useResetAccount()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)

  function close(): void {
    if (resetting) return // don't let them dismiss mid-reset
    setOpen(false)
    setError('')
  }

  function handlePin(pin: string): void {
    setError('')
    reset.mutate(pin, {
      onSuccess: (r) => {
        if (r.ok) setResetting(true) // app quits + relaunches itself momentarily
        else setError(t('settings.deleteAccountWrongPin'))
      },
      onError: () => setError(t('settings.deleteAccountWrongPin'))
    })
  }

  return (
    <section className="rounded-lg border border-destructive/40 bg-card">
      <h2 className="flex items-center gap-2 border-b border-destructive/40 px-5 py-3 text-sm font-semibold text-destructive">
        <AlertTriangle className="size-4" />
        {t('settings.dangerZone')}
      </h2>
      <div className="flex items-center justify-between gap-4 p-5">
        <p className="text-sm text-muted-foreground">{t('settings.deleteAccountHint')}</p>
        <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          {t('settings.deleteAccountButton')}
        </Button>
      </div>

      <Modal open={open} onClose={close} title={t('settings.deleteAccountButton')}>
        {resetting ? (
          <p className="text-sm text-muted-foreground">{t('settings.deleteAccountResetting')}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-destructive">
              {t('settings.deleteAccountWarning')}
            </p>
            <p className="text-sm text-muted-foreground">{t('settings.deleteAccountPrompt')}</p>
            <PinField onComplete={handlePin} error={error} onChange={() => setError('')} />
          </div>
        )}
      </Modal>
    </section>
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
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={raw['whatsapp_enabled'] === '1'}
                onChange={(e) =>
                  setSetting.mutate({
                    key: 'whatsapp_enabled',
                    value: e.target.checked ? '1' : '0'
                  })
                }
                className="size-4 rounded border-input"
              />
              {t('settings.whatsappEnabled')}
            </label>
            <p className="text-xs text-muted-foreground">{t('settings.whatsappEnabledHint')}</p>
            {raw['whatsapp_enabled'] === '1' ? (
              <div className="space-y-3 border-t border-border pt-4">
                <WhatsAppConnection />
              </div>
            ) : null}
            {raw['whatsapp_enabled'] === '1' ? (
              <ScheduleReminderSettings raw={raw} setSetting={setSetting} />
            ) : null}
            {raw['whatsapp_enabled'] === '1' ? (
              <div className="space-y-3 border-t border-border pt-4">
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
            ) : null}
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

      <DeleteAccountSection />
    </div>
  )
}
