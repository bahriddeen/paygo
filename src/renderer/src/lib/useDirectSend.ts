import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast'
import { useAppSettings } from '@/app/SettingsProvider'
import { formatMoney } from '@/lib/format'
import { formatDate } from '@/lib/date'
import { defaultDirectTemplate } from '@/lib/i18n'
import { buildDirectMessage, shouldAutoSend } from '@/lib/directSend'
import type { Client, Transaction } from '@/lib/api'

/**
 * Returns a function that WhatsApps the client about a just-created `lend`
 * transaction (when the setting is on, WhatsApp is connected, and the
 * client has a phone). The transaction is already saved, so a failed send
 * only shows a toast; it never affects the transaction.
 */
export function useDirectSend(): (tx: Transaction, client: Client | undefined) => void {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { raw: settings } = useAppSettings()

  return (tx, client) => {
    if (!client) return
    const enabled = settings['whatsapp_enabled'] === '1' && settings['wa_direct_send_enabled'] === '1'
    if (
      !shouldAutoSend({
        enabled,
        direction: tx.direction,
        clientKind: client.kind,
        phone: client.phone
      })
    )
      return

    const lang = i18n.language
    const template = settings[`wa_direct_template_${lang}`] || defaultDirectTemplate(lang)
    const message = buildDirectMessage(template, {
      name: client.name,
      amount: formatMoney(tx.amount, tx.currency),
      dueDate: tx.due_at ? formatDate(tx.due_at, lang) : '',
      note: tx.description ?? ''
    })
    const fail = (): void => toast.pushError(t('toast.directSendFailed', { name: client.name }))
    window.api.whatsapp
      .sendDirect({ phone: client.phone as string, message, name: client.name })
      .then((r) => {
        if (!r.ok) fail()
      })
      .catch(fail)
  }
}
