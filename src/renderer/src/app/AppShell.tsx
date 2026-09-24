import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BranchProvider } from './BranchProvider'
import { SettingsProvider } from './SettingsProvider'
import { OverdueNotifier } from './OverdueNotifier'

export function AppShell() {
  return (
    <BranchProvider>
      <SettingsProvider>
        <OverdueNotifier />
        <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SettingsProvider>
    </BranchProvider>
  )
}
