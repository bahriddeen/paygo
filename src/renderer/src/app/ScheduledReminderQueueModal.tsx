import { BatchProgressModal } from '@/features/reminders/BatchProgressModal'
import { useScheduledReminderStatus } from './ScheduledReminderStatus'

/** Opened from the TopBar pill — shows the in-flight (or just-finished) recurring send. */
export function ScheduledReminderQueueModal({ onClose }: { onClose: () => void }) {
  const { status } = useScheduledReminderStatus()
  if (status.phase === 'idle') return null

  const done = status.phase === 'done'
  const sent = status.phase === 'sending' ? status.sent : status.total

  return (
    <BatchProgressModal
      items={status.items.map((i) => ({ key: i.client_id, name: i.name }))}
      results={status.results}
      sent={sent}
      total={status.total}
      done={done}
      cancelled={status.phase === 'done' && status.cancelled}
      sentOk={status.phase === 'done' ? status.sentOk : 0}
      sentFail={status.phase === 'done' ? status.sentFail : 0}
      onCancel={() => void window.api.whatsapp.cancelBatch()}
      onClose={onClose}
    />
  )
}
