import { describe, test, expect } from 'vitest'
import { createDatabase } from '../createDatabase'
import { createClient, getClient } from './clients'
import { createBranch } from './branches'
import { listCategories, createCategory, renameCategory, deleteCategory } from './categories'

describe('categories repo', () => {
  test('createCategory then list shows it with a client count', () => {
    const db = createDatabase(':memory:')
    const cat = createCategory(db, 1, 'Friends')
    expect(cat.name).toBe('Friends')
    createClient(db, { branch_id: 1, name: 'Ali', group_id: cat.id })
    const found = listCategories(db, 1).find((c) => c.id === cat.id)
    expect(found?.count).toBe(1)
  })

  test('createCategory defaults to client kind; listCategories kind filters', () => {
    const db = createDatabase(':memory:')
    const clientCat = createCategory(db, 1, 'Friends')
    expect(clientCat.kind).toBe('client')
    const supplierCat = createCategory(db, 1, 'Food vendors', 'supplier')
    expect(supplierCat.kind).toBe('supplier')

    expect(listCategories(db, 1, 'client').map((c) => c.name)).toEqual(['Friends'])
    expect(listCategories(db, 1, 'supplier').map((c) => c.name)).toEqual(['Food vendors'])
    expect(listCategories(db, 1)).toHaveLength(2) // omitted kind -> both
  })

  test('categories are scoped to their branch', () => {
    const db = createDatabase(':memory:')
    const b2 = createBranch(db, 'Branch 2').id
    createCategory(db, 1, 'A')
    createCategory(db, b2, 'B')
    expect(listCategories(db, 1).map((c) => c.name)).toEqual(['A'])
  })

  test('renameCategory changes the name', () => {
    const db = createDatabase(':memory:')
    const cat = createCategory(db, 1, 'Old')
    expect(renameCategory(db, cat.id, 'New').name).toBe('New')
  })

  test('deleteCategory unassigns its clients and removes it', () => {
    const db = createDatabase(':memory:')
    const cat = createCategory(db, 1, 'X')
    const cid = createClient(db, { branch_id: 1, name: 'A', group_id: cat.id }).id
    deleteCategory(db, cat.id)
    expect(getClient(db, cid)?.group_id).toBeNull()
    expect(listCategories(db, 1)).toHaveLength(0)
  })
})
