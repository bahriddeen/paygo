import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Lock, Store, ChevronDown, Info, Loader2, CircleCheck } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useBranch } from './BranchProvider'
import { useLock } from './LockGate'
import { useScheduledReminderStatus } from './ScheduledReminderStatus'
import { ScheduledReminderQueueModal } from './ScheduledReminderQueueModal'
import { LANGUAGES, setLanguage, type LanguageCode } from '@/lib/i18n'
import { useDemoStatus, useClearDemoData } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

const SECTION_ROUTES = ['/main', '/clients', '/suppliers', '/statistics', '/reminders', '/settings']
const SECTION_KEYS = ['nav.main', 'nav.clients', 'nav.suppliers', 'nav.statistics', 'nav.reminders', 'nav.settings']

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const modLabel = isMac ? '⌘' : 'Ctrl'

export function TopBar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { branches, activeBranchId, setActiveBranchId } = useBranch()
  const { canLock, lock } = useLock()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const demoStatus = useDemoStatus()
  const clearDemo = useClearDemoData()
  const { status: reminderBatch } = useScheduledReminderStatus()
  const [reminderQueueOpen, setReminderQueueOpen] = useState(false)

  useEffect(() => {
    if (reminderBatch.phase === 'idle') setReminderQueueOpen(false)
  }, [reminderBatch.phase])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        navigate('/main?new=1')
      } else if (key === 'l') {
        if (canLock) {
          e.preventDefault()
          lock()
        }
      } else if (key === '/') {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
      } else if (/^[1-6]$/.test(key)) {
        e.preventDefault()
        navigate(SECTION_ROUTES[Number(key) - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, lock, canLock])

  const shortcuts: { keys: string; label: string }[] = [
    { keys: `${modLabel}+N`, label: t('common.newTransaction') },
    ...(canLock ? [{ keys: `${modLabel}+L`, label: t('common.lock') }] : []),
    ...SECTION_ROUTES.map((_, i) => ({
      keys: `${modLabel}+${i + 1}`,
      label: t(SECTION_KEYS[i])
    })),
    { keys: `${modLabel}+/`, label: t('shortcuts.toggleHelp') },
    { keys: 'Esc', label: t('shortcuts.closeDialog') }
  ]

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6">
      {/* Branch switcher — prominent because branches are siloed */}
      <label className="relative inline-flex items-center">
        <Store className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
        <select
          aria-label={t('common.branch')}
          value={activeBranchId ?? ''}
          onChange={(e) => setActiveBranchId(Number(e.target.value))}
          className="h-9 min-w-48 appearance-none rounded-md border border-input bg-background pl-9 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        {reminderBatch.phase === 'sending' ? (
          <button
            type="button"
            onClick={() => setReminderQueueOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Loader2 className="size-3.5 animate-spin" />
            {t('reminders.queueProgress', { current: reminderBatch.sent, total: reminderBatch.total })}
          </button>
        ) : reminderBatch.phase === 'done' ? (
          <button
            type="button"
            onClick={() => setReminderQueueOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <CircleCheck className="size-3.5 text-primary" />
            {t('reminders.scheduledSendNotifyBody', {
              ok: reminderBatch.sentOk,
              fail: reminderBatch.sentFail
            })}
          </button>
        ) : null}

        {demoStatus.data?.hasDemoData ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={clearDemo.isPending}
            title={t('common.startFreshHint')}
            onClick={() => clearDemo.mutate()}
          >
            {t('common.startFresh')}
          </Button>
        ) : null}

        <select
          aria-label={t('common.language')}
          value={i18n.language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="h-9 appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>

        <Button variant="ghost" size="icon" aria-label={t('common.theme')} onClick={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t('shortcuts.title')}
          onClick={() => setShortcutsOpen(true)}
        >
          <Info />
        </Button>

        {canLock ? (
          <Button variant="outline" size="sm" onClick={lock}>
            <Lock className="size-4" />
            {t('common.lock')}
          </Button>
        ) : null}
      </div>

      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title={t('shortcuts.title')}>
        <ul className="space-y-2">
          {shortcuts.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </Modal>

      {reminderQueueOpen ? (
        <ScheduledReminderQueueModal onClose={() => setReminderQueueOpen(false)} />
      ) : null}
    </header>
  )
}
