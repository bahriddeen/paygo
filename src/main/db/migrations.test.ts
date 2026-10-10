import { describe, test, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS, runMigrations } from './migrations'

describe('v5 — client deletion is now permanent, not a soft archive', () => {
  test('purges previously soft-deleted (archived) clients and their transactions/payments, then drops archived_at', () => {
    // Build a pre-v5 database by hand (migrations v1-v4 still had the
    // archived_at column) to simulate an existing install upgrading.
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON;')
    for (let i = 0; i < 4; i++) {
      db.exec(MIGRATIONS[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
    }

    const archived = db
      .prepare("INSERT INTO clients (branch_id, name, archived_at) VALUES (1, 'Gone', unixepoch())")
      .run().lastInsertRowid
    const activeId = db
      .prepare("INSERT INTO clients (branch_id, name) VALUES (1, 'Still Here')")
      .run().lastInsertRowid

    const archivedTxnId = db
      .prepare(
        `INSERT INTO transactions (branch_id, client_id, direction, amount, currency)
         VALUES (1, ?, 'lend', 10000, 'UZS')`
      )
      .run(archived).lastInsertRowid
    db.prepare(
      `INSERT INTO payments (branch_id, transaction_id, amount, currency) VALUES (1, ?, 3000, 'UZS')`
    ).run(archivedTxnId)

    const activeTxnId = db
      .prepare(
        `INSERT INTO transactions (branch_id, client_id, direction, amount, currency)
         VALUES (1, ?, 'lend', 5000, 'UZS')`
      )
      .run(activeId).lastInsertRowid

    // Now apply the rest, including v5.
    runMigrations(db)

    expect(db.prepare('SELECT id FROM clients WHERE id = ?').get(archived)).toBeUndefined()
    expect(db.prepare('SELECT id FROM transactions WHERE id = ?').get(archivedTxnId)).toBeUndefined()
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM payments WHERE transaction_id = ?').get(archivedTxnId)
    ).toEqual({ n: 0 })

    expect(db.prepare('SELECT name FROM clients WHERE id = ?').get(activeId)).toEqual({ name: 'Still Here' })
    expect(db.prepare('SELECT id FROM transactions WHERE id = ?').get(activeTxnId)).toBeTruthy()

    const columns = db.prepare('PRAGMA table_info(clients)').all() as { name: string }[]
    expect(columns.map((c) => c.name)).not.toContain('archived_at')
  })
})
