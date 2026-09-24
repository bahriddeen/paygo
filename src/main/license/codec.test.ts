import { describe, test, expect } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { signCode, verifyCode } from './codec'

function keys() {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

describe('license codec', () => {
  test('a signed code verifies with the matching public key', () => {
    const { publicKey, privateKey } = keys()
    const r = verifyCode(publicKey, signCode(privateKey))
    expect(r.valid).toBe(true)
    expect(r.id).toMatch(/^[0-9a-f]{32}$/)
  })

  test('each minted code has a unique id', () => {
    const { privateKey, publicKey } = keys()
    const a = verifyCode(publicKey, signCode(privateKey)).id
    const b = verifyCode(publicKey, signCode(privateKey)).id
    expect(a).not.toBe(b)
  })

  test('a tampered code fails verification', () => {
    const { publicKey, privateKey } = keys()
    const code = signCode(privateKey)
    const tampered = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')
    expect(verifyCode(publicKey, tampered).valid).toBe(false)
  })

  test('a code fails against a different public key', () => {
    const { privateKey } = keys()
    const { publicKey: otherPublic } = keys()
    expect(verifyCode(otherPublic, signCode(privateKey)).valid).toBe(false)
  })

  test('a non-QARZ string is invalid, not an exception', () => {
    const { publicKey } = keys()
    expect(verifyCode(publicKey, 'hello').valid).toBe(false)
  })
})
