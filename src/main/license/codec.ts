import { KeyObject, randomBytes, sign, verify } from 'node:crypto'

const PREFIX = 'KEY-'
const VERSION = 1
const ID_BYTES = 16
const SIG_BYTES = 64
const PAYLOAD_BYTES = 1 + ID_BYTES // version + id

/**
 * Mint an activation code: an Ed25519 signature over [version, id], packed with
 * the payload and base64url-encoded. `id` is random per code unless supplied.
 */
export function signCode(privateKey: string | KeyObject, id: Buffer = randomBytes(ID_BYTES)): string {
  const payload = Buffer.concat([Buffer.from([VERSION]), id])
  const signature = sign(null, payload, privateKey)
  return PREFIX + Buffer.concat([payload, signature]).toString('base64url')
}

/** Verify a code offline against the embedded public key. Never throws. */
export function verifyCode(
  publicKey: string | KeyObject,
  code: string
): { valid: boolean; id?: string } {
  try {
    if (!code.startsWith(PREFIX)) return { valid: false }
    const raw = Buffer.from(code.slice(PREFIX.length), 'base64url')
    if (raw.length !== PAYLOAD_BYTES + SIG_BYTES) return { valid: false }
    if (raw[0] !== VERSION) return { valid: false }
    const payload = raw.subarray(0, PAYLOAD_BYTES)
    const signature = raw.subarray(PAYLOAD_BYTES)
    if (!verify(null, payload, publicKey, signature)) return { valid: false }
    return { valid: true, id: raw.subarray(1, PAYLOAD_BYTES).toString('hex') }
  } catch {
    return { valid: false }
  }
}
