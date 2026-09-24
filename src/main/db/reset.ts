import type { DatabaseSync } from 'node:sqlite'
import { existsSync, unlinkSync } from 'node:fs'

/**
 * Close `db` and delete its file plus WAL/SHM siblings. The caller is
 * responsible for not touching `db` afterward and for re-opening (via
 * createDatabase) or restarting the app to get a fresh, migrated DB.
 */
export function resetDatabaseFile(db: DatabaseSync, filePath: string): void {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    const p = filePath + suffix
    if (existsSync(p)) unlinkSync(p)
  }
}
