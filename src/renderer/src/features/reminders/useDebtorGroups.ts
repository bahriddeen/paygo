import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettings } from '@/app/SettingsProvider'
import { useTransactions, type ClientKind } from '@/lib/api'
import { type CurrencyCode } from '@/lib/format'
import { daysBetween } from '@/lib/date'
import { fillTemplate } from '@/lib/directSend'

export interface DebtorGroup {
  client_id: number
  name: string
  phone: string | null
  kind: ClientKind
  amounts: { currency: CurrencyCode; amount: number }[]
  maxDays: number
}

export function amountsStr(
  g: DebtorGroup,
  formatMoney: (amount: number, currency: CurrencyCode) => string
): string {
  return g.amounts.map((a) => formatMoney(a.amount, a.currency)).join(', ')
}

/**
 * Debtors with an overdue `lend` balance, grouped per client — shared by the
 * manual "remind all" flow (RemindersPage) and the recurring auto-send
 * (ScheduledReminderRunner) so both agree on who counts as a debtor.
 */
export function useDebtorGroups(branchId: number | null): {
  groups: DebtorGroup[]
  isLoading: boolean
  buildMessage: (g: DebtorGroup, formatMoney: (amount: number, currency: CurrencyCode) => string) => string
} {
  const { t, i18n } = useTranslation()
  const { raw: settings } = useAppSettings()
  const overdue = useTransactions(branchId ? { branchId, overdue: true } : undefined)

  const groups = useMemo<DebtorGroup[]>(() => {
    const now = Math.floor(Date.now() / 1000)
    const map = new Map<number, DebtorGroup>()
    for (const tx of overdue.data ?? []) {
      let g = map.get(tx.client_id)
      if (!g) {
        g = {
          client_id: tx.client_id,
          name: tx.client_name,
          phone: tx.client_phone,
          kind: tx.client_kind,
          amounts: [],
          maxDays: 0
        }
        map.set(tx.client_id, g)
      }
      const found = g.amounts.find((a) => a.currency === tx.currency)
      if (found) found.amount += tx.remaining
      else g.amounts.push({ currency: tx.currency, amount: tx.remaining })
      if (tx.due_at) g.maxDays = Math.max(g.maxDays, daysBetween(tx.due_at, now))
    }
    return [...map.values()]
  }, [overdue.data])

  const buildMessage = (
    g: DebtorGroup,
    formatMoney: (amount: number, currency: CurrencyCode) => string
  ): string => {
    const vars = { name: g.name, amount: amountsStr(g, formatMoney), days: String(g.maxDays) }
    const stored = settings[`wa_template_${i18n.language}`]
    return stored ? fillTemplate(stored, vars) : t('reminders.waTemplate', vars)
  }

  return { groups, isLoading: overdue.isLoading, buildMessage }
}
