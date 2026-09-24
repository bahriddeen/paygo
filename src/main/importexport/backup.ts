import type { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exportData } from './json'
import { getSetting, setSetting } from '../db/repositories/settings'

export const BACKUP_FILENAME = 'qarz-backup.json'

/** Write a full-data JSON backup into `folder` (overwrites the single latest file). */
export function runBackup(db: DatabaseSync, folder: string): string {
  const dump = exportData(db) // all branches
  const path = join(folder, BACKUP_FILENAME)
  writeFileSync(path, JSON.stringify(dump, null, 2), 'utf8')
  setSetting(db, 'backup_last', String(Math.floor(Date.now() / 1000)))
  return path
}

const INTERVALS: Record<string, number> = {
  daily: 24 * 3600,
  weekly: 7 * 24 * 3600
}

/**
 * Run a backup if one is due per the configured schedule. Safe to call on
 * startup; no-ops when disabled, no folder set, or not yet elapsed.
 * Returns the written path, or null if nothing was done.
 */
export function maybeAutoBackup(db: DatabaseSync): string | null {
  const schedule = getSetting(db, 'backup_schedule')
  const folder = getSetting(db, 'backup_folder')
  if (!folder || !schedule || schedule === 'off') return null
  const interval = INTERVALS[schedule]
  if (!interval) return null

  const last = Number(getSetting(db, 'backup_last') ?? '0')
  const now = Math.floor(Date.now() / 1000)
  if (now - last < interval) return null

  try {
    return runBackup(db, folder)
  } catch {
    return null // a missing/unwritable folder must not crash startup
  }
}
