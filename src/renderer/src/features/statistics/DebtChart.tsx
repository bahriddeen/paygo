import { useTranslation } from 'react-i18next'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { useTheme } from '@/app/ThemeProvider'
import { CURRENCIES, type CurrencyCode } from '@/lib/format'
import type { DebtSeriesPoint } from '@/lib/api'

// Validated categorical pairs (see dataviz validator): CVD ΔE >= 30 in both modes.
const LIGHT = { lent: '#b45309', paid: '#0f7a54', axis: '#5b6b62', grid: '#e2e6e1' }
const DARK = { lent: '#c07d2a', paid: '#33ac80', axis: '#8a949b', grid: '#242a2e' }

export function DebtChart({ data, currency }: { data: DebtSeriesPoint[]; currency: CurrencyCode }) {
  const { t, i18n } = useTranslation()
  const { theme } = useTheme()
  const c = theme === 'dark' ? DARK : LIGHT
  const decimals = CURRENCIES[currency].decimals

  const fmtDate = (d: string): string => {
    const parts = String(d).split('-')
    return `${parts[2]}.${parts[1]}`
  }
  const fmtCompact = (v: number): string =>
    new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(
      v / 10 ** decimals
    )
  const fmtFull = (v: number): string =>
    `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(v / 10 ** decimals)} ${currency}`

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: c.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={fmtCompact}
          tick={{ fill: c.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: theme === 'dark' ? '#161a1d' : '#ffffff',
            border: `1px solid ${c.grid}`,
            borderRadius: 8,
            fontSize: 12,
            color: theme === 'dark' ? '#e6eaec' : '#16211c'
          }}
          labelFormatter={(label) => fmtDate(String(label))}
          formatter={(value, name) =>
            [fmtFull(Number(value)), name === 'lent' ? t('stats.lent') : t('stats.paid')] as [
              string,
              string
            ]
          }
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (value === 'lent' ? t('stats.lent') : t('stats.paid'))}
        />
        <Line type="monotone" dataKey="lent" stroke={c.lent} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="paid" stroke={c.paid} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
