import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, MessageCircle } from 'lucide-react'
import { useAppSettings } from './SettingsProvider'
import { useWhatsAppConnection } from '@/lib/useWhatsApp'
import { cn } from '@/lib/utils'

/**
 * Always-visible WhatsApp connection state (when the feature is enabled), so
 * a dropped session is noticed before a reminder or auto-send silently
 * doesn't go out. Click → Settings, where the connect/QR controls live.
 */
export function WhatsAppStatusPill() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { raw: settings } = useAppSettings()
  const { status } = useWhatsAppConnection()

  if (settings['whatsapp_enabled'] !== '1') return null

  const state = status.connected ? 'connected' : status.connecting ? 'connecting' : 'disconnected'
  const label =
    state === 'connected'
      ? t('settings.waStatusConnected')
      : state === 'connecting'
        ? t('settings.waStatusConnecting')
        : t('settings.waStatusDisconnected')

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-wa-state={state}
      onClick={() => navigate('/settings')}
      className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
    >
      {state === 'connecting' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <MessageCircle className="size-3.5" />
      )}
      WhatsApp
      <span
        className={cn(
          'size-2 rounded-full',
          state === 'connected' && 'bg-emerald-500',
          state === 'connecting' && 'bg-amber-500',
          state === 'disconnected' && 'bg-rose-500'
        )}
      />
    </button>
  )
}
