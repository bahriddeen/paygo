import type { DatabaseSync } from 'node:sqlite'

export interface Branch {
  id: number
  name: string
  created_at: number
}

export function listBranches(db: DatabaseSync): Branch[] {
  return db
    .prepare('SELECT id, name, created_at FROM branches ORDER BY name')
    .all() as unknown as Branch[]
}

export function getBranch(db: DatabaseSync, id: number): Branch | null {
  return (
    (db.prepare('SELECT id, name, created_at FROM branches WHERE id = ?').get(id) as unknown as Branch) ??
    null
  )
}

export function createBranch(db: DatabaseSync, name: string): Branch {
  const info = db.prepare('INSERT INTO branches (name) VALUES (?)').run(name)
  const created = getBranch(db, Number(info.lastInsertRowid))
  if (!created) throw new Error('createBranch: row not found after insert')
  return created
}

export function renameBranch(db: DatabaseSync, id: number, name: string): Branch {
  db.prepare('UPDATE branches SET name = ? WHERE id = ?').run(name, id)
  const updated = getBranch(db, id)
  if (!updated) throw new Error(`renameBranch: branch ${id} not found`)
  return updated
}

/** Delete a branch. Refuses the last remaining branch or one that still has clients. */
export function deleteBranch(db: DatabaseSync, id: number): { ok: boolean; reason?: string } {
  const total = (db.prepare('SELECT COUNT(*) AS n FROM branches').get() as { n: number }).n
  if (total <= 1) return { ok: false, reason: 'last' }
  const clients = (
    db.prepare('SELECT COUNT(*) AS n FROM clients WHERE branch_id = ?').get(id) as { n: number }
  ).n
  if (clients > 0) return { ok: false, reason: 'not_empty' }
  db.prepare('DELETE FROM client_groups WHERE branch_id = ?').run(id)
  db.prepare('DELETE FROM branches WHERE id = ?').run(id)
  return { ok: true }
}
