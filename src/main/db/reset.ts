import type { DatabaseSync } from 'node:sqlite'
import { existsSync, unlinkSync } from 'node:fs'

const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Windows can hold a file handle for a few milliseconds after close()
 * returns (antivirus/indexer scans, deferred handle release) — unlike
 * macOS/Linux, where an unlink right after close() is always safe. A
 * handful of short retries absorbs that without changing behavior
 * anywhere else.
 */
function unlinkWithRetry(path: string, attempts = 5): void {
  for (let i = 0; i < attempts; i++) {
    try {
      unlinkSync(path)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (i === attempts - 1 || (code !== 'EBUSY' && code !== 'EPERM')) throw err
      sleepSync(50)
    }
  }
}

/**
 * Close `db` and delete its file plus WAL/SHM siblings. The caller is
 * responsible for not touching `db` afterward and for re-opening (via
 * createDatabase) or restarting the app to get a fresh, migrated DB.
 */
export function resetDatabaseFile(db: DatabaseSync, filePath: string): void {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    const p = filePath + suffix
    if (existsSync(p)) unlinkWithRetry(p)
  }
}
