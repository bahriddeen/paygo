import type { DatabaseSync } from 'node:sqlite'
import type { CurrencyCode } from '../../../shared/currency'
import { startOfDaySec } from './dateUtil'

export type Direction = 'lend' | 'borrow'

export interface Transaction {
  id: number
  branch_id: number
  client_id: number
  direction: Direction
  amount: number
  currency: CurrencyCode
  description: string | null
  issued_at: number
  due_at: number | null
  created_at: number
}

export interface TransactionWithBalance extends Transaction {
  client_name: string
  client_phone: string | null
  paid: number
  remaining: number
}

export interface NewTransaction {
  branch_id: number
  client_id: number
  direction: Direction
  amount: number
  currency: CurrencyCode
  description?: string | null
  issued_at?: number
  due_at?: number | null
}

export interface ListTransactionsOptions {
  clientId?: number
  limit?: number
  onlyOpen?: boolean
  overdue?: boolean
  dueSoonWithin?: number
  now?: number
}

const REMAINING_EXPR =
  't.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0)'

export function createTransaction(db: DatabaseSync, input: NewTransaction): Transaction {
  const info = db
    .prepare(
      `INSERT INTO transactions
         (branch_id, client_id, direction, amount, currency, description, issued_at, due_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, unixepoch()), ?)`
    )
    .run(
      input.branch_id,
      input.client_id,
      input.direction,
      input.amount,
      input.currency,
      input.description ?? null,
      input.issued_at ?? null,
      input.due_at ?? null
    )
  const created = getTransaction(db, Number(info.lastInsertRowid))
  if (!created) throw new Error('createTransaction: row not found after insert')
  return created
}

export function listTransactions(
  db: DatabaseSync,
  branchId: number,
  opts: ListTransactionsOptions = {}
): TransactionWithBalance[] {
  const clauses = ['t.branch_id = ?']
  const params: number[] = [branchId]

  if (opts.clientId) {
    clauses.push('t.client_id = ?')
    params.push(opts.clientId)
  }
  if (opts.overdue) {
    // A debt due "today" isn't overdue until today has fully passed.
    clauses.push("t.direction = 'lend'", 't.due_at IS NOT NULL', 't.due_at < ?')
    params.push(startOfDaySec(opts.now ?? Math.floor(Date.now() / 1000)))
  }
  if (opts.dueSoonWithin != null) {
    const now = opts.now ?? Math.floor(Date.now() / 1000)
    clauses.push("t.direction = 'lend'", 't.due_at IS NOT NULL', 't.due_at >= ?', 't.due_at <= ?')
    params.push(now, now + opts.dueSoonWithin)
  }
  if (opts.onlyOpen || opts.overdue || opts.dueSoonWithin != null) {
    clauses.push(`${REMAINING_EXPR} > 0`)
  }

  let sql = `SELECT t.*, c.name AS client_name, c.phone AS client_phone,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0) AS paid,
      ${REMAINING_EXPR} AS remaining
    FROM transactions t
    JOIN clients c ON c.id = t.client_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY t.issued_at DESC, t.id DESC`
  if (opts.limit) {
    sql += ' LIMIT ?'
    params.push(opts.limit)
  }
  return db.prepare(sql).all(...params) as unknown as TransactionWithBalance[]
}

export function getTransaction(db: DatabaseSync, id: number): Transaction | null {
  return (
    (db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as unknown as Transaction) ??
    null
  )
}

export function transactionRemaining(db: DatabaseSync, id: number): number {
  const row = db
    .prepare(`SELECT ${REMAINING_EXPR} AS remaining FROM transactions t WHERE t.id = ?`)
    .get(id) as { remaining: number } | undefined
  return row?.remaining ?? 0
}

export interface TransactionPatch {
  amount?: number
  currency?: CurrencyCode
  description?: string | null
  issued_at?: number
  due_at?: number | null
}

export function updateTransaction(
  db: DatabaseSync,
  id: number,
  patch: TransactionPatch
): Transaction {
  const current = getTransaction(db, id)
  if (!current) throw new Error(`updateTransaction: transaction ${id} not found`)

  if (patch.amount !== undefined) {
    const paid = current.amount - transactionRemaining(db, id)
    if (patch.amount < paid) {
      throw new Error(`updateTransaction: amount ${patch.amount} is below paid ${paid}`)
    }
  }

  const fields: string[] = []
  const values: (string | number | null)[] = []
  for (const key of ['amount', 'currency', 'description', 'issued_at', 'due_at'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(patch[key] as string | number | null)
    }
  }
  if (fields.length > 0) {
    db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
  }
  const updated = getTransaction(db, id)
  if (!updated) throw new Error(`updateTransaction: transaction ${id} not found`)
  return updated
}

/** Delete a transaction and its payments (a single atomic operation). */
export function deleteTransaction(db: DatabaseSync, id: number): void {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM payments WHERE transaction_id = ?').run(id)
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
