import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDatabase } from '../db/createDatabase'
import { createClient } from '../db/repositories/clients'
import { getSetting, setSetting } from '../db/repositories/settings'
import { importData, type DataDump } from './json'
import { listClients } from '../db/repositories/clients'
import { runBackup, maybeAutoBackup, BACKUP_FILENAME } from './backup'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qarz-backup-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('runBackup', () => {
  test('writes a valid backup file that re-imports into a fresh db', () => {
    const src = createDatabase(':memory:')
    createClient(src, { branch_id: 1, name: 'Ali' })
    const path = runBackup(src, dir)
    expect(existsSync(path)).toBe(true)
    expect(path.endsWith(BACKUP_FILENAME)).toBe(true)
    expect(Number(getSetting(src, 'backup_last'))).toBeGreaterThan(0)

    const dump = JSON.parse(readFileSync(path, 'utf8')) as DataDump
    const dest = createDatabase(':memory:')
    importData(dest, dump, { mode: 'replace' })
    expect(listClients(dest, 1).map((c) => c.name)).toEqual(['Ali'])
  })
})

describe('maybeAutoBackup', () => {
  test('does nothing when schedule is off', () => {
    const db = createDatabase(':memory:')
    setSetting(db, 'backup_folder', dir)
    setSetting(db, 'backup_schedule', 'off')
    expect(maybeAutoBackup(db)).toBeNull()
  })

  test('does nothing when no folder is set', () => {
    const db = createDatabase(':memory:')
    setSetting(db, 'backup_schedule', 'daily')
    expect(maybeAutoBackup(db)).toBeNull()
  })

  test('runs when due and skips when recently backed up', () => {
    const db = createDatabase(':memory:')
    setSetting(db, 'backup_folder', dir)
    setSetting(db, 'backup_schedule', 'daily')
    expect(maybeAutoBackup(db)).not.toBeNull() // first run: due
    expect(maybeAutoBackup(db)).toBeNull() // just backed up: not due
  })
})
