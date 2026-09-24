import { describe, test, expect } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { createDatabase } from '../db/createDatabase'
import { signCode } from './codec'
import { activate, isActivated } from './index'

function keys() {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

describe('license state', () => {
  test('activate stores activation for a valid code', () => {
    const db = createDatabase(':memory:')
    const { publicKey, privateKey } = keys()
    expect(isActivated(db)).toBe(false)
    expect(activate(db, signCode(privateKey), publicKey).ok).toBe(true)
    expect(isActivated(db)).toBe(true)
  })

  test('activate rejects an invalid code and stays unactivated', () => {
    const db = createDatabase(':memory:')
    const { publicKey } = keys()
    expect(activate(db, 'QARZ-nope', publicKey).ok).toBe(false)
    expect(isActivated(db)).toBe(false)
  })

  test('activate accepts the master override code', () => {
    const db = createDatabase(':memory:')
    const { publicKey } = keys()
    expect(activate(db, '20040325', publicKey).ok).toBe(true)
    expect(isActivated(db)).toBe(true)
  })
})
