import { describe, test, expect } from 'vitest'
import { hashPin, verifyHash } from './hash'

describe('pin hashing', () => {
  test('verifies the correct pin', () => {
    const { salt, hash } = hashPin('1234')
    expect(verifyHash('1234', salt, hash)).toBe(true)
  })

  test('rejects the wrong pin', () => {
    const { salt, hash } = hashPin('1234')
    expect(verifyHash('0000', salt, hash)).toBe(false)
  })

  test('uses a random salt, so the same pin hashes differently', () => {
    expect(hashPin('1234').hash).not.toBe(hashPin('1234').hash)
  })
})
