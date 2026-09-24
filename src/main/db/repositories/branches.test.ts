import { describe, test, expect } from 'vitest'
import { createDatabase } from '../createDatabase'
import { listBranches, createBranch, renameBranch, getBranch, deleteBranch } from './branches'
import { createClient } from './clients'

describe('branches repo', () => {
  test('a seeded default branch exists', () => {
    const db = createDatabase(':memory:')
    expect(listBranches(db)).toHaveLength(1)
  })

  test('createBranch inserts and returns the row', () => {
    const db = createDatabase(':memory:')
    const b = createBranch(db, 'Bozor')
    expect(b.id).toBeGreaterThan(0)
    expect(b.name).toBe('Bozor')
    expect(listBranches(db).some((x) => x.name === 'Bozor')).toBe(true)
  })

  test('renameBranch changes the name', () => {
    const db = createDatabase(':memory:')
    const b = createBranch(db, 'A')
    expect(renameBranch(db, b.id, 'B').name).toBe('B')
    expect(getBranch(db, b.id)?.name).toBe('B')
  })

  test('cannot delete the last branch', () => {
    const db = createDatabase(':memory:')
    const only = listBranches(db)[0]
    expect(deleteBranch(db, only.id).ok).toBe(false)
  })

  test('cannot delete a branch that has clients', () => {
    const db = createDatabase(':memory:')
    const b = createBranch(db, 'B')
    createClient(db, { branch_id: b.id, name: 'Ali' })
    expect(deleteBranch(db, b.id).ok).toBe(false)
    expect(listBranches(db).some((x) => x.id === b.id)).toBe(true)
  })

  test('deletes an empty non-last branch', () => {
    const db = createDatabase(':memory:')
    const b = createBranch(db, 'B')
    expect(deleteBranch(db, b.id).ok).toBe(true)
    expect(listBranches(db).some((x) => x.id === b.id)).toBe(false)
  })
})
