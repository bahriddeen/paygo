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

export function getPayment(db: DatabaseSync, id: number): Payment | null {
  return (
    (db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as unknown as Payment) ?? null
  )
}

export interface PaymentPatch {
  amount?: number
  method?: string | null
  note?: string | null
  paid_at?: number
}

/** Correct a mis-entered payment. The new amount may not exceed what's left on
 *  the transaction once this payment's own current amount is added back. */
export function updatePayment(db: DatabaseSync, id: number, patch: PaymentPatch): Payment {
  const current = getPayment(db, id)
  if (!current) throw new Error(`updatePayment: payment ${id} not found`)

  if (patch.amount !== undefined) {
    if (patch.amount <= 0) throw new Error('updatePayment: amount must be positive')
    const remaining = transactionRemaining(db, current.transaction_id)
    const maxAmount = remaining + current.amount
    if (patch.amount > maxAmount) {
      throw new Error(`updatePayment: amount ${patch.amount} exceeds remaining ${maxAmount}`)
    }
  }

  const fields: string[] = []
  const values: (string | number | null)[] = []
  for (const key of ['amount', 'method', 'note', 'paid_at'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(patch[key] as string | number | null)
    }
  }
  if (fields.length > 0) {
    db.prepare(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
  }

  const updated = getPayment(db, id)
  if (!updated) throw new Error(`updatePayment: payment ${id} not found`)
  return updated
}

/** Remove a wrongly entered payment, restoring its amount to the transaction's remaining. */
export function deletePayment(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM payments WHERE id = ?').run(id)
}

export interface PaymentWithTransaction {
  id: number
  transaction_id: number
  direction: 'lend' | 'borrow'
  description: string | null
  amount: number
  currency: CurrencyCode
  method: string | null
  note: string | null
  paid_at: number
}

/** Full payment history for one person (client or supplier), across all of
 *  their transactions regardless of direction — unlike listBranchPayments,
 *  which is scoped to "money received" and so filters to lend-only. */
export function listPaymentsByClient(db: DatabaseSync, clientId: number): PaymentWithTransaction[] {
  return db
    .prepare(
      `SELECT p.id, p.transaction_id, t.direction AS direction, t.description AS description,
        p.amount, p.currency, p.method, p.note, p.paid_at
       FROM payments p
       JOIN transactions t ON t.id = p.transaction_id
       WHERE t.client_id = ?
       ORDER BY p.paid_at DESC, p.id DESC`
    )
    .all(clientId) as unknown as PaymentWithTransaction[]
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
