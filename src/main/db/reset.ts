import type { DatabaseSync } from 'node:sqlite'

/**
 * Factory reset: wipe every table on the SAME live connection and reseed
 * the one default branch, rather than closing the connection and deleting
 * the file. Deliberately NOT close()+unlink()+reopen(): node:sqlite is
 * still experimental and its close() does not reliably release the file
 * handle on Windows before an immediate unlink, causing an EBUSY that
 * persisted even through a ~3.75s retry-with-backoff window in CI — not a
 * transient timing race, so no amount of retrying fixes it. Wiping data
 * in place sidesteps file-handle lifecycle entirely and matches how
 * clearDemoData() already works.
 */
export function wipeDatabase(db: DatabaseSync): void {
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM payments')
    db.exec('DELETE FROM transactions')
    db.exec('DELETE FROM clients')
    db.exec('DELETE FROM client_groups')
    db.exec('DELETE FROM app_settings')
    db.exec('DELETE FROM branches')
    db.exec("INSERT INTO branches (name) VALUES ('Asosiy')")
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
