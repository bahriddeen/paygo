import type { DatabaseSync } from 'node:sqlite'
import { existsSync, unlinkSync } from 'node:fs'

const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Windows can hold a file handle after close() returns for longer than a
 * few milliseconds under load (antivirus/indexer scans, deferred handle
 * release, busy CI runners) — unlike macOS/Linux, where an unlink right
 * after close() is always safe. Retry with backoff over a couple of
 * seconds total; still fast enough that a user triggering this (factory
 * reset / clear demo data) won't perceive the delay.
 */
function unlinkWithRetry(path: string, attempts = 10): void {
  for (let i = 0; i < attempts; i++) {
    try {
      unlinkSync(path)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (i === attempts - 1 || (code !== 'EBUSY' && code !== 'EPERM')) throw err
      sleepSync(Math.min(50 * 2 ** i, 500))
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
