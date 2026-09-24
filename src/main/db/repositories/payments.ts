import type { DatabaseSync } from 'node:sqlite'
import type { CurrencyCode } from '../../../shared/currency'
import { getTransaction, transactionRemaining } from './transactions'

export interface Payment {
  id: number
  branch_id: number
  transaction_id: number
  amount: number
  currency: CurrencyCode
  method: string | null
  note: string | null
  paid_at: number
  created_at: number
}

export interface NewPayment {
  transaction_id: number
  amount: number
  method?: string | null
  note?: string | null
  paid_at?: number
}

/** Record an installment. Currency is inherited from the parent transaction; the
 *  amount may not exceed what remains on it. */
export function addPayment(db: DatabaseSync, input: NewPayment): Payment {
  const txn = getTransaction(db, input.transaction_id)
  if (!txn) throw new Error(`addPayment: transaction ${input.transaction_id} not found`)
  if (input.amount <= 0) throw new Error('addPayment: amount must be positive')
  const remaining = transactionRemaining(db, txn.id)
  if (input.amount > remaining) {
    throw new Error(`addPayment: amount ${input.amount} exceeds remaining ${remaining}`)
  }
  const info = db
    .prepare(
      `INSERT INTO payments (branch_id, transaction_id, amount, currency, method, note, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, unixepoch()))`
    )
    .run(
      txn.branch_id,
      txn.id,
      input.amount,
      txn.currency,
      input.method ?? null,
      input.note ?? null,
      input.paid_at ?? null
    )
  return db
    .prepare('SELECT * FROM payments WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as unknown as Payment
}

export function listPayments(db: DatabaseSync, transactionId: number): Payment[] {
  return db
    .prepare('SELECT * FROM payments WHERE transaction_id = ? ORDER BY paid_at DESC, id DESC')
    .all(transactionId) as unknown as Payment[]
}

export interface PaymentWithClient {
  id: number
  transaction_id: number
  client_id: number
  client_name: string
  amount: number
  currency: CurrencyCode
  method: string | null
  note: string | null
  paid_at: number
}

/**
 * Payments received for a branch within [from, to), joined with client info.
 * Only lend-side payments — a payment toward a borrow (supplier) debt is
 * money going out, not money received.
 */
export function listBranchPayments(
  db: DatabaseSync,
  branchId: number,
  range: { from: number; to: number }
): PaymentWithClient[] {
  return db
    .prepare(
      `SELECT p.id, p.transaction_id, t.client_id AS client_id, c.name AS client_name,
        p.amount, p.currency, p.method, p.note, p.paid_at
       FROM payments p
       JOIN transactions t ON t.id = p.transaction_id
       JOIN clients c ON c.id = t.client_id
       WHERE p.branch_id = ? AND p.paid_at >= ? AND p.paid_at < ? AND t.direction = 'lend'
       ORDER BY p.paid_at DESC, p.id DESC`
    )
    .all(branchId, range.from, range.to) as unknown as PaymentWithClient[]
}
