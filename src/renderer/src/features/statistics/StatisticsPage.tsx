import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartColumn, Users } from 'lucide-react'
import { useBranch } from '@/app/BranchProvider'
import { useAppSettings } from '@/app/SettingsProvider'
import { useDashboard, useDebtSeries, useTopDebtors } from '@/lib/api'
import { CURRENCY_CODES, formatMoney, type CurrencyCode } from '@/lib/format'
import { dateInputToUnix, todayInput } from '@/lib/date'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { DebtChart } from './DebtChart'

const DAY = 86400
const selectClass =
  'h-9 appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Preset = 'today' | '7' | '30' | '90' | 'custom'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'stats.rangeToday' },
  { key: '7', label: 'stats.range7' },
  { key: '30', label: 'stats.range30' },
  { key: '90', label: 'stats.range90' },
  { key: 'custom', label: 'stats.custom' }
]

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="flex-1 px-6 py-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-semibold tabular-nums',
          tone === 'danger' && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  )
}

export default function StatisticsPage() {
  const { t } = useTranslation()
  const { activeBranchId } = useBranch()
  const { defaultCurrency } = useAppSettings()
  const branchId = activeBranchId ?? undefined
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency)
  const [preset, setPreset] = useState<Preset>('30')
  const [customFrom, setCustomFrom] = useState(todayInput())
  const [customTo, setCustomTo] = useState(todayInput())

  const now = Math.floor(Date.now() / 1000)
  let from: number
  let to: number
  if (preset === 'custom') {
    from = dateInputToUnix(customFrom)
    to = dateInputToUnix(customTo) + DAY
  } else if (preset === 'today') {
    from = startOfToday()
    to = now + DAY
  } else {
    from = now - Number(preset) * DAY
    to = now + DAY
  }

  const dash = useDashboard(branchId)
  const series = useDebtSeries(branchId ? { branchId, currency, from, to } : undefined)
  const top = useTopDebtors(branchId ? { branchId, currency, limit: 8 } : undefined)

  const owed = dash.data?.outstanding.find((a) => a.currency === currency)?.amount ?? 0
  const overdue = dash.data?.overdue.find((a) => a.currency === currency)?.amount ?? 0
  const debtors = dash.data?.outstandingClients ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.statistics')}</h1>
        <select
          aria-label={t('tx.currency')}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          className={selectClass}
        >
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {/* Range presets */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              preset === p.key
                ? 'border-primary bg-secondary text-secondary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            {t(p.label)}
          </button>
        ))}
        {preset === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={selectClass}
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={selectClass}
            />
          </div>
        ) : null}
      </div>

      <section className="flex divide-x divide-border overflow-hidden rounded-lg border border-border bg-card">
        <StatCell label={t('stats.owed')} value={formatMoney(owed, currency)} />
        <StatCell label={t('stats.debtors')} value={String(debtors)} />
        <StatCell label={t('stats.overdue')} value={formatMoney(overdue, currency)} tone="danger" />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{t('stats.dynamics')}</h2>
        <div className="rounded-lg border border-border bg-card p-4">
          {series.data && series.data.length > 0 ? (
            <DebtChart data={series.data} currency={currency} />
          ) : (
            <EmptyState icon={ChartColumn} title={t('stats.noData')} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{t('stats.topDebtors')}</h2>
        <div className="rounded-lg border border-border bg-card">
          {top.data && top.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {top.data.map((d, i) => (
                <li key={d.client_id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-5 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium">{d.name}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatMoney(d.remaining, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title={t('stats.noData')} />
          )}
        </div>
      </section>
    </div>
  )
}
