// Populate the app's real database with demo data for testing:
//   node --no-warnings tools/seed/seed.ts [clients] [transactions]
// Defaults: 50 clients, 500 transactions. Covers varied cases: open/partial/
// paid/overdue debts, borrows, three currencies, categories, today's payments.
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { homedir } from 'node:os'

// The app stores its DB in Electron's userData dir. On macOS that's here:
const DB_PATH =
  process.env.QARZ_DB ??
  join(homedir(), 'Library', 'Application Support', 'qarz-daftari', 'qarz.db')

const NUM_CLIENTS = Number(process.argv[2] ?? '50')
const NUM_TXNS = Number(process.argv[3] ?? '500')
const DAY = 86400
const now = Math.floor(Date.now() / 1000)

const FIRST = ['Ali', 'Vali', 'Bek', 'Aziz', 'Sardor', 'Dilshod', 'Jasur', 'Kamol', 'Rustam', 'Sherzod', 'Otabek', 'Farrux', 'Nodir', 'Bobur', 'Ulugbek', 'Sanjar', 'Akmal', 'Islom', 'Temur', 'Jahongir', 'Malika', 'Nilufar', 'Zarina', 'Gulnora', 'Dilnoza', 'Sevara', 'Madina', 'Kamola', 'Feruza', 'Shahnoza']
const LAST = ['Karimov', 'Rahimov', 'Yusupov', 'Aliyev', 'Sobirov', 'Toshmatov', 'Ergashev', 'Nazarov', 'Qodirov', 'Ismoilov', 'Xolmatov', 'Umarov', 'Saidov', 'Rasulov', 'Mirzayev']
const CURRENCIES = ['UZS', 'UZS', 'UZS', 'KGS', 'USD'] // weighted toward UZS
const METHODS = ['cash', 'cash', 'card', 'transfer']
const GOODS = ['Guruch 10kg', 'Un 25kg', 'Yog‘ 5l', 'Shakar 5kg', 'Non', 'Sut', 'Choy', 'Kartoshka 20kg', 'Pul qarz', 'Go‘sht 3kg', null]

const rand = (n: number): number => Math.floor(Math.random() * n)
const pick = <T>(a: T[]): T => a[rand(a.length)]

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON;')

const branchId = (db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number }).id

// A few categories.
const catNames = ['Do‘stlar', 'Do‘kon', 'Mahalla', 'Ish']
const catIds: number[] = []
for (const name of catNames) {
  const info = db.prepare('INSERT INTO client_groups (branch_id, name) VALUES (?, ?)').run(branchId, name)
  catIds.push(Number(info.lastInsertRowid))
}

const clientIds: number[] = []
for (let i = 0; i < NUM_CLIENTS; i++) {
  const name = `${pick(FIRST)} ${pick(LAST)}`
  const phone = Math.random() < 0.8 ? `+99890${String(1000000 + rand(9000000))}` : null
  const trust = 1 + rand(5)
  const groupId = Math.random() < 0.5 ? pick(catIds) : null
  const created = now - rand(365) * DAY
  const info = db
    .prepare(
      `INSERT INTO clients (branch_id, group_id, name, phone, trust_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(branchId, groupId, name, phone, trust, created, created)
  clientIds.push(Number(info.lastInsertRowid))
}

let openCount = 0
let paidCount = 0
let overdueCount = 0
let borrowCount = 0
let todayPayments = 0

for (let i = 0; i < NUM_TXNS; i++) {
  const clientId = pick(clientIds)
  const direction = Math.random() < 0.85 ? 'lend' : 'borrow'
  const currency = pick(CURRENCIES)
  const base = currency === 'USD' ? (5 + rand(500)) * 100 : (10 + rand(500)) * 1000
  const issued = now - rand(200) * DAY
  // Mix of overdue, due soon, and no due date.
  const r = Math.random()
  let due: number | null
  if (r < 0.35) due = issued + (1 + rand(20)) * DAY // often already overdue
  else if (r < 0.55) due = now + (1 + rand(14)) * DAY // upcoming
  else due = null
  const desc = pick(GOODS)

  const info = db
    .prepare(
      `INSERT INTO transactions (branch_id, client_id, direction, amount, currency, description, issued_at, due_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(branchId, clientId, direction, base, currency, desc, issued, due, issued)
  const txnId = Number(info.lastInsertRowid)

  if (direction === 'borrow') borrowCount++

  // Payment case: none / partial / full.
  const payRoll = Math.random()
  if (payRoll < 0.4) {
    // no payments
    if (direction === 'lend') {
      openCount++
      if (due && due < now) overdueCount++
    }
  } else if (payRoll < 0.75) {
    // partial (1-2 installments)
    const installments = 1 + rand(2)
    let paid = 0
    for (let k = 0; k < installments; k++) {
      const amt = Math.max(1, Math.floor(base * (0.15 + Math.random() * 0.25)))
      if (paid + amt >= base) break
      // Some payments dated today so the dashboard shows activity.
      const paidAt = Math.random() < 0.15 ? now - rand(3600) : issued + rand(Math.max(1, now - issued))
      if (paidAt >= now - DAY) todayPayments++
      db.prepare(
        `INSERT INTO payments (branch_id, transaction_id, amount, currency, method, paid_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(branchId, txnId, amt, currency, pick(METHODS), paidAt, paidAt)
      paid += amt
    }
    if (direction === 'lend') {
      openCount++
      if (due && due < now) overdueCount++
    }
  } else {
    // fully paid
    const paidAt = Math.random() < 0.2 ? now - rand(3600) : issued + rand(Math.max(1, now - issued))
    if (paidAt >= now - DAY) todayPayments++
    db.prepare(
      `INSERT INTO payments (branch_id, transaction_id, amount, currency, method, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(branchId, txnId, base, currency, pick(METHODS), paidAt, paidAt)
    paidCount++
  }
}

console.log(`Seeded into ${DB_PATH}`)
console.log(`  clients: ${NUM_CLIENTS}, categories: ${catIds.length}`)
console.log(`  transactions: ${NUM_TXNS}`)
console.log(`  ~open lend: ${openCount}, fully paid: ${paidCount}, overdue: ${overdueCount}, borrows: ${borrowCount}, today's payments: ${todayPayments}`)
