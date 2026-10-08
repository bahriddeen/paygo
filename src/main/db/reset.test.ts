import { describe, test, expect } from 'vitest'
import { createDatabase } from './createDatabase'
import { createClient } from './repositories/clients'
import { createTransaction } from './repositories/transactions'
import { addPayment } from './repositories/payments'
import { setSetting, getSetting } from './repositories/settings'
import { wipeDatabase } from './reset'

describe('wipeDatabase', () => {
  test('clears every table and reseeds one default branch', () => {
    const db = createDatabase(':memory:')
    const ali = createClient(db, { branch_id: 1, name: 'Ali' })
    const t = createTransaction(db, {
      branch_id: 1,
      client_id: ali.id,
      direction: 'lend',
      amount: 1000,
      currency: 'UZS'
    })
    addPayment(db, { transaction_id: t.id, amount: 500 })
    setSetting(db, 'pin_hash', 'somehash')
    setSetting(db, 'activation_code_id', 'override')

    wipeDatabase(db)

    const branches = db.prepare('SELECT id, name FROM branches').all() as { id: number; name: string }[]
    expect(branches).toEqual([{ id: 1, name: 'Asosiy' }])
    expect((db.prepare('SELECT COUNT(*) AS n FROM clients').get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n).toBe(0)
    expect((db.prepare('SELECT COUNT(*) AS n FROM payments').get() as { n: number }).n).toBe(0)
    expect(getSetting(db, 'pin_hash')).toBeNull()
    expect(getSetting(db, 'activation_code_id')).toBeNull()
  })

  test('does not violate the transaction_line_items foreign key when a transaction has line items', () => {
    const db = createDatabase(':memory:')
    const ali = createClient(db, { branch_id: 1, name: 'Ali' })
    createTransaction(db, {
      branch_id: 1,
      client_id: ali.id,
      direction: 'lend',
      amount: 1,
      currency: 'UZS',
      line_items: [{ product: 'Bread', quantity: 2, unit_price: 1000 }]
    })

    expect(() => wipeDatabase(db)).not.toThrow()
    expect(
      (db.prepare('SELECT COUNT(*) AS n FROM transaction_line_items').get() as { n: number }).n
    ).toBe(0)
  })

  test('the same connection stays usable afterward (no close/reopen)', () => {
    const db = createDatabase(':memory:')
    wipeDatabase(db)
    // A DatabaseSync that had been close()'d would throw on any further use.
    expect(() => createClient(db, { branch_id: 1, name: 'Bek' })).not.toThrow()
  })
})
