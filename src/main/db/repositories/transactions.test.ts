import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient, deleteClient } from './clients'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listLineItems,
  listTransactions
} from './transactions'
import { addPayment, listPayments } from './payments'
import { startOfDaySec } from './dateUtil'

const NOW = 1_700_000_000
let db: DatabaseSync
let client: number

beforeEach(() => {
  db = createDatabase(':memory:')
  client = createClient(db, { branch_id: 1, name: 'Ali', kind: 'client' }).id
})

describe('createTransaction with line_items', () => {
  test('computes amount as the rounded sum of quantity * unit_price, ignoring a mismatched amount', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1, // deliberately wrong — must be overridden by line items
      currency: 'UZS',
      issued_at: NOW,
      line_items: [
        { product: 'Bread', quantity: 2, unit_price: 1000 },
        { product: 'Milk', quantity: 1.5, unit_price: 2000 }
      ]
    })

    expect(t.amount).toBe(2 * 1000 + Math.round(1.5 * 2000))
  })

  test('listLineItems returns rows ordered by position matching insertion order', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      issued_at: NOW,
      line_items: [
        { product: 'Bread', quantity: 2, unit_price: 1000 },
        { product: 'Milk', quantity: 1.5, unit_price: 2000 }
      ]
    })

    const items = listLineItems(db, t.id)
    expect(items).toHaveLength(2)
    expect(items[0].product).toBe('Bread')
    expect(items[0].position).toBe(0)
    expect(items[0].total).toBe(2000)
    expect(items[1].product).toBe('Milk')
    expect(items[1].position).toBe(1)
    expect(items[1].total).toBe(3000)
  })

  test('with no line_items behaves exactly as before (plain manual amount)', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 5000,
      currency: 'UZS',
      issued_at: NOW
    })

    expect(t.amount).toBe(5000)
    expect(listLineItems(db, t.id)).toHaveLength(0)
  })
})

describe('updateTransaction with line_items', () => {
  test('replacing line_items recomputes amount', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      issued_at: NOW,
      line_items: [{ product: 'Bread', quantity: 2, unit_price: 1000 }]
    })

    const updated = updateTransaction(db, t.id, {
      line_items: [
        { product: 'Bread', quantity: 3, unit_price: 1000 },
        { product: 'Eggs', quantity: 1, unit_price: 500 }
      ]
    })

    expect(updated.amount).toBe(3500)
    expect(listLineItems(db, t.id)).toHaveLength(2)
  })

  test('still throws when the new sum is below paid', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      issued_at: NOW,
      line_items: [{ product: 'Bread', quantity: 10, unit_price: 1000 }]
    })
    addPayment(db, { transaction_id: t.id, amount: 8000, paid_at: NOW })

    expect(() =>
      updateTransaction(db, t.id, {
        line_items: [{ product: 'Bread', quantity: 1, unit_price: 1000 }]
      })
    ).toThrow()
  })

  test('line_items: null deletes existing rows and leaves amount as passed', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      issued_at: NOW,
      line_items: [{ product: 'Bread', quantity: 2, unit_price: 1000 }]
    })

    const updated = updateTransaction(db, t.id, { amount: 9000, line_items: null })

    expect(updated.amount).toBe(9000)
    expect(listLineItems(db, t.id)).toHaveLength(0)
  })
})

describe('updateTransaction currency lock', () => {
  test('allows changing currency before any payment is recorded', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    const updated = updateTransaction(db, t.id, { currency: 'KGS' })
    expect(updated.currency).toBe('KGS')
  })

  test('rejects changing currency once a payment has been recorded', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 1000, paid_at: NOW })

    expect(() => updateTransaction(db, t.id, { currency: 'KGS' })).toThrow()
  })

  test('allows other edits that keep the same currency even after a payment', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 1000, paid_at: NOW })

    const updated = updateTransaction(db, t.id, { currency: 'UZS', description: 'note' })
    expect(updated.description).toBe('note')
  })
})

describe('due date validation', () => {
  test('createTransaction rejects a due date before the issue date', () => {
    expect(() =>
      createTransaction(db, {
        branch_id: 1,
        client_id: client,
        direction: 'lend',
        amount: 10000,
        currency: 'UZS',
        issued_at: NOW,
        due_at: NOW - 86400
      })
    ).toThrow()
  })

  test('createTransaction allows a due date equal to the issue date', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW,
      due_at: NOW
    })
    expect(t.due_at).toBe(NOW)
  })

  test('updateTransaction rejects moving the due date before the (possibly also updated) issue date', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW,
      due_at: NOW + 86400
    })
    expect(() => updateTransaction(db, t.id, { due_at: NOW - 86400 })).toThrow()
  })
})

describe('deleteTransaction', () => {
  test('removes line items along with the transaction', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      issued_at: NOW,
      line_items: [{ product: 'Bread', quantity: 2, unit_price: 1000 }]
    })

    deleteTransaction(db, t.id)

    expect(listLineItems(db, t.id)).toHaveLength(0)
  })

  test('removes its payments along with the transaction', () => {
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    addPayment(db, { transaction_id: t.id, amount: 4000, paid_at: NOW })

    deleteTransaction(db, t.id)

    expect(listPayments(db, t.id)).toHaveLength(0)
  })
})

describe('listTransactions excludes deleted clients', () => {
  test('a transaction belonging to a deleted client is gone from branch-wide lists', () => {
    createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 10000,
      currency: 'UZS',
      issued_at: NOW
    })
    deleteClient(db, client)

    expect(listTransactions(db, 1)).toHaveLength(0)
  })
})

describe('listTransactions dueSoonWithin', () => {
  test('includes a transaction due "today" even later in the day, not just before the current moment', () => {
    const todayStart = startOfDaySec(NOW)
    const laterSameDay = todayStart + 18 * 3600 // 6pm, well after local midnight

    createTransaction(db, {
      branch_id: 1,
      client_id: client,
      direction: 'lend',
      amount: 1000,
      currency: 'UZS',
      issued_at: NOW,
      due_at: todayStart // due "today" — stored as local midnight
    })

    const soon = listTransactions(db, 1, {
      dueSoonWithin: 7 * 86400,
      now: laterSameDay
    })

    expect(soon).toHaveLength(1)
  })
})
