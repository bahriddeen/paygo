/** Keep only digits and a single decimal separator (comma normalised to dot). */
export function sanitizeAmountInput(value: string): string {
  let s = value.replace(/[^\d.,]/g, '').replace(/,/g, '.')
  const dot = s.indexOf('.')
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  }
  return s
}
