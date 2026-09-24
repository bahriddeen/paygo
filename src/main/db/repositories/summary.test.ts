import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient } from './clients'
import { createTransaction } from './transactions'
import { addPayment } from './payments'
import { dashboardSummary, clientBalance } from './summary'
import { startOfDaySec } from './dateUtil'

const NOW = 1_700_000_000 // fixed reference time
let db: DatabaseSync
let clientId: number

beforeEach(() => {
  db = createDatabase(':memory:')
  clientId = createClient(db, { branch_id: 1, name: 'Ali' }).id
})

describe('dashboardSummary', () => {
  test('outstanding sums open lend debts per currency, with counts', () => {
    const bek = createClient(db, { branch_id: 1, name: 'Bek' }).id
    const t1 = createTransaction(db, {
      branch_id: 1,
      client_id: clientId,
      direction: 'lend',
      amount: 150000,
      currency: 'UZS'
    })
    addPayment(db, { transaction_id: t1.id, amount: 50000 })
    createTransaction(db, { branch_id: 1, client_id: bek, direction: 'lend', amount: 200000, currency: 'UZS' })
    createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 5000, currency: 'USD' })

    const s = dashboardSummary(db, 1, NOW)
    expect(s.outstanding).toEqual(
      expect.arrayContaining([
        { currency: 'UZS', amount: 300000 },
        { currency: 'USD', amount: 5000 }
      ])
    )
    expect(s.openDebts).toBe(3)
    expect(s.outstandingClients).toBe(2)
  })

  test('overdue counts only open lend debts past their due date', () => {
    createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS', due_at: NOW - 86400 })
    createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS', due_at: NOW + 86400 })
    const paid = createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS', due_at: NOW - 86400 })
    addPayment(db, { transaction_id: paid.id, amount: 100000 })

    const s = dashboardSummary(db, 1, NOW)
    expect(s.overdueCount).toBe(1)
    expect(s.overdue).toEqual([{ currency: 'UZS', amount: 100000 }])
  })

  test('overdue excludes a debt due earlier today (the day is not over yet)', () => {
    const now = Math.floor(Date.now() / 1000)
    const dueEarlierToday = startOfDaySec(now) + 1
    createTransaction(db, {
      branch_id: 1,
      client_id: clientId,
      direction: 'lend',
      amount: 100000,
      currency: 'UZS',
      due_at: dueEarlierToday
    })
    const s = dashboardSummary(db, 1, now)
    expect(s.overdueCount).toBe(0)
    expect(s.overdue).toEqual([])
  })

  test("today's payments include only payments made today", () => {
    const t = createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS' })
    addPayment(db, { transaction_id: t.id, amount: 30000, paid_at: NOW })
    addPayment(db, { transaction_id: t.id, amount: 20000, paid_at: NOW - 3 * 86400 })

    const s = dashboardSummary(db, 1, NOW)
    expect(s.todayPaymentsCount).toBe(1)
    expect(s.todayPayments).toEqual([{ currency: 'UZS', amount: 30000 }])
  })

  test("today's payments exclude payments made toward a borrow (supplier) debt", () => {
    const lendTx = createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS' })
    addPayment(db, { transaction_id: lendTx.id, amount: 30000, paid_at: NOW })
    const borrowTx = createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'borrow', amount: 100000, currency: 'UZS' })
    addPayment(db, { transaction_id: borrowTx.id, amount: 40000, paid_at: NOW })

    const s = dashboardSummary(db, 1, NOW)
    expect(s.todayPaymentsCount).toBe(1)
    expect(s.todayPayments).toEqual([{ currency: 'UZS', amount: 30000 }])
  })

  test('youOwe sums open borrow debts', () => {
    createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'borrow', amount: 75000, currency: 'KGS' })
    expect(dashboardSummary(db, 1, NOW).youOwe).toEqual([{ currency: 'KGS', amount: 75000 }])
  })
})

describe('clientBalance', () => {
  test('returns per currency and direction remaining, excluding settled', () => {
    const t = createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'lend', amount: 100000, currency: 'UZS' })
    addPayment(db, { transaction_id: t.id, amount: 40000 })
    createTransaction(db, { branch_id: 1, client_id: clientId, direction: 'borrow', amount: 20000, currency: 'USD' })

    expect(clientBalance(db, clientId)).toEqual(
      expect.arrayContaining([
        { currency: 'UZS', direction: 'lend', remaining: 60000 },
        { currency: 'USD', direction: 'borrow', remaining: 20000 }
      ])
    )
  })
})
