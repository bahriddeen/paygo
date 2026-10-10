import { describe, test, expect } from 'vitest'
import { createDatabase } from '../db/createDatabase'
import { createClient } from '../db/repositories/clients'
import { createTransaction } from '../db/repositories/transactions'
import { addPayment } from '../db/repositories/payments'
import { debtorRows } from './excel'
import { startOfDaySec } from '../db/repositories/dateUtil'

describe('debtorRows', () => {
  test('one row per client-currency with open lend debt, newest debt date and overdue flag', () => {
    const db = createDatabase(':memory:')
    const ali = createClient(db, { branch_id: 1, name: 'Ali', phone: '+998901112233' }).id
    const bek = createClient(db, { branch_id: 1, name: 'Bek' }).id
    const NOW = Math.floor(Date.now() / 1000)

    const t1 = createTransaction(db, { branch_id: 1, client_id: ali, direction: 'lend', amount: 150000, currency: 'UZS', issued_at: NOW - 2 * 86400, due_at: NOW - 86400 })
    addPayment(db, { transaction_id: t1.id, amount: 50000 })
    createTransaction(db, { branch_id: 1, client_id: bek, direction: 'lend', amount: 5000, currency: 'USD' })
    // A fully-paid debt should not appear.
    const settled = createTransaction(db, { branch_id: 1, client_id: bek, direction: 'lend', amount: 1000, currency: 'UZS' })
    addPayment(db, { transaction_id: settled.id, amount: 1000 })

    const rows = debtorRows(db, 1)
    expect(rows).toHaveLength(2)

    const aliRow = rows.find((r) => r.name === 'Ali')
    expect(aliRow?.phone).toBe('+998901112233')
    expect(aliRow?.currency).toBe('UZS')
    expect(aliRow?.remaining).toBe(100000)
    expect(aliRow?.overdue).toBe(true)

    const bekRow = rows.find((r) => r.name === 'Bek')
    expect(bekRow?.currency).toBe('USD')
    expect(bekRow?.remaining).toBe(5000)
    expect(bekRow?.overdue).toBe(false)
  })

  test('a debt due earlier today is not flagged overdue yet', () => {
    const db = createDatabase(':memory:')
    const ali = createClient(db, { branch_id: 1, name: 'Ali' }).id
    const now = Math.floor(Date.now() / 1000)
    createTransaction(db, {
      branch_id: 1,
      client_id: ali,
      direction: 'lend',
      amount: 100000,
      currency: 'UZS',
      due_at: startOfDaySec(now) + 1
    })
    expect(debtorRows(db, 1)[0]?.overdue).toBe(false)
  })

  test('sorted by remaining descending', () => {
    const db = createDatabase(':memory:')
    const a = createClient(db, { branch_id: 1, name: 'Small' }).id
    const b = createClient(db, { branch_id: 1, name: 'Big' }).id
    createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100, currency: 'UZS' })
    createTransaction(db, { branch_id: 1, client_id: b, direction: 'lend', amount: 999, currency: 'UZS' })
    expect(debtorRows(db, 1).map((r) => r.name)).toEqual(['Big', 'Small'])
  })
})
