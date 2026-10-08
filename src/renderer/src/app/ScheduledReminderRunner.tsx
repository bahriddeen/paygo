import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranch } from './BranchProvider'
import { useAppSettings } from './SettingsProvider'
import { useSetSetting } from '@/lib/api'
import { useWhatsAppConnection } from '@/lib/useWhatsApp'
import { formatMoney } from '@/lib/format'
import { useDebtorGroups } from '@/features/reminders/useDebtorGroups'
import { MIN_DELAY_SEC, MAX_DELAY_SEC } from '@/features/reminders/AutoSendQueue'
import { isReminderDue } from '@/lib/reminderSchedule'
import { useScheduledReminderStatus } from './ScheduledReminderStatus'
import type { BatchDone, BatchProgress } from '@/lib/api'

const DONE_PILL_VISIBLE_MS = 8_000

/**
 * Fires the recurring WhatsApp reminder batch once per session if a schedule
 * is enabled and due. The app has no background process, so "due" is
 * evaluated whenever this mounts (app launch) rather than at an exact
 * wall-clock time — see CLAUDE.md / plan notes on maybeAutoBackup for the
 * same trade-off applied to backups. Renders nothing itself — progress is
 * published to ScheduledReminderStatus for the TopBar pill + detail modal.
 */
export function ScheduledReminderRunner() {
  const { t } = useTranslation()
  const { activeBranchId } = useBranch()
  const { raw: settings } = useAppSettings()
  const setSetting = useSetSetting()
  const { status: waStatus } = useWhatsAppConnection()
  const { groups, isLoading, buildMessage } = useDebtorGroups(activeBranchId)
  const { setStatus } = useScheduledReminderStatus()
  const fired = useRef(false)
  // Only notify for a batch *we* started — RemindersPage's manual "remind
  // all" also uses whatsapp:sendBatch and shows its own in-modal progress,
  // so a global onBatchDone listener must not double-notify for that one.
  const awaitingOwnBatch = useRef(false)

  useEffect(() => {
    if (fired.current || isLoading) return

    const enabled = settings['reminder_schedule_enabled'] === '1'
    if (!enabled) return
    if (!waStatus.connected) return

    const lastSentSec = Number(settings['reminder_schedule_last_sent'] ?? '0')
    const intervalDays = Number(settings['reminder_schedule_interval_days'] ?? '4')
    const timeOfDay = settings['reminder_schedule_time'] ?? '09:00'
    const due = isReminderDue({
      lastSentSec,
      intervalDays,
      timeOfDay,
      nowSec: Math.floor(Date.now() / 1000)
    })
    if (!due) return

    fired.current = true
    const debtors = groups.filter((g) => g.phone)

    setSetting.mutate({
      key: 'reminder_schedule_last_sent',
      value: String(Math.floor(Date.now() / 1000))
    })
    if (debtors.length > 0) {
      awaitingOwnBatch.current = true
      setStatus({
        phase: 'sending',
        items: debtors.map((g) => ({ client_id: g.client_id, name: g.name, phone: g.phone as string })),
        results: debtors.map(() => null),
        sent: 0,
        total: debtors.length
      })
      void window.api.whatsapp.sendBatch(
        debtors.map((g) => ({ phone: g.phone as string, message: buildMessage(g, formatMoney), name: g.name })),
        MIN_DELAY_SEC,
        MAX_DELAY_SEC
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, settings, waStatus.connected, groups])

  useEffect(() => {
    const offProgress = window.api.whatsapp.onBatchProgress((p: BatchProgress) => {
      if (!awaitingOwnBatch.current) return
      setStatus((prev) => {
        if (prev.phase !== 'sending') return prev
        const results = [...prev.results]
        results[p.sent - 1] = p.ok
        return { ...prev, results, sent: p.sent }
      })
    })
    const offDone = window.api.whatsapp.onBatchDone((d: BatchDone) => {
      if (!awaitingOwnBatch.current) return
      awaitingOwnBatch.current = false
      if (d.cancelled) {
        setStatus({ phase: 'idle' })
        return
      }
      setStatus((prev) => ({
        phase: 'done',
        items: prev.phase === 'sending' ? prev.items : [],
        results: prev.phase === 'sending' ? prev.results : [],
        sentOk: d.sentOk,
        sentFail: d.sentFail,
        total: d.total,
        cancelled: d.cancelled
      }))
      setTimeout(() => setStatus({ phase: 'idle' }), DONE_PILL_VISIBLE_MS)
      void window.api.notify(
        t('reminders.scheduledSendNotifyTitle'),
        t('reminders.scheduledSendNotifyBody', { ok: d.sentOk, fail: d.sentFail })
      )
    })
    return () => {
      offProgress()
      offDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  return null
}
