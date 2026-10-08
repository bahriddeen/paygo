/** Unix seconds for local midnight of the day containing `sec`. */
function startOfDaySec(sec: number): number {
  const d = new Date(sec * 1000)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

/**
 * Whether a recurring reminder is due, given the app can only check this
 * "is it due?" question when it happens to be open (no background process) —
 * see ScheduledReminderRunner. `lastSentSec === 0` means it has never sent
 * before, so there's no interval to measure from — it's due as soon as
 * today's scheduled time has passed (not "one interval after enabling"),
 * so a schedule enabled after its configured time fires right away instead
 * of waiting a full interval.
 */
export function isReminderDue(opts: {
  lastSentSec: number
  intervalDays: number
  timeOfDay: string
  nowSec: number
}): boolean {
  const { lastSentSec, intervalDays, timeOfDay, nowSec } = opts
  const [hours, minutes] = timeOfDay.split(':').map(Number)

  if (lastSentSec <= 0) {
    const todayAtSec = startOfDaySec(nowSec) + hours * 3600 + minutes * 60
    return nowSec >= todayAtSec
  }

  const dueDayStart = startOfDaySec(lastSentSec) + intervalDays * 86400
  const dueAtSec = dueDayStart + hours * 3600 + minutes * 60

  return nowSec >= dueAtSec
}
