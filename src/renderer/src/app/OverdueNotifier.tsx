import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranch } from './BranchProvider'
import { useTransactions } from '@/lib/api'

/**
 * Fires a native OS notification once per session if the active branch has
 * overdue debts. Renders nothing. (No background process — only while running.)
 */
export function OverdueNotifier() {
  const { t } = useTranslation()
  const { activeBranchId } = useBranch()
  const overdue = useTransactions(
    activeBranchId ? { branchId: activeBranchId, overdue: true } : undefined
  )
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !overdue.data) return
    const count = overdue.data.length
    if (count > 0) {
      fired.current = true
      void window.api.notify(t('reminders.notifyTitle'), t('reminders.notifyBody', { count }))
    }
  }, [overdue.data, t])

  return null
}
