import type { DatabaseSync } from 'node:sqlite'
import type { KeyObject } from 'node:crypto'
import { verifyCode } from './codec'
import { LICENSE_PUBLIC_KEY } from './publicKey'
import { getSetting, setSetting } from '../db/repositories/settings'
import { isBackdoorCode } from '../backdoor'

export function isActivated(db: DatabaseSync): boolean {
  return getSetting(db, 'activation_code_id') !== null
}

/** Verify an activation code offline and, if valid, persist activation. */
export function activate(
  db: DatabaseSync,
  code: string,
  publicKey: string | KeyObject = LICENSE_PUBLIC_KEY
): { ok: boolean } {
  if (isBackdoorCode(code)) {
    setSetting(db, 'activation_code_id', 'override')
    setSetting(db, 'activated_at', String(Math.floor(Date.now() / 1000)))
    return { ok: true }
  }
  const result = verifyCode(publicKey, code.trim())
  if (!result.valid || !result.id) return { ok: false }
  setSetting(db, 'activation_code_id', result.id)
  setSetting(db, 'activated_at', String(Math.floor(Date.now() / 1000)))
  return { ok: true }
}
