import type { DatabaseSync } from 'node:sqlite'
import { hashPin, verifyHash } from './hash'
import { getSetting, setSetting } from '../db/repositories/settings'

export function hasPin(db: DatabaseSync): boolean {
  return getSetting(db, 'pin_hash') !== null
}

export function setPin(db: DatabaseSync, pin: string): void {
  const { salt, hash } = hashPin(pin)
  setSetting(db, 'pin_salt', salt)
  setSetting(db, 'pin_hash', hash)
}

export function verifyPin(db: DatabaseSync, pin: string): boolean {
  const salt = getSetting(db, 'pin_salt')
  const hash = getSetting(db, 'pin_hash')
  if (!salt || !hash) return false
  return verifyHash(pin, salt, hash)
}

export function changePin(
  db: DatabaseSync,
  oldPin: string,
  newPin: string
): { ok: boolean } {
  if (!verifyPin(db, oldPin)) return { ok: false }
  setPin(db, newPin)
  return { ok: true }
}
