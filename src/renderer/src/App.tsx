import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui/toast'
import { ThemeProvider } from './app/ThemeProvider'
import { ActivationGate } from './app/ActivationGate'
import { LockGate } from './app/LockGate'
import { AppShell } from './app/AppShell'
import MainPage from './features/main/MainPage'
import TodayPaymentsPage from './features/main/TodayPaymentsPage'
import OverduePage from './features/main/OverduePage'
import ClientsPage from './features/clients/ClientsPage'
import SuppliersPage from './features/suppliers/SuppliersPage'
import StatisticsPage from './features/statistics/StatisticsPage'
import RemindersPage from './features/reminders/RemindersPage'
import SettingsPage from './features/settings/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <ActivationGate>
        <LockGate>
          <ToastProvider>
            <HashRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/main" replace />} />
                  <Route path="/main" element={<MainPage />} />
                  <Route path="/payments/today" element={<TodayPaymentsPage />} />
                  <Route path="/overdue" element={<OverduePage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientsPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/suppliers/:id" element={<SuppliersPage />} />
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/reminders" element={<RemindersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/main" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </ToastProvider>
        </LockGate>
      </ActivationGate>
    </ThemeProvider>
  )
}
