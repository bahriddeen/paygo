import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient, deleteClient } from './clients'
import { createTransaction } from './transactions'
import { addPayment } from './payments'
import { debtSeries, topDebtors } from './stats'

const NOW = 1_700_000_000
const DAY = 86400
let db: DatabaseSync
let a: number
let b: number
let c: number

beforeEach(() => {
  db = createDatabase(':memory:')
  a = createClient(db, { branch_id: 1, name: 'Ali' }).id
  b = createClient(db, { branch_id: 1, name: 'Bek' }).id
  c = createClient(db, { branch_id: 1, name: 'Chris' }).id
})

describe('debtSeries', () => {
  test('buckets lent and paid by day for the currency, in range', () => {
    createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100000, currency: 'UZS', issued_at: NOW })
    createTransaction(db, { branch_id: 1, client_id: b, direction: 'lend', amount: 50000, currency: 'UZS', issued_at: NOW - 2 * DAY })
    // different currency and a payment
    createTransaction(db, { branch_id: 1, client_id: c, direction: 'lend', amount: 999, currency: 'USD', issued_at: NOW })
    const t = createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100000, currency: 'UZS', issued_at: NOW })
    addPayment(db, { transaction_id: t.id, amount: 30000, paid_at: NOW })

    const series = debtSeries(db, 1, 'UZS', NOW - 10 * DAY, NOW + DAY)
    const totalLent = series.reduce((s, p) => s + p.lent, 0)
    const totalPaid = series.reduce((s, p) => s + p.paid, 0)
    expect(totalLent).toBe(250000) // 100k + 50k + 100k UZS, USD excluded
    expect(totalPaid).toBe(30000)
    expect(series.length).toBe(2) // two distinct days
  })

  test('paid excludes payments toward a borrow (supplier) debt', () => {
    const borrowTx = createTransaction(db, {
      branch_id: 1,
      client_id: a,
      direction: 'borrow',
      amount: 100000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: borrowTx.id, amount: 40000, paid_at: NOW })
    const series = debtSeries(db, 1, 'UZS', NOW - DAY, NOW + DAY)
    const totalPaid = series.reduce((s, p) => s + p.paid, 0)
    expect(totalPaid).toBe(0)
  })

  test('excludes a deleted client from both lent and paid totals', () => {
    const t = createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100000, currency: 'UZS', issued_at: NOW })
    addPayment(db, { transaction_id: t.id, amount: 30000, paid_at: NOW })
    deleteClient(db, a)

    const series = debtSeries(db, 1, 'UZS', NOW - DAY, NOW + DAY)
    expect(series.reduce((s, p) => s + p.lent, 0)).toBe(0)
    expect(series.reduce((s, p) => s + p.paid, 0)).toBe(0)
  })
})

describe('topDebtors', () => {
  test('ranks clients by remaining desc for the currency, excluding settled', () => {
    const ta = createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100000, currency: 'UZS' })
    addPayment(db, { transaction_id: ta.id, amount: 40000 })
    createTransaction(db, { branch_id: 1, client_id: b, direction: 'lend', amount: 200000, currency: 'UZS' })
    createTransaction(db, { branch_id: 1, client_id: c, direction: 'lend', amount: 50000, currency: 'USD' })

    const top = topDebtors(db, 1, 'UZS', 10)
    expect(top.map((d) => [d.name, d.remaining])).toEqual([
      ['Bek', 200000],
      ['Ali', 60000]
    ])
  })

  test('excludes a deleted client', () => {
    createTransaction(db, { branch_id: 1, client_id: a, direction: 'lend', amount: 100000, currency: 'UZS' })
    createTransaction(db, { branch_id: 1, client_id: b, direction: 'lend', amount: 200000, currency: 'UZS' })
    deleteClient(db, b)

    const top = topDebtors(db, 1, 'UZS', 10)
    expect(top.map((d) => d.name)).toEqual(['Ali'])
  })
})
