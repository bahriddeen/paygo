import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BranchProvider } from './BranchProvider'
import { SettingsProvider } from './SettingsProvider'
import { OverdueNotifier } from './OverdueNotifier'
import { ScheduledReminderRunner } from './ScheduledReminderRunner'
import { ScheduledReminderStatusProvider } from './ScheduledReminderStatus'

export function AppShell() {
  return (
    <BranchProvider>
      <SettingsProvider>
        <ScheduledReminderStatusProvider>
          <OverdueNotifier />
          <ScheduledReminderRunner />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-y-auto">
                <Outlet />
              </main>
            </div>
          </div>
        </ScheduledReminderStatusProvider>
      </SettingsProvider>
    </BranchProvider>
  )
}
