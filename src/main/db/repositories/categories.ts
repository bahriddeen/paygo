import type { DatabaseSync } from 'node:sqlite'
import type { ClientKind } from './clients'

export interface Category {
  id: number
  branch_id: number
  kind: ClientKind
  name: string
  count: number
}

export function listCategories(db: DatabaseSync, branchId: number, kind?: ClientKind): Category[] {
  const clauses = ['g.branch_id = ?']
  const params: (string | number)[] = [branchId]
  if (kind) {
    clauses.push('g.kind = ?')
    params.push(kind)
  }
  return db
    .prepare(
      `SELECT g.id, g.branch_id, g.kind, g.name,
        (SELECT COUNT(*) FROM clients c WHERE c.group_id = g.id AND c.archived_at IS NULL) AS count
       FROM client_groups g
       WHERE ${clauses.join(' AND ')}
       ORDER BY g.name COLLATE NOCASE`
    )
    .all(...params) as unknown as Category[]
}

export function createCategory(
  db: DatabaseSync,
  branchId: number,
  name: string,
  kind: ClientKind = 'client'
): Category {
  const info = db
    .prepare('INSERT INTO client_groups (branch_id, name, kind) VALUES (?, ?, ?)')
    .run(branchId, name, kind)
  return { id: Number(info.lastInsertRowid), branch_id: branchId, kind, name, count: 0 }
}

export function renameCategory(db: DatabaseSync, id: number, name: string): Category {
  db.prepare('UPDATE client_groups SET name = ? WHERE id = ?').run(name, id)
  return db
    .prepare(
      `SELECT g.id, g.branch_id, g.kind, g.name,
        (SELECT COUNT(*) FROM clients c WHERE c.group_id = g.id AND c.archived_at IS NULL) AS count
       FROM client_groups g WHERE g.id = ?`
    )
    .get(id) as unknown as Category
}

export function deleteCategory(db: DatabaseSync, id: number): void {
  // clients.group_id is ON DELETE SET NULL, so members are simply unassigned.
  db.prepare('DELETE FROM client_groups WHERE id = ?').run(id)
}
