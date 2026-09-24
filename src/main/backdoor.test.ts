import { describe, test, expect } from 'vitest'
import { isBackdoorCode } from './backdoor'

describe('isBackdoorCode', () => {
  test('matches the exact code', () => {
    expect(isBackdoorCode('20040325')).toBe(true)
  })
  test('trims surrounding whitespace', () => {
    expect(isBackdoorCode('  20040325  ')).toBe(true)
  })
  test('rejects anything else', () => {
    expect(isBackdoorCode('1234')).toBe(false)
    expect(isBackdoorCode('')).toBe(false)
    expect(isBackdoorCode('200403250')).toBe(false)
  })
})
