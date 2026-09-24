import type { DatabaseSync } from 'node:sqlite'
import type { CurrencyCode } from '../../../shared/currency'
import type { Direction } from './transactions'
import { startOfDaySec } from './dateUtil'

export interface CurrencyAmount {
  currency: CurrencyCode
  amount: number
}

export interface DashboardSummary {
  outstanding: CurrencyAmount[]
  outstandingClients: number
  openDebts: number
  youOwe: CurrencyAmount[]
  todayPayments: CurrencyAmount[]
  todayPaymentsCount: number
  overdue: CurrencyAmount[]
  overdueCount: number
}

export interface DirectionBalance {
  currency: CurrencyCode
  direction: Direction
  remaining: number
}

const PER_TXN_REMAINING =
  't.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0) AS remaining'

/** Sum of open (remaining > 0) transactions in one direction, grouped by currency. */
function sumOpenByCurrency(
  db: DatabaseSync,
  branchId: number,
  direction: Direction
): CurrencyAmount[] {
  return db
    .prepare(
      `SELECT currency, SUM(remaining) AS amount FROM (
         SELECT t.currency AS currency, ${PER_TXN_REMAINING}
         FROM transactions t
         WHERE t.branch_id = ? AND t.direction = ?
       )
       WHERE remaining > 0
       GROUP BY currency
       ORDER BY currency`
    )
    .all(branchId, direction) as unknown as CurrencyAmount[]
}

export function dashboardSummary(
  db: DatabaseSync,
  branchId: number,
  now: number = Math.floor(Date.now() / 1000)
): DashboardSummary {
  const dayStart = startOfDaySec(now)
  const outstanding = sumOpenByCurrency(db, branchId, 'lend')
  const youOwe = sumOpenByCurrency(db, branchId, 'borrow')

  const openCounts = db
    .prepare(
      `SELECT COUNT(*) AS debts, COUNT(DISTINCT client_id) AS clients FROM (
         SELECT t.client_id AS client_id, ${PER_TXN_REMAINING}
         FROM transactions t
         WHERE t.branch_id = ? AND t.direction = 'lend'
       )
       WHERE remaining > 0`
    )
    .get(branchId) as { debts: number; clients: number }

  const overdue = db
    .prepare(
      `SELECT currency, SUM(remaining) AS amount FROM (
         SELECT t.currency AS currency, ${PER_TXN_REMAINING}
         FROM transactions t
         WHERE t.branch_id = ? AND t.direction = 'lend'
           AND t.due_at IS NOT NULL AND t.due_at < ?
       )
       WHERE remaining > 0
       GROUP BY currency
       ORDER BY currency`
    )
    .all(branchId, dayStart) as unknown as CurrencyAmount[]

  const overdueCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT ${PER_TXN_REMAINING}
           FROM transactions t
           WHERE t.branch_id = ? AND t.direction = 'lend'
             AND t.due_at IS NOT NULL AND t.due_at < ?
         )
         WHERE remaining > 0`
      )
      .get(branchId, dayStart) as { n: number }
  ).n

  // Only payments toward lend debts count as "received today" — a payment
  // toward a borrow (supplier) debt is money going out, not coming in.
  const todayPayments = db
    .prepare(
      `SELECT p.currency AS currency, SUM(p.amount) AS amount
       FROM payments p
       JOIN transactions t ON t.id = p.transaction_id
       WHERE p.branch_id = ? AND p.paid_at >= ? AND t.direction = 'lend'
       GROUP BY p.currency
       ORDER BY p.currency`
    )
    .all(branchId, dayStart) as unknown as CurrencyAmount[]

  const todayPaymentsCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         WHERE p.branch_id = ? AND p.paid_at >= ? AND t.direction = 'lend'`
      )
      .get(branchId, dayStart) as { n: number }
  ).n

  return {
    outstanding,
    outstandingClients: openCounts.clients,
    openDebts: openCounts.debts,
    youOwe,
    todayPayments,
    todayPaymentsCount,
    overdue,
    overdueCount
  }
}

export function clientBalance(db: DatabaseSync, clientId: number): DirectionBalance[] {
  return db
    .prepare(
      `SELECT currency, direction, SUM(remaining) AS remaining FROM (
         SELECT t.currency AS currency, t.direction AS direction, ${PER_TXN_REMAINING}
         FROM transactions t
         WHERE t.client_id = ?
       )
       GROUP BY currency, direction
       HAVING SUM(remaining) > 0
       ORDER BY currency, direction`
    )
    .all(clientId) as unknown as DirectionBalance[]
}
