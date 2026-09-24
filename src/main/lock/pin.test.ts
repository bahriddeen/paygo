import { describe, test, expect } from 'vitest'
import { createDatabase } from '../db/createDatabase'
import { hasPin, setPin, verifyPin, changePin } from './pin'

describe('pin state', () => {
  test('setPin then verifyPin', () => {
    const db = createDatabase(':memory:')
    expect(hasPin(db)).toBe(false)
    setPin(db, '1234')
    expect(hasPin(db)).toBe(true)
    expect(verifyPin(db, '1234')).toBe(true)
    expect(verifyPin(db, '0000')).toBe(false)
  })

  test('changePin requires the correct old pin', () => {
    const db = createDatabase(':memory:')
    setPin(db, '1234')
    expect(changePin(db, '0000', '5678').ok).toBe(false)
    expect(changePin(db, '1234', '5678').ok).toBe(true)
    expect(verifyPin(db, '5678')).toBe(true)
  })
})
