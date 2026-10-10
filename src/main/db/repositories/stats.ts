import type { DatabaseSync } from 'node:sqlite'
import type { CurrencyCode } from '../../../shared/currency'

export interface DebtSeriesPoint {
  date: string
  lent: number
  paid: number
}

export interface TopDebtor {
  client_id: number
  name: string
  remaining: number
}

/** Daily lent (new debts) vs paid (installments) for one currency, within [from, to). */
export function debtSeries(
  db: DatabaseSync,
  branchId: number,
  currency: CurrencyCode,
  fromSec: number,
  toSec: number
): DebtSeriesPoint[] {
  const lent = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', t.issued_at, 'unixepoch', 'localtime') AS date, SUM(t.amount) AS total
       FROM transactions t
       WHERE t.branch_id = ? AND t.direction = 'lend' AND t.currency = ?
         AND t.issued_at >= ? AND t.issued_at < ?
       GROUP BY date`
    )
    .all(branchId, currency, fromSec, toSec) as unknown as { date: string; total: number }[]

  // Only lend-side payments count as "paid off" — a payment toward a borrow
  // (supplier) debt is money going out, not debt being collected.
  const paid = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', p.paid_at, 'unixepoch', 'localtime') AS date, SUM(p.amount) AS total
       FROM payments p
       JOIN transactions t ON t.id = p.transaction_id
       WHERE p.branch_id = ? AND p.currency = ? AND p.paid_at >= ? AND p.paid_at < ?
         AND t.direction = 'lend'
       GROUP BY date`
    )
    .all(branchId, currency, fromSec, toSec) as unknown as { date: string; total: number }[]

  const byDate = new Map<string, DebtSeriesPoint>()
  for (const r of lent) byDate.set(r.date, { date: r.date, lent: r.total, paid: 0 })
  for (const r of paid) {
    const point = byDate.get(r.date) ?? { date: r.date, lent: 0, paid: 0 }
    point.paid = r.total
    byDate.set(r.date, point)
  }
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date))
}

/** Clients ranked by outstanding lend remaining in one currency (highest first). */
export function topDebtors(
  db: DatabaseSync,
  branchId: number,
  currency: CurrencyCode,
  limit: number
): TopDebtor[] {
  return db
    .prepare(
      `SELECT c.id AS client_id, c.name AS name, SUM(x.remaining) AS remaining
       FROM (
         SELECT t.client_id AS client_id,
           t.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0) AS remaining
         FROM transactions t
         WHERE t.branch_id = ? AND t.direction = 'lend' AND t.currency = ?
       ) x
       JOIN clients c ON c.id = x.client_id
       GROUP BY x.client_id
       HAVING SUM(x.remaining) > 0
       ORDER BY remaining DESC
       LIMIT ?`
    )
    .all(branchId, currency, limit) as unknown as TopDebtor[]
}
