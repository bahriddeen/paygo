function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** unix seconds -> "YYYY-MM-DD" for <input type="date"> (local time). */
export function unixToDateInput(sec: number): string {
  const d = new Date(sec * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" -> unix seconds at local midnight. */
export function dateInputToUnix(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00`).getTime() / 1000)
}

/** "YYYY-MM-DD" + "HH:MM" -> unix seconds at that local date and time. */
export function dateTimeInputToUnix(date: string, time: string): number {
  return Math.floor(new Date(`${date}T${time || '00:00'}:00`).getTime() / 1000)
}

export function todayInput(): string {
  return unixToDateInput(Math.floor(Date.now() / 1000))
}

/** Current local time as "HH:MM" for <input type="time">. */
export function nowTimeInput(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Always "DD.MM.YYYY" — the shared convention across RU/KY/UZ. Intentionally
 * ignores `locale`/`toLocaleDateString`: Chromium's ICU data renders 'ky' as
 * "YYYY-DD-MM" (day/month swapped — misreadable for due dates) and 'uz' as
 * "DD/MM/YYYY", inconsistent with 'ru's "DD.MM.YYYY". A fixed format avoids
 * that. The `locale` param is kept so call sites don't need to change if a
 * locale-aware format is ever wanted for other conventions later.
 */
export function formatDate(sec: number, _locale?: string): string {
  const d = new Date(sec * 1000)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** Same convention as formatDate, with "HH:MM" appended — used where the
 *  time of day matters (payment history), not just the day. */
export function formatDateTime(sec: number, _locale?: string): string {
  const d = new Date(sec * 1000)
  return `${formatDate(sec)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Whole days from `fromSec` to `toSec` (negative if before). */
export function daysBetween(fromSec: number, toSec: number): number {
  return Math.floor((toSec - fromSec) / 86400)
}
