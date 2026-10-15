import { unixToDateInput } from './date'

const MAX_DUE_DAYS = 3650

export function fillTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? '')
}

/** Settings value -> whole days from today for the default due date (0 = today). */
export function parseDueDays(raw: string | null | undefined): number {
  const n = parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, MAX_DUE_DAYS)
}

/** "YYYY-MM-DD" for <input type="date">: `days` after today (local time). */
export function defaultDueInput(days: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return unixToDateInput(Math.floor(d.getTime() / 1000))
}

/** A phone field that still holds only the prefix means nothing was typed. */
export function normalizePhone(phone: string, prefix: string): string {
  const p = phone.trim()
  return p === prefix.trim() ? '' : p
}

export function shouldAutoSend(args: {
  enabled: boolean
  direction: 'lend' | 'borrow'
  clientKind: 'client' | 'supplier'
  phone: string | null
}): boolean {
  return (
    args.enabled &&
    args.direction === 'lend' &&
    args.clientKind === 'client' &&
    !!args.phone?.trim()
  )
}

export function buildDirectMessage(
  template: string,
  vars: { name: string; amount: string; dueDate: string; note: string }
): string {
  return fillTemplate(template, vars).trim()
}
