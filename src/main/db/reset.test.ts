import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from './repositories/clients'
import { createDatabase } from './createDatabase'
import { resetDatabaseFile } from './reset'

let dir: string
let dbPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qarz-reset-test-'))
  dbPath = join(dir, 'qarz.db')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('resetDatabaseFile', () => {
  test('deletes the db file and its -wal/-shm siblings', () => {
    const db = createDatabase(dbPath)
    createClient(db, { branch_id: 1, name: 'Ali' }) // forces a WAL write

    resetDatabaseFile(db, dbPath)

    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
  })

  test('a fresh createDatabase at the same path afterward is a clean, migrated DB', () => {
    const db = createDatabase(dbPath)
    createClient(db, { branch_id: 1, name: 'Ali' })
    resetDatabaseFile(db, dbPath)

    const fresh = createDatabase(dbPath)
    const branches = fresh.prepare('SELECT COUNT(*) AS n FROM branches').get() as { n: number }
    const clients = fresh.prepare('SELECT COUNT(*) AS n FROM clients').get() as { n: number }
    expect(branches.n).toBe(1) // the seeded default branch
    expect(clients.n).toBe(0)
  })
})
