import { app } from 'electron'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from './createDatabase'
import { resetDatabaseFile } from './reset'

let db: DatabaseSync | null = null
let dbPath: string | null = null

/** Open (once) the app's SQLite database in userData. */
export function initDb(): DatabaseSync {
  if (db) return db
  dbPath = join(app.getPath('userData'), 'qarz.db')
  db = createDatabase(dbPath)
  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized — call initDb() first')
  return db
}

/**
 * Permanently delete all app data (factory reset). Closes and deletes the
 * DB file; the caller must restart the app afterward — initDb() will not
 * recreate it in the same process since `db`/`dbPath` are cleared, and the
 * rest of the app assumes a live connection exists.
 */
export function resetDb(): void {
  if (!db || !dbPath) return
  resetDatabaseFile(db, dbPath)
  db = null
  dbPath = null
}
