import { describe, expect, it } from 'vitest'
import { isReminderDue } from './reminderSchedule'

function localSec(y: number, m: number, d: number, h = 0, min = 0): number {
  return Math.floor(new Date(y, m - 1, d, h, min, 0, 0).getTime() / 1000)
}

describe('isReminderDue', () => {
  it('fires on first-ever run once today\'s scheduled time has passed (no prior send)', () => {
    expect(
      isReminderDue({
        lastSentSec: 0,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 10, 16, 0)
      })
    ).toBe(true)
  })

  it('does not fire on first-ever run before today\'s scheduled time', () => {
    expect(
      isReminderDue({
        lastSentSec: 0,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 10, 9, 0)
      })
    ).toBe(false)
  })

  it('is not due before the interval has elapsed', () => {
    const lastSentSec = localSec(2026, 1, 1, 15, 30)
    expect(
      isReminderDue({
        lastSentSec,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 4, 23, 0)
      })
    ).toBe(false)
  })

  it('is not due on the due day before the time-of-day guard passes', () => {
    const lastSentSec = localSec(2026, 1, 1, 15, 30)
    expect(
      isReminderDue({
        lastSentSec,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 5, 15, 0)
      })
    ).toBe(false)
  })

  it('is due once the interval has elapsed and the time-of-day guard has passed', () => {
    const lastSentSec = localSec(2026, 1, 1, 15, 30)
    expect(
      isReminderDue({
        lastSentSec,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 5, 15, 30)
      })
    ).toBe(true)
  })

  it('stays due on later days too, not just the exact due day', () => {
    const lastSentSec = localSec(2026, 1, 1, 15, 30)
    expect(
      isReminderDue({
        lastSentSec,
        intervalDays: 4,
        timeOfDay: '15:30',
        nowSec: localSec(2026, 1, 10, 9, 0)
      })
    ).toBe(true)
  })

  it('is due regardless of what time of day the previous send happened at', () => {
    const lastSentSec = localSec(2026, 1, 1, 23, 59)
    expect(
      isReminderDue({
        lastSentSec,
        intervalDays: 1,
        timeOfDay: '08:00',
        nowSec: localSec(2026, 1, 2, 8, 0)
      })
    ).toBe(true)
  })
})
