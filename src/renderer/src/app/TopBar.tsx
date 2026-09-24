import { useTranslation } from 'react-i18next'
import { Moon, Sun, Lock, Store, ChevronDown } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useBranch } from './BranchProvider'
import { useLock } from './LockGate'
import { LANGUAGES, setLanguage, type LanguageCode } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function TopBar() {
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const { branches, activeBranchId, setActiveBranchId } = useBranch()
  const { canLock, lock } = useLock()

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

        {canLock ? (
          <Button variant="outline" size="sm" onClick={lock}>
            <Lock className="size-4" />
            {t('common.lock')}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
