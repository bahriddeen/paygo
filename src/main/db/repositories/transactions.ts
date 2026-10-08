import type { DatabaseSync } from 'node:sqlite'
import type { CurrencyCode } from '../../../shared/currency'
import type { ClientKind } from './clients'
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
  client_kind: ClientKind
  paid: number
  remaining: number
}

export interface LineItemInput {
  product: string
  quantity: number
  unit_price: number
}

export interface LineItem extends LineItemInput {
  id: number
  transaction_id: number
  position: number
  total: number
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
  line_items?: LineItemInput[]
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

/** Deletes any existing line items for the transaction and inserts the given ones,
 * recomputing each row's total server-side. Returns the summed total (the new
 * authoritative `amount`). */
function replaceLineItems(db: DatabaseSync, transactionId: number, items: LineItemInput[]): number {
  db.prepare('DELETE FROM transaction_line_items WHERE transaction_id = ?').run(transactionId)
  let sum = 0
  items.forEach((item, position) => {
    const total = Math.round(item.quantity * item.unit_price)
    sum += total
    db.prepare(
      `INSERT INTO transaction_line_items
         (transaction_id, position, product, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(transactionId, position, item.product, item.quantity, item.unit_price, total)
  })
  return sum
}

export function listLineItems(db: DatabaseSync, transactionId: number): LineItem[] {
  return db
    .prepare('SELECT * FROM transaction_line_items WHERE transaction_id = ? ORDER BY position')
    .all(transactionId) as unknown as LineItem[]
}

export function createTransaction(db: DatabaseSync, input: NewTransaction): Transaction {
  db.exec('BEGIN')
  try {
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
    const id = Number(info.lastInsertRowid)
    if (input.line_items && input.line_items.length > 0) {
      const amount = replaceLineItems(db, id, input.line_items)
      db.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(amount, id)
    }
    db.exec('COMMIT')
    const created = getTransaction(db, id)
    if (!created) throw new Error('createTransaction: row not found after insert')
    return created
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
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
    // A debt due "today" (stored as local midnight) must still count as due
    // soon after midnight has passed today — compare from the start of the
    // day, not the exact current moment, matching the overdue convention.
    clauses.push("t.direction = 'lend'", 't.due_at IS NOT NULL', 't.due_at >= ?', 't.due_at <= ?')
    params.push(startOfDaySec(now), now + opts.dueSoonWithin)
  }
  if (opts.onlyOpen || opts.overdue || opts.dueSoonWithin != null) {
    clauses.push(`${REMAINING_EXPR} > 0`)
  }

  let sql = `SELECT t.*, c.name AS client_name, c.phone AS client_phone, c.kind AS client_kind,
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
  /** undefined = leave line items untouched; null = delete them (revert to a plain
   * manual amount); an array = replace them and recompute `amount` from their sum. */
  line_items?: LineItemInput[] | null
}

export function updateTransaction(
  db: DatabaseSync,
  id: number,
  patch: TransactionPatch
): Transaction {
  const current = getTransaction(db, id)
  if (!current) throw new Error(`updateTransaction: transaction ${id} not found`)

  db.exec('BEGIN')
  try {
    if (patch.line_items === null) {
      db.prepare('DELETE FROM transaction_line_items WHERE transaction_id = ?').run(id)
    } else if (patch.line_items && patch.line_items.length > 0) {
      patch.amount = replaceLineItems(db, id, patch.line_items)
    }

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
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  const updated = getTransaction(db, id)
  if (!updated) throw new Error(`updateTransaction: transaction ${id} not found`)
  return updated
}

/** Delete a transaction, its line items, and its payments (a single atomic operation). */
export function deleteTransaction(db: DatabaseSync, id: number): void {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM transaction_line_items WHERE transaction_id = ?').run(id)
    db.prepare('DELETE FROM payments WHERE transaction_id = ?').run(id)
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
