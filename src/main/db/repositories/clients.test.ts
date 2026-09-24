import { describe, test, expect, beforeEach } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { createDatabase } from '../createDatabase'
import { createClient, listClients, getClient, updateClient, archiveClient } from './clients'

let db: DatabaseSync

beforeEach(() => {
  // Fresh in-memory DB with migrations + the seeded default branch (id 1).
  db = createDatabase(':memory:')
})

describe('clients repo', () => {
  test('createClient inserts and returns the row with defaults', () => {
    const c = createClient(db, { branch_id: 1, name: 'Ali' })
    expect(c.id).toBeGreaterThan(0)
    expect(c.name).toBe('Ali')
    expect(c.trust_level).toBe(3)
    expect(c.phone).toBeNull()
    expect(c.archived_at).toBeNull()
    expect(c.kind).toBe('client')
  })

  test('createClient accepts an explicit supplier kind', () => {
    const c = createClient(db, { branch_id: 1, name: 'Acme Supply', kind: 'supplier' })
    expect(c.kind).toBe('supplier')
  })

  test('listClients kind filters clients vs suppliers', () => {
    createClient(db, { branch_id: 1, name: 'Ali' })
    createClient(db, { branch_id: 1, name: 'Acme Supply', kind: 'supplier' })
    expect(listClients(db, 1, { kind: 'client' }).map((c) => c.name)).toEqual(['Ali'])
    expect(listClients(db, 1, { kind: 'supplier' }).map((c) => c.name)).toEqual(['Acme Supply'])
    expect(listClients(db, 1)).toHaveLength(2) // omitted kind -> both
  })

  test('listClients returns only the given branch, non-archived', () => {
    db.prepare("INSERT INTO branches (name) VALUES ('B2')").run()
    createClient(db, { branch_id: 1, name: 'Ali' })
    createClient(db, { branch_id: 2, name: 'Bek' })
    expect(listClients(db, 1).map((c) => c.name)).toEqual(['Ali'])
  })

  test('listClients search filters by name substring, case-insensitive', () => {
    createClient(db, { branch_id: 1, name: 'Ali Valiyev' })
    createClient(db, { branch_id: 1, name: 'Bek Toshmatov' })
    expect(listClients(db, 1, { search: 'val' }).map((c) => c.name)).toEqual(['Ali Valiyev'])
  })

  test('listClients sorts by name A-Z', () => {
    createClient(db, { branch_id: 1, name: 'Bek' })
    createClient(db, { branch_id: 1, name: 'Ali' })
    expect(listClients(db, 1, { sort: 'name' }).map((c) => c.name)).toEqual(['Ali', 'Bek'])
  })

  test('listClients sorts by trust level, highest first', () => {
    createClient(db, { branch_id: 1, name: 'Low', trust_level: 1 })
    createClient(db, { branch_id: 1, name: 'High', trust_level: 5 })
    expect(listClients(db, 1, { sort: 'trust' }).map((c) => c.name)).toEqual(['High', 'Low'])
  })

  test('archiveClient removes the client from the list but keeps the row', () => {
    const c = createClient(db, { branch_id: 1, name: 'Ali' })
    archiveClient(db, c.id)
    expect(listClients(db, 1)).toHaveLength(0)
    expect(getClient(db, c.id)?.archived_at).not.toBeNull()
  })

  test('updateClient changes provided fields only', () => {
    const c = createClient(db, { branch_id: 1, name: 'Ali', trust_level: 2, phone: '+998901112233' })
    const u = updateClient(db, c.id, { name: 'Ali V', trust_level: 5 })
    expect(u.name).toBe('Ali V')
    expect(u.trust_level).toBe(5)
    expect(u.phone).toBe('+998901112233') // untouched
  })
})
