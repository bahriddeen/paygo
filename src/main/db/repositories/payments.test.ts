import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient } from './clients'
import { createTransaction } from './transactions'
import { addPayment, listPaymentsByClient } from './payments'

const NOW = 1_700_000_000
let db: DatabaseSync
let client: number
let supplier: number

beforeEach(() => {
  db = createDatabase(':memory:')
  client = createClient(db, { branch_id: 1, name: 'Ali', kind: 'client' }).id
  supplier = createClient(db, { branch_id: 1, name: 'Acme', kind: 'supplier' }).id
})

describe('listPaymentsByClient', () => {
  test('returns payments across all of a person\'s transactions, newest first', () => {
    const t1 = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    const t2 = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 5000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t1.id, amount: 3000, paid_at: NOW })
    addPayment(db, { transaction_id: t2.id, amount: 1000, paid_at: NOW + 10 })

    const history = listPaymentsByClient(db, client)
    expect(history).toHaveLength(2)
    expect(history[0].transaction_id).toBe(t2.id)
    expect(history[0].amount).toBe(1000)
    expect(history[1].transaction_id).toBe(t1.id)
    expect(history[1].amount).toBe(3000)
  })

  test('includes borrow-direction payments (supplier debts), unlike listBranchPayments', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: supplier,
      direction: 'borrow',
      amount: 20000,
      currency: 'KGS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 5000, paid_at: NOW })

    const history = listPaymentsByClient(db, supplier)
    expect(history).toHaveLength(1)
    expect(history[0].direction).toBe('borrow')
  })

  test('excludes payments belonging to other people', () => {
    const other = createClient(db, { branch_id: 1, name: 'Other', kind: 'client' }).id
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: other,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 1000, paid_at: NOW })

    expect(listPaymentsByClient(db, client)).toHaveLength(0)
  })
})
