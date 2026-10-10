import type { DatabaseSync } from 'node:sqlite'

export type ClientKind = 'client' | 'supplier'

export interface Client {
  id: number
  branch_id: number
  group_id: number | null
  kind: ClientKind
  name: string
  phone: string | null
  description: string | null
  trust_level: number
  created_at: number
  updated_at: number
}

export type ClientSort = 'name' | 'newest' | 'trust'

export interface NewClient {
  branch_id: number
  name: string
  kind?: ClientKind
  phone?: string | null
  description?: string | null
  trust_level?: number
  group_id?: number | null
}

export interface ClientPatch {
  name?: string
  phone?: string | null
  description?: string | null
  trust_level?: number
  group_id?: number | null
}

const ORDER_BY: Record<ClientSort, string> = {
  name: 'name COLLATE NOCASE ASC',
  newest: 'created_at DESC, id DESC',
  trust: 'trust_level DESC, name COLLATE NOCASE ASC'
}

export function createClient(db: DatabaseSync, input: NewClient): Client {
  const info = db
    .prepare(
      `INSERT INTO clients (branch_id, name, kind, phone, description, trust_level, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.branch_id,
      input.name,
      input.kind ?? 'client',
      input.phone ?? null,
      input.description ?? null,
      input.trust_level ?? 3,
      input.group_id ?? null
    )
  const created = getClient(db, Number(info.lastInsertRowid))
  if (!created) throw new Error('createClient: row not found after insert')
  return created
}

export function listClients(
  db: DatabaseSync,
  branchId: number,
  opts?: { search?: string; sort?: ClientSort; kind?: ClientKind }
): Client[] {
  const order = ORDER_BY[opts?.sort ?? 'name']
  const search = opts?.search?.trim()
  const clauses = ['branch_id = ?']
  const params: (string | number)[] = [branchId]
  if (opts?.kind) {
    clauses.push('kind = ?')
    params.push(opts.kind)
  }
  if (search) {
    clauses.push('name LIKE ?')
    params.push(`%${search}%`)
  }
  return db
    .prepare(`SELECT * FROM clients WHERE ${clauses.join(' AND ')} ORDER BY ${order}`)
    .all(...params) as unknown as Client[]
}

export function getClient(db: DatabaseSync, id: number): Client | null {
  return (db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as unknown as Client) ?? null
}

export function updateClient(db: DatabaseSync, id: number, patch: ClientPatch): Client {
  const fields: string[] = []
  const values: (string | number | null)[] = []
  for (const key of ['name', 'phone', 'description', 'trust_level', 'group_id'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(patch[key] as string | number | null)
    }
  }
  if (fields.length > 0) {
    db.prepare(
      `UPDATE clients SET ${fields.join(', ')}, updated_at = unixepoch() WHERE id = ?`
    ).run(...values, id)
  }
  const updated = getClient(db, id)
  if (!updated) throw new Error(`updateClient: client ${id} not found`)
  return updated
}

/** Permanently remove a client and every transaction/payment/line item that
 *  belongs to them — there is no archive/undo; this is a hard delete. */
export function deleteClient(db: DatabaseSync, id: number): void {
  db.exec('BEGIN')
  try {
    db.prepare(
      `DELETE FROM transaction_line_items
       WHERE transaction_id IN (SELECT id FROM transactions WHERE client_id = ?)`
    ).run(id)
    db.prepare('DELETE FROM payments WHERE transaction_id IN (SELECT id FROM transactions WHERE client_id = ?)').run(
      id
    )
    db.prepare('DELETE FROM transactions WHERE client_id = ?').run(id)
    db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
