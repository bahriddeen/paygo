import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient } from './clients'
import {
  createTransaction,
  listTransactions,
  getTransaction,
  transactionRemaining,
  updateTransaction,
  deleteTransaction
} from './transactions'
import { addPayment, listPayments, listBranchPayments } from './payments'
import { startOfDaySec } from './dateUtil'

let db: DatabaseSync
let clientId: number

beforeEach(() => {
  db = createDatabase(':memory:')
  clientId = createClient(db, { branch_id: 1, name: 'Ali' }).id
})

function lend(amount: number, currency: 'KGS' | 'USD' | 'UZS' = 'UZS', due_at?: number) {
  return createTransaction(db, {
    branch_id: 1,
    client_id: clientId,
    direction: 'lend',
    amount,
    currency,
    due_at
  })
}

describe('transactions', () => {
  test('createTransaction stores the row and defaults issued_at', () => {
    const t = lend(150000)
    expect(t.id).toBeGreaterThan(0)
    expect(t.direction).toBe('lend')
    expect(t.currency).toBe('UZS')
    expect(t.issued_at).toBeGreaterThan(0)
  })

  test('listTransactions returns remaining, paid, and client_name', () => {
    lend(150000)
    const [row] = listTransactions(db, 1)
    expect(row.client_name).toBe('Ali')
    expect(row.paid).toBe(0)
    expect(row.remaining).toBe(150000)
  })

  test('transactionRemaining subtracts payments', () => {
    const t = lend(150000)
    addPayment(db, { transaction_id: t.id, amount: 50000 })
    expect(transactionRemaining(db, t.id)).toBe(100000)
  })

  test('getTransaction returns null for a missing id', () => {
    expect(getTransaction(db, 9999)).toBeNull()
  })

  test('listTransactions includes client_phone', () => {
    const zafar = createClient(db, { branch_id: 1, name: 'Zafar', phone: '+998901112233' }).id
    createTransaction(db, { branch_id: 1, client_id: zafar, direction: 'lend', amount: 1000, currency: 'UZS' })
    const [row] = listTransactions(db, 1, { clientId: zafar })
    expect(row.client_phone).toBe('+998901112233')
  })

  test('updateTransaction changes provided fields', () => {
    const t = lend(100000, 'UZS')
    const u = updateTransaction(db, t.id, { amount: 120000, description: 'rice' })
    expect(u.amount).toBe(120000)
    expect(u.description).toBe('rice')
    expect(u.currency).toBe('UZS')
  })

  test('updateTransaction rejects an amount below what was already paid', () => {
    const t = lend(100000, 'UZS')
    addPayment(db, { transaction_id: t.id, amount: 60000 })
    expect(() => updateTransaction(db, t.id, { amount: 50000 })).toThrow()
  })

  test('deleteTransaction removes it and its payments', () => {
    const t = lend(100000, 'UZS')
    addPayment(db, { transaction_id: t.id, amount: 30000 })
    deleteTransaction(db, t.id)
    expect(getTransaction(db, t.id)).toBeNull()
    expect(listPayments(db, t.id)).toHaveLength(0)
  })

  test('listTransactions overdue excludes a debt due earlier today (the day is not over yet)', () => {
    const now = Math.floor(Date.now() / 1000)
    const dueEarlierToday = startOfDaySec(now) + 1 // 1 second after local midnight
    lend(100000, 'UZS', dueEarlierToday)
    expect(listTransactions(db, 1, { overdue: true, now })).toHaveLength(0)
  })

  test('listTransactions overdue includes a debt due yesterday', () => {
    const now = Math.floor(Date.now() / 1000)
    const dueYesterday = startOfDaySec(now) - 86400
    lend(100000, 'UZS', dueYesterday)
    expect(listTransactions(db, 1, { overdue: true, now })).toHaveLength(1)
  })

  test('listTransactions dueSoon returns upcoming open lend debts within the window', () => {
    const NOW = 1_700_000_000
    const DAY = 86400
    lend(100000, 'UZS', NOW + 2 * DAY) // within 7d -> included
    lend(100000, 'UZS', NOW + 10 * DAY) // beyond 7d -> excluded
    lend(100000, 'UZS', NOW - DAY) // already overdue -> excluded
    const settled = lend(100000, 'UZS', NOW + 3 * DAY)
    addPayment(db, { transaction_id: settled.id, amount: 100000 }) // settled -> excluded
    expect(listTransactions(db, 1, { dueSoonWithin: 7 * DAY, now: NOW })).toHaveLength(1)
  })
})

describe('payments', () => {
  test('addPayment inherits the transaction currency', () => {
    const t = lend(100000, 'KGS')
    const p = addPayment(db, { transaction_id: t.id, amount: 40000 })
    expect(p.currency).toBe('KGS')
  })

  test('addPayment rejects an amount over the remaining balance', () => {
    const t = lend(100000)
    addPayment(db, { transaction_id: t.id, amount: 60000 })
    expect(() => addPayment(db, { transaction_id: t.id, amount: 60000 })).toThrow()
  })

  test('addPayment records installments and reduces remaining', () => {
    const t = lend(100000)
    addPayment(db, { transaction_id: t.id, amount: 30000 })
    addPayment(db, { transaction_id: t.id, amount: 20000 })
    expect(listPayments(db, t.id)).toHaveLength(2)
    expect(transactionRemaining(db, t.id)).toBe(50000)
  })

  test('listBranchPayments returns payments in a date range with client info', () => {
    const t = lend(100000, 'UZS')
    addPayment(db, { transaction_id: t.id, amount: 30000, paid_at: 1000, method: 'cash' })
    addPayment(db, { transaction_id: t.id, amount: 20000, paid_at: 5000 })
    const rows = listBranchPayments(db, 1, { from: 900, to: 2000 })
    expect(rows).toHaveLength(1)
    expect(rows[0].client_name).toBe('Ali')
    expect(rows[0].amount).toBe(30000)
    expect(rows[0].currency).toBe('UZS')
    expect(rows[0].method).toBe('cash')
    expect(rows[0].client_id).toBe(clientId)
  })

  test('listBranchPayments excludes payments toward a borrow (supplier) debt', () => {
    const borrowTx = createTransaction(db, {
      branch_id: 1,
      client_id: clientId,
      direction: 'borrow',
      amount: 100000,
      currency: 'UZS'
    })
    addPayment(db, { transaction_id: borrowTx.id, amount: 40000, paid_at: 1000 })
    expect(listBranchPayments(db, 1, { from: 0, to: 2000 })).toHaveLength(0)
  })
})
