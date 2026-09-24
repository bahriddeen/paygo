import { createContext, useContext, type ReactNode } from 'react'
import { useSettings } from '@/lib/api'
import type { CurrencyCode } from '@/lib/format'

interface SettingsValue {
  defaultCurrency: CurrencyCode
  waTemplate: (lang: string, fallback: string) => string
  raw: Record<string, string | null>
}

const SettingsContext = createContext<SettingsValue>({
  defaultCurrency: 'UZS',
  waTemplate: (_lang, fallback) => fallback,
  raw: {}
})

// eslint-disable-next-line react-refresh/only-export-components
export function useAppSettings(): SettingsValue {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const q = useSettings()
  const raw = q.data ?? {}
  const dc = raw['default_currency']
  const defaultCurrency: CurrencyCode = dc === 'KGS' || dc === 'USD' || dc === 'UZS' ? dc : 'UZS'
  const waTemplate = (lang: string, fallback: string): string =>
    raw[`wa_template_${lang}`] || fallback

  return (
    <SettingsContext.Provider value={{ defaultCurrency, waTemplate, raw }}>
      {children}
    </SettingsContext.Provider>
  )
}
