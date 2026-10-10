import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient, deleteClient } from './clients'
import { createTransaction, transactionRemaining } from './transactions'
import {
  addPayment,
  listPaymentsByClient,
  listBranchPayments,
  updatePayment,
  deletePayment
} from './payments'

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

describe('listBranchPayments', () => {
  test('excludes payments belonging to a deleted client', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 3000, paid_at: NOW })
    deleteClient(db, client)

    expect(listBranchPayments(db, 1, { from: NOW - 10, to: NOW + 10 })).toHaveLength(0)
  })
})

describe('updatePayment', () => {
  test('updates amount/method/note/paid_at and recomputes remaining', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    const payment = addPayment(db, { transaction_id: t.id, amount: 3000, paid_at: NOW })
    expect(transactionRemaining(db, t.id)).toBe(7000)

    const updated = updatePayment(db, payment.id, {
      amount: 4000,
      method: 'card',
      note: 'corrected',
      paid_at: NOW + 50
    })

    expect(updated.amount).toBe(4000)
    expect(updated.method).toBe('card')
    expect(updated.note).toBe('corrected')
    expect(updated.paid_at).toBe(NOW + 50)
    expect(transactionRemaining(db, t.id)).toBe(6000)
  })

  test('rejects an amount that would exceed the transaction remaining', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    const payment = addPayment(db, { transaction_id: t.id, amount: 3000, paid_at: NOW })

    expect(() => updatePayment(db, payment.id, { amount: 10001 })).toThrow()
  })

  test('throws for a non-existent payment', () => {
    expect(() => updatePayment(db, 999, { amount: 100 })).toThrow()
  })
})

describe('deletePayment', () => {
  test('removes the payment and frees up the transaction remaining', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    const payment = addPayment(db, { transaction_id: t.id, amount: 3000, paid_at: NOW })
    expect(transactionRemaining(db, t.id)).toBe(7000)

    deletePayment(db, payment.id)

    expect(transactionRemaining(db, t.id)).toBe(10000)
    expect(listPaymentsByClient(db, client)).toHaveLength(0)
  })
})
