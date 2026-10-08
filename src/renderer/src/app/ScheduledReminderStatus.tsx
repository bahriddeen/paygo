import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

export interface ScheduledReminderQueueItem {
  client_id: number
  name: string
  phone: string
}

export type ScheduledReminderStatus =
  | { phase: 'idle' }
  | {
      phase: 'sending'
      items: ScheduledReminderQueueItem[]
      results: (boolean | null)[]
      sent: number
      total: number
    }
  | {
      phase: 'done'
      items: ScheduledReminderQueueItem[]
      results: (boolean | null)[]
      sentOk: number
      sentFail: number
      total: number
      cancelled: boolean
    }

interface Ctx {
  status: ScheduledReminderStatus
  setStatus: Dispatch<SetStateAction<ScheduledReminderStatus>>
}

const ScheduledReminderStatusContext = createContext<Ctx>({
  status: { phase: 'idle' },
  setStatus: () => {}
})

/** Read-only access to the recurring-reminder batch status, for the TopBar pill. */
// eslint-disable-next-line react-refresh/only-export-components
export function useScheduledReminderStatus(): Ctx {
  return useContext(ScheduledReminderStatusContext)
}

/**
 * Shared across TopBar (reads it to render a pill + open the details modal)
 * and ScheduledReminderRunner (writes it as the auto-send batch progresses)
 * — the scheduled send has no modal of its own otherwise, so this is the
 * only visibility into it while it runs.
 */
export function ScheduledReminderStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ScheduledReminderStatus>({ phase: 'idle' })
  return (
    <ScheduledReminderStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </ScheduledReminderStatusContext.Provider>
  )
}
