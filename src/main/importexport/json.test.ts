import { describe, test, expect } from 'vitest'
import { createDatabase } from '../db/createDatabase'
import { createBranch } from '../db/repositories/branches'
import { createClient, listClients } from '../db/repositories/clients'
import { createCategory, listCategories } from '../db/repositories/categories'
import { createTransaction, listTransactions } from '../db/repositories/transactions'
import { addPayment, listPayments } from '../db/repositories/payments'
import { exportData, importData } from './json'

function seed(db: ReturnType<typeof createDatabase>, branchId: number) {
  const cat = createCategory(db, branchId, 'Friends')
  const client = createClient(db, {
    branch_id: branchId,
    name: 'Ali',
    phone: '+998901112233',
    group_id: cat.id
  })
  const txn = createTransaction(db, {
    branch_id: branchId,
    client_id: client.id,
    direction: 'lend',
    amount: 150000,
    currency: 'UZS'
  })
  addPayment(db, { transaction_id: txn.id, amount: 50000 })
  return { cat, client, txn }
}

describe('exportData', () => {
  test('exports the default branch with its clients, categories, transactions, payments', () => {
    const db = createDatabase(':memory:')
    seed(db, 1)
    const dump = exportData(db, { branchId: 1 })
    expect(dump.schemaVersion).toBe(1)
    expect(dump.branches).toHaveLength(1)
    const b = dump.branches[0]
    expect(b.clients).toHaveLength(1)
    expect(b.categories).toHaveLength(1)
    expect(b.transactions).toHaveLength(1)
    expect(b.payments).toHaveLength(1)
  })

  test('exports all branches when no branchId given', () => {
    const db = createDatabase(':memory:')
    createBranch(db, 'Second')
    expect(exportData(db).branches).toHaveLength(2)
  })
})

describe('importData replace', () => {
  test('replaces all data in the target branch', () => {
    const src = createDatabase(':memory:')
    seed(src, 1)
    const dump = exportData(src, { branchId: 1 })

    const dest = createDatabase(':memory:')
    createClient(dest, { branch_id: 1, name: 'ToBeReplaced' })
    importData(dest, dump, { mode: 'replace' })

    const names = listClients(dest, 1).map((c) => c.name)
    expect(names).toEqual(['Ali'])
  })
})

describe('exportData / importData preserve kind (client vs supplier)', () => {
  test('a supplier and a supplier category stay suppliers after an export/import round trip', () => {
    const src = createDatabase(':memory:')
    const supplierCat = createCategory(src, 1, 'Vendors', 'supplier')
    const supplier = createClient(src, {
      branch_id: 1,
      name: 'Nur Savdo',
      kind: 'supplier',
      group_id: supplierCat.id
    })
    createTransaction(src, {
      branch_id: 1,
      client_id: supplier.id,
      direction: 'borrow',
      amount: 75000,
      currency: 'UZS'
    })
    const dump = exportData(src, { branchId: 1 })

    const dest = createDatabase(':memory:')
    importData(dest, dump, { mode: 'replace' })

    const importedSupplier = listClients(dest, 1, { kind: 'supplier' })[0]
    expect(importedSupplier?.name).toBe('Nur Savdo')
    expect(importedSupplier?.kind).toBe('supplier')

    const importedCats = listCategories(dest, 1, 'supplier')
    expect(importedCats.map((c) => c.name)).toEqual(['Vendors'])

    // The supplier must not have quietly become a client.
    expect(listClients(dest, 1, { kind: 'client' })).toHaveLength(0)
  })
})

describe('importData merge', () => {
  test('merges without colliding with existing ids and preserves balances', () => {
    const src = createDatabase(':memory:')
    const { client } = seed(src, 1)
    const dump = exportData(src, { branchId: 1 })

    const dest = createDatabase(':memory:')
    // Pre-existing client so ids overlap with the incoming dump.
    const existing = createClient(dest, { branch_id: 1, name: 'Existing' })
    importData(dest, dump, { mode: 'merge' })

    const clients = listClients(dest, 1)
    expect(clients.map((c) => c.name).sort()).toEqual(['Ali', 'Existing'])
    // Existing client is untouched.
    expect(clients.find((c) => c.id === existing.id)?.name).toBe('Existing')

    // Imported transaction keeps its remaining balance (150000 - 50000).
    const imported = listTransactions(dest, 1).find((tx) => tx.client_name === 'Ali')
    expect(imported?.remaining).toBe(100000)
    expect(imported?.client_id).not.toBe(client.id) // remapped
    expect(listPayments(dest, imported!.id)).toHaveLength(1)
  })

  test('remaps category assignment on merge', () => {
    const src = createDatabase(':memory:')
    seed(src, 1)
    const dump = exportData(src, { branchId: 1 })

    const dest = createDatabase(':memory:')
    createCategory(dest, 1, 'DestCat') // occupies id 1
    importData(dest, dump, { mode: 'merge' })

    const cats = listCategories(dest, 1)
    expect(cats.map((c) => c.name).sort()).toEqual(['DestCat', 'Friends'])
    const ali = listClients(dest, 1).find((c) => c.name === 'Ali')
    const friends = cats.find((c) => c.name === 'Friends')
    expect(ali?.group_id).toBe(friends?.id)
  })
})
