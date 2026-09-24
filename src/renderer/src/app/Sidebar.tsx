import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Users, Truck, ChartColumn, Bell, Settings, NotebookText } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/main', icon: Home, key: 'nav.main' },
  { to: '/clients', icon: Users, key: 'nav.clients' },
  { to: '/suppliers', icon: Truck, key: 'nav.suppliers' },
  { to: '/statistics', icon: ChartColumn, key: 'nav.statistics' },
  { to: '/reminders', icon: Bell, key: 'nav.reminders' },
  { to: '/settings', icon: Settings, key: 'nav.settings' }
] as const

export function Sidebar() {
  const { t } = useTranslation()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <NotebookText className="size-5" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Qarz Daftari</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {ITEMS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="size-[18px]" />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
