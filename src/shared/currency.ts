export type CurrencyCode = 'KGS' | 'USD' | 'UZS'

// Amounts are stored as INTEGER minor units. som/so'm are used as whole
// numbers in shops; USD keeps cents.
export const CURRENCIES: Record<CurrencyCode, { decimals: number; label: string }> = {
  UZS: { decimals: 0, label: "so'm" },
  KGS: { decimals: 0, label: 'сом' },
  USD: { decimals: 2, label: '$' }
}

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]

/** Convert a user-entered major amount (e.g. 12.50 USD, 150000 UZS) to integer minor units. */
export function toMinor(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** CURRENCIES[currency].decimals)
}

/** Format an integer minor-unit amount, e.g. formatMoney(150000, 'UZS') -> "150 000 UZS". */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  const { decimals } = CURRENCIES[currency]
  const value = minor / 10 ** decimals
  const num = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
  return `${num} ${currency}`
}
