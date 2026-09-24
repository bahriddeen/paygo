import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LEN = 64

/** Hash a PIN with scrypt and a random salt (or a supplied one for verification). */
export function hashPin(
  pin: string,
  salt: string = randomBytes(16).toString('hex')
): { salt: string; hash: string } {
  return { salt, hash: scryptSync(pin, salt, KEY_LEN).toString('hex') }
}

/** Constant-time comparison of a PIN against a stored salt+hash. */
export function verifyHash(pin: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(pin, salt, KEY_LEN)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}
