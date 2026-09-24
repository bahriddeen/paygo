import type { DatabaseSync } from 'node:sqlite'
import ExcelJS from 'exceljs'
import { CURRENCIES, type CurrencyCode } from '../../shared/currency'
import { startOfDaySec } from '../db/repositories/dateUtil'

export interface DebtorRow {
  name: string
  phone: string | null
  currency: CurrencyCode
  remaining: number
  oldestDebt: number
  overdue: boolean
}

/** Open lend debt per client × currency, with oldest debt date and overdue flag. */
export function debtorRows(db: DatabaseSync, branchId: number): DebtorRow[] {
  const dayStart = startOfDaySec(Math.floor(Date.now() / 1000))
  const rows = db
    .prepare(
      `SELECT c.name AS name, c.phone AS phone, t.currency AS currency,
         SUM(t.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0)) AS remaining,
         MIN(t.issued_at) AS oldestDebt,
         MAX(CASE
               WHEN t.due_at IS NOT NULL AND t.due_at < ?
                 AND (t.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.transaction_id = t.id), 0)) > 0
               THEN 1 ELSE 0 END) AS overdueFlag
       FROM transactions t
       JOIN clients c ON c.id = t.client_id
       WHERE t.branch_id = ? AND t.direction = 'lend'
       GROUP BY c.id, t.currency
       HAVING remaining > 0
       ORDER BY remaining DESC`
    )
    .all(dayStart, branchId) as unknown as {
    name: string
    phone: string | null
    currency: CurrencyCode
    remaining: number
    oldestDebt: number
    overdueFlag: number
  }[]

  return rows.map((r) => ({
    name: r.name,
    phone: r.phone,
    currency: r.currency,
    remaining: r.remaining,
    oldestDebt: r.oldestDebt,
    overdue: r.overdueFlag === 1
  }))
}

/** Build an .xlsx debtor list as a Buffer. */
export async function debtorsToXlsx(db: DatabaseSync, branchId: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Debtors')
  ws.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Amount', key: 'amount', width: 16 },
    { header: 'Since', key: 'since', width: 14 },
    { header: 'Overdue', key: 'overdue', width: 10 }
  ]
  ws.getRow(1).font = { bold: true }

  for (const r of debtorRows(db, branchId)) {
    const decimals = CURRENCIES[r.currency].decimals
    ws.addRow({
      name: r.name,
      phone: r.phone ?? '',
      currency: r.currency,
      amount: r.remaining / 10 ** decimals,
      since: new Date(r.oldestDebt * 1000).toISOString().slice(0, 10),
      overdue: r.overdue ? '⚠' : ''
    })
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
