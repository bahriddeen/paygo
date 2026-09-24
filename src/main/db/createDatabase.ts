import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'

/**
 * Open a database at `filename` (use ':memory:' in tests), apply per-connection
 * PRAGMAs, and run migrations. No Electron dependency, so it is unit-testable.
 */
export function createDatabase(filename: string): DatabaseSync {
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;') // per-connection, defaults OFF
  db.exec('PRAGMA busy_timeout = 5000;')
  runMigrations(db)
  return db
}
