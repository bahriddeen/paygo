import type { DatabaseSync } from 'node:sqlite'
import { getSetting, setSetting } from './repositories/settings'
import { listBranches } from './repositories/branches'

/**
 * Demo data shown on first launch so a brand-new install isn't an empty
 * dashboard. Every row this creates is tagged `is_demo = 1` so
 * clearDemoData() can remove exactly these rows (and only these) even if
 * the shop owner has since added real clients/transactions of their own.
 */

const FIRST = [
  'Ali', 'Vali', 'Bek', 'Aziz', 'Sardor', 'Dilshod', 'Jasur', 'Kamol', 'Rustam', 'Sherzod',
  'Otabek', 'Farrux', 'Nodir', 'Bobur', 'Sanjar', 'Malika', 'Nilufar', 'Zarina', 'Gulnora', 'Madina'
]
const LAST = [
  'Karimov', 'Rahimov', 'Yusupov', 'Aliyev', 'Sobirov', 'Toshmatov', 'Ergashev', 'Nazarov',
  'Qodirov', 'Ismoilov', 'Xolmatov', 'Umarov', 'Saidov', 'Rasulov', 'Mirzayev'
]
const SUPPLIER_SUFFIX = ['Savdo', 'Taminot', 'Trade', 'Group', 'Market', "Ta'minot MChJ"]
const GOODS = [
  'Guruch 10kg', 'Un 25kg', "Yog' 5l", 'Shakar 5kg', 'Non', 'Sut', 'Choy', 'Kartoshka 20kg',
  'Qurilish material', "Go'sht 3kg", null
]
const METHODS = ['cash', 'cash', 'card', 'transfer']
const CURRENCIES = ['UZS', 'UZS', 'UZS', 'KGS', 'USD'] as const

const rnd = (n: number): number => Math.floor(Math.random() * n)
const pick = <T>(a: readonly T[]): T => a[rnd(a.length)]

const DAY = 86400
const NUM_CLIENTS = 15
const NUM_SUPPLIERS = 5
const NUM_TRANSACTIONS = 100

export function seedDemoData(
  db: DatabaseSync,
  branchId: number,
  now: number = Math.floor(Date.now() / 1000)
): void {
  db.exec('BEGIN')
  try {
    const insertPerson = db.prepare(
      `INSERT INTO clients (branch_id, name, kind, phone, trust_level, is_demo)
       VALUES (?, ?, ?, ?, ?, 1)`
    )

    const clientIds: number[] = []
    for (let i = 0; i < NUM_CLIENTS; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`
      const phone = `+99890${String(1000000 + rnd(9000000))}`
      const info = insertPerson.run(branchId, name, 'client', phone, 1 + rnd(5))
      clientIds.push(Number(info.lastInsertRowid))
    }

    const supplierIds: number[] = []
    for (let i = 0; i < NUM_SUPPLIERS; i++) {
      const name = `${pick(LAST)} ${pick(SUPPLIER_SUFFIX)}`
      const phone = `+99890${String(1000000 + rnd(9000000))}`
      const info = insertPerson.run(branchId, name, 'supplier', phone, 1 + rnd(5))
      supplierIds.push(Number(info.lastInsertRowid))
    }

    const insertTx = db.prepare(
      `INSERT INTO transactions
         (branch_id, client_id, direction, amount, currency, description, issued_at, due_at, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    const insertPay = db.prepare(
      `INSERT INTO payments (branch_id, transaction_id, amount, currency, method, paid_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )

    for (let i = 0; i < NUM_TRANSACTIONS; i++) {
      const isSupplier = supplierIds.length > 0 && Math.random() < 0.25
      const personId = isSupplier ? pick(supplierIds) : pick(clientIds)
      const direction = isSupplier ? 'borrow' : 'lend'
      const currency = pick(CURRENCIES)
      const base = currency === 'USD' ? (5 + rnd(300)) * 100 : (10 + rnd(400)) * 1000
      const issued = now - rnd(150) * DAY

      const r = Math.random()
      const due =
        r < 0.3
          ? issued + (1 + rnd(20)) * DAY // often overdue by "now"
          : r < 0.55
            ? now + (1 + rnd(10)) * DAY // due soon
            : r < 0.7
              ? now + (11 + rnd(60)) * DAY // far future
              : null

      const info = insertTx.run(branchId, personId, direction, base, currency, pick(GOODS), issued, due)
      const txId = Number(info.lastInsertRowid)

      const payRoll = Math.random()
      if (payRoll < 0.4) {
        // left fully open
      } else if (payRoll < 0.75) {
        const amt = Math.max(1, Math.floor(base * (0.2 + Math.random() * 0.3)))
        const paidAt = issued + rnd(Math.max(1, now - issued))
        insertPay.run(branchId, txId, amt, currency, pick(METHODS), paidAt)
      } else {
        const paidAt = issued + rnd(Math.max(1, now - issued))
        insertPay.run(branchId, txId, base, currency, pick(METHODS), paidAt)
      }
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Removes exactly the demo-tagged rows. A demo client that has since
 * accumulated real (non-demo) transactions is kept — deleting demo
 * transactions/payments first means only demo clients with nothing real
 * attached to them actually get removed. A kept demo client is promoted to
 * a real one (is_demo = 0): it now only has real data left, so it must stop
 * counting toward hasDemoData() or the "Start fresh" button would never go
 * away.
 */
export function clearDemoData(db: DatabaseSync): void {
  db.exec('BEGIN')
  try {
    db.exec(
      `DELETE FROM payments WHERE transaction_id IN (SELECT id FROM transactions WHERE is_demo = 1)`
    )
    db.exec(`DELETE FROM transactions WHERE is_demo = 1`)
    db.exec(
      `DELETE FROM clients WHERE is_demo = 1 AND id NOT IN (SELECT DISTINCT client_id FROM transactions)`
    )
    db.exec(`UPDATE clients SET is_demo = 0 WHERE is_demo = 1`)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function hasDemoData(db: DatabaseSync): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE is_demo = 1').get() as { n: number }
  return row.n > 0
}

/**
 * Seeds demo data exactly once per install, on the first launch of a
 * genuinely fresh profile — guarded by a settings flag so it never
 * re-seeds later (e.g. after the shop owner clears their own real data).
 */
export function maybeSeedDemoData(db: DatabaseSync): void {
  if (getSetting(db, 'demo_seeded') !== null) return
  const branches = listBranches(db)
  if (branches.length === 0) return
  seedDemoData(db, branches[0].id)
  setSetting(db, 'demo_seeded', '1')
}
