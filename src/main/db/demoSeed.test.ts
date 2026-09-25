import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from './createDatabase'
import { createClient } from './repositories/clients'
import { createTransaction } from './repositories/transactions'
import { seedDemoData, clearDemoData, hasDemoData } from './demoSeed'

let db: DatabaseSync
const BRANCH_ID = 1

beforeEach(() => {
  db = createDatabase(':memory:')
})

function counts(): { clients: number; suppliers: number; transactions: number; payments: number } {
  const c = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE kind = 'client'").get() as { n: number }
  const s = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE kind = 'supplier'").get() as {
    n: number
  }
  const t = db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }
  const p = db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }
  return { clients: c.n, suppliers: s.n, transactions: t.n, payments: p.n }
}

describe('hasDemoData', () => {
  test('false before seeding, true after', () => {
    expect(hasDemoData(db)).toBe(false)
    seedDemoData(db, BRANCH_ID)
    expect(hasDemoData(db)).toBe(true)
  })
})

describe('seedDemoData', () => {
  test('creates 15 demo clients, 5 demo suppliers, and 100 demo transactions', () => {
    seedDemoData(db, BRANCH_ID)
    const { clients, suppliers, transactions } = counts()
    expect(clients).toBe(15)
    expect(suppliers).toBe(5)
    expect(transactions).toBe(100)

    const demoClients = db
      .prepare('SELECT COUNT(*) AS n FROM clients WHERE is_demo = 1')
      .get() as { n: number }
    const demoTx = db
      .prepare('SELECT COUNT(*) AS n FROM transactions WHERE is_demo = 1')
      .get() as { n: number }
    expect(demoClients.n).toBe(20)
    expect(demoTx.n).toBe(100)
  })

  test('every transaction direction matches its client kind (client=lend, supplier=borrow)', () => {
    seedDemoData(db, BRANCH_ID)
    const mismatches = db
      .prepare(
        `SELECT COUNT(*) AS n FROM transactions t JOIN clients c ON c.id = t.client_id
         WHERE (c.kind = 'client' AND t.direction != 'lend')
            OR (c.kind = 'supplier' AND t.direction != 'borrow')`
      )
      .get() as { n: number }
    expect(mismatches.n).toBe(0)
  })
})

describe('clearDemoData', () => {
  test('removes all demo clients, transactions, and their payments', () => {
    seedDemoData(db, BRANCH_ID)
    clearDemoData(db)
    const { clients, suppliers, transactions, payments } = counts()
    expect(clients).toBe(0)
    expect(suppliers).toBe(0)
    expect(transactions).toBe(0)
    expect(payments).toBe(0)
    expect(hasDemoData(db)).toBe(false)
  })

  test('leaves real (non-demo) clients and transactions untouched', () => {
    seedDemoData(db, BRANCH_ID)
    const real = createClient(db, { branch_id: BRANCH_ID, name: 'Real Client' })
    createTransaction(db, {
      branch_id: BRANCH_ID,
      client_id: real.id,
      direction: 'lend',
      amount: 50000,
      currency: 'UZS'
    })

    clearDemoData(db)

    const remaining = db.prepare('SELECT name FROM clients').all() as { name: string }[]
    expect(remaining).toEqual([{ name: 'Real Client' }])
    const remainingTx = db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }
    expect(remainingTx.n).toBe(1)
  })

  test('keeps a demo client that has since gained a real transaction, but drops its demo transactions', () => {
    seedDemoData(db, BRANCH_ID)
    const demoClientId = (
      db.prepare("SELECT id FROM clients WHERE is_demo = 1 AND kind = 'client' LIMIT 1").get() as {
        id: number
      }
    ).id

    createTransaction(db, {
      branch_id: BRANCH_ID,
      client_id: demoClientId,
      direction: 'lend',
      amount: 12345,
      currency: 'UZS'
    })

    clearDemoData(db)

    const stillThere = db.prepare('SELECT id FROM clients WHERE id = ?').get(demoClientId)
    expect(stillThere).toBeTruthy()
    const remainingTxForClient = db
      .prepare('SELECT COUNT(*) AS n FROM transactions WHERE client_id = ?')
      .get(demoClientId) as { n: number }
    expect(remainingTxForClient.n).toBe(1) // only the real one survives
    const demoTxLeft = db
      .prepare('SELECT COUNT(*) AS n FROM transactions WHERE is_demo = 1')
      .get() as { n: number }
    expect(demoTxLeft.n).toBe(0)
  })
})
