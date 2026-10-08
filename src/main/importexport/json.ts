import type { DatabaseSync } from 'node:sqlite'

export interface BranchDump {
  name: string
  categories: { id: number; name: string; kind: string }[]
  clients: {
    id: number
    group_id: number | null
    name: string
    kind: string
    phone: string | null
    description: string | null
    trust_level: number
    created_at: number
    is_demo: number
  }[]
  transactions: {
    id: number
    client_id: number
    direction: string
    amount: number
    currency: string
    description: string | null
    issued_at: number
    due_at: number | null
    is_demo: number
  }[]
  payments: {
    id: number
    transaction_id: number
    amount: number
    currency: string
    method: string | null
    note: string | null
    paid_at: number
  }[]
  lineItems: {
    transaction_id: number
    position: number
    product: string
    quantity: number
    unit_price: number
    total: number
  }[]
}

export interface DataDump {
  schemaVersion: number
  exportedAt: number
  branches: BranchDump[]
}

const SCHEMA_VERSION = 1

function dumpBranch(db: DatabaseSync, branchId: number, name: string): BranchDump {
  const all = <T>(sql: string): T[] => db.prepare(sql).all(branchId) as unknown as T[]
  return {
    name,
    categories: all('SELECT id, name, kind FROM client_groups WHERE branch_id = ?'),
    clients: all(
      `SELECT id, group_id, name, kind, phone, description, trust_level, created_at, is_demo
       FROM clients WHERE branch_id = ? AND archived_at IS NULL`
    ),
    transactions: all(
      `SELECT id, client_id, direction, amount, currency, description, issued_at, due_at, is_demo
       FROM transactions WHERE branch_id = ?`
    ),
    payments: all(
      `SELECT id, transaction_id, amount, currency, method, note, paid_at
       FROM payments WHERE branch_id = ?`
    ),
    lineItems: all(
      `SELECT li.transaction_id, li.position, li.product, li.quantity, li.unit_price, li.total
       FROM transaction_line_items li
       JOIN transactions t ON t.id = li.transaction_id
       WHERE t.branch_id = ?`
    )
  }
}

export function exportData(db: DatabaseSync, opts: { branchId?: number } = {}): DataDump {
  const branchRows = (
    opts.branchId
      ? db.prepare('SELECT id, name FROM branches WHERE id = ?').all(opts.branchId)
      : db.prepare('SELECT id, name FROM branches ORDER BY id').all()
  ) as unknown as { id: number; name: string }[]

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    branches: branchRows.map((b) => dumpBranch(db, b.id, b.name))
  }
}

/** Insert one branch's dump under `targetBranchId`, remapping all internal ids. */
function insertBranchDump(db: DatabaseSync, dump: BranchDump, targetBranchId: number): void {
  const catId = new Map<number, number>()
  for (const c of dump.categories) {
    const info = db
      .prepare('INSERT INTO client_groups (branch_id, name, kind) VALUES (?, ?, ?)')
      .run(targetBranchId, c.name, c.kind ?? 'client')
    catId.set(c.id, Number(info.lastInsertRowid))
  }

  const clientId = new Map<number, number>()
  for (const c of dump.clients) {
    const info = db
      .prepare(
        `INSERT INTO clients (branch_id, group_id, name, kind, phone, description, trust_level, created_at, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        targetBranchId,
        c.group_id != null ? (catId.get(c.group_id) ?? null) : null,
        c.name,
        c.kind ?? 'client',
        c.phone,
        c.description,
        c.trust_level,
        c.created_at,
        c.is_demo ?? 0
      )
    clientId.set(c.id, Number(info.lastInsertRowid))
  }

  const txnId = new Map<number, number>()
  for (const tx of dump.transactions) {
    const mappedClient = clientId.get(tx.client_id)
    if (mappedClient == null) continue // orphan guard
    const info = db
      .prepare(
        `INSERT INTO transactions (branch_id, client_id, direction, amount, currency, description, issued_at, due_at, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        targetBranchId,
        mappedClient,
        tx.direction,
        tx.amount,
        tx.currency,
        tx.description,
        tx.issued_at,
        tx.due_at,
        tx.is_demo ?? 0
      )
    txnId.set(tx.id, Number(info.lastInsertRowid))
  }

  for (const p of dump.payments) {
    const mappedTxn = txnId.get(p.transaction_id)
    if (mappedTxn == null) continue
    db.prepare(
      `INSERT INTO payments (branch_id, transaction_id, amount, currency, method, note, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(targetBranchId, mappedTxn, p.amount, p.currency, p.method, p.note, p.paid_at)
  }

  for (const li of dump.lineItems ?? []) {
    const mappedTxn = txnId.get(li.transaction_id)
    if (mappedTxn == null) continue
    db.prepare(
      `INSERT INTO transaction_line_items (transaction_id, position, product, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(mappedTxn, li.position, li.product, li.quantity, li.unit_price, li.total)
  }
}

function wipeBranch(db: DatabaseSync, branchId: number): void {
  db.prepare(
    `DELETE FROM transaction_line_items
     WHERE transaction_id IN (SELECT id FROM transactions WHERE branch_id = ?)`
  ).run(branchId)
  db.prepare('DELETE FROM payments WHERE branch_id = ?').run(branchId)
  db.prepare('DELETE FROM transactions WHERE branch_id = ?').run(branchId)
  db.prepare('DELETE FROM clients WHERE branch_id = ?').run(branchId)
  db.prepare('DELETE FROM client_groups WHERE branch_id = ?').run(branchId)
}

/**
 * Import a dump.
 * - replace: wipe the target branch(es) first, then insert.
 * - merge: insert alongside existing data, remapping ids so nothing collides.
 * When `branchId` is given, all dump branches import into it; otherwise each
 * dump branch maps to an existing branch by name, creating it if missing.
 */
export function importData(
  db: DatabaseSync,
  dump: DataDump,
  opts: { mode: 'merge' | 'replace'; branchId?: number }
): void {
  db.exec('BEGIN')
  try {
    for (const branch of dump.branches) {
      let targetId = opts.branchId
      if (targetId == null) {
        const existing = db
          .prepare('SELECT id FROM branches WHERE name = ?')
          .get(branch.name) as { id: number } | undefined
        targetId =
          existing?.id ??
          Number(db.prepare('INSERT INTO branches (name) VALUES (?)').run(branch.name).lastInsertRowid)
      }
      if (opts.mode === 'replace') wipeBranch(db, targetId)
      insertBranchDump(db, branch, targetId)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
