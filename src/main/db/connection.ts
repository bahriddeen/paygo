import { app } from 'electron'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from './createDatabase'

let db: DatabaseSync | null = null

/** Open (once) the app's SQLite database in userData. */
export function initDb(): DatabaseSync {
  if (db) return db
  db = createDatabase(join(app.getPath('userData'), 'qarz.db'))
  return db
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized — call initDb() first')
  return db
}
