import { describe, expect, it } from 'vitest'
import {
  buildDirectMessage,
  defaultDueInput,
  fillTemplate,
  normalizePhone,
  parseDueDays,
  shouldAutoSend
} from './directSend'

describe('parseDueDays', () => {
  it('defaults to 0 (today) for missing or invalid values', () => {
    expect(parseDueDays(null)).toBe(0)
    expect(parseDueDays(undefined)).toBe(0)
    expect(parseDueDays('')).toBe(0)
    expect(parseDueDays('abc')).toBe(0)
    expect(parseDueDays('-3')).toBe(0)
  })
  it('parses whole days and clamps the upper bound', () => {
    expect(parseDueDays('7')).toBe(7)
    expect(parseDueDays('99999')).toBe(3650)
  })
})

describe('defaultDueInput', () => {
  const now = new Date(2026, 0, 30, 15, 0, 0) // 30 Jan 2026, local
  it('is today for 0 days', () => {
    expect(defaultDueInput(0, now)).toBe('2026-01-30')
  })
  it('adds days across month boundaries', () => {
    expect(defaultDueInput(3, now)).toBe('2026-02-02')
  })
})

describe('normalizePhone', () => {
  it('turns a bare prefix into empty (nothing was typed)', () => {
    expect(normalizePhone('+998', '+998')).toBe('')
    expect(normalizePhone('  +998 ', '+998')).toBe('')
  })
  it('keeps real numbers and trims them', () => {
    expect(normalizePhone(' +998901234567 ', '+998')).toBe('+998901234567')
  })
  it('turns blank into empty', () => {
    expect(normalizePhone('   ', '')).toBe('')
  })
})

describe('shouldAutoSend', () => {
  const ok = { enabled: true, direction: 'lend', clientKind: 'client', phone: '+998901234567' } as const
  it('sends for a lend to a client with a phone', () => {
    expect(shouldAutoSend(ok)).toBe(true)
  })
  it('does not send when disabled', () => {
    expect(shouldAutoSend({ ...ok, enabled: false })).toBe(false)
  })
  it('does not send for borrow transactions', () => {
    expect(shouldAutoSend({ ...ok, direction: 'borrow' })).toBe(false)
  })
  it('does not send to suppliers', () => {
    expect(shouldAutoSend({ ...ok, clientKind: 'supplier' })).toBe(false)
  })
  it('does not send without a phone', () => {
    expect(shouldAutoSend({ ...ok, phone: null })).toBe(false)
    expect(shouldAutoSend({ ...ok, phone: '  ' })).toBe(false)
  })
})

describe('buildDirectMessage', () => {
  it('fills placeholders and blanks missing ones', () => {
    const msg = buildDirectMessage('Hi {{name}}: {{amount}} by {{dueDate}}. {{note}}', {
      name: 'Ali',
      amount: '100 UZS',
      dueDate: '',
      note: ''
    })
    expect(msg).toBe('Hi Ali: 100 UZS by .')
  })
})

describe('fillTemplate', () => {
  it('replaces unknown keys with an empty string', () => {
    expect(fillTemplate('{{a}}-{{b}}', { a: 'x' })).toBe('x-')
  })
})
