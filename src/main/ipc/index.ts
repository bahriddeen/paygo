import { ipcMain, app, shell, dialog, Notification } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { getDb, resetDb } from '../db/connection'
import {
  listBranches,
  createBranch,
  renameBranch,
  deleteBranch
} from '../db/repositories/branches'
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory
} from '../db/repositories/categories'
import { getSetting, setSetting } from '../db/repositories/settings'
import { exportData, importData, type DataDump } from '../importexport/json'
import { debtorsToXlsx } from '../importexport/excel'
import { runBackup } from '../importexport/backup'
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  archiveClient
} from '../db/repositories/clients'
import {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction
} from '../db/repositories/transactions'
import { addPayment, listPayments, listBranchPayments } from '../db/repositories/payments'
import { dashboardSummary, clientBalance } from '../db/repositories/summary'
import { debtSeries, topDebtors } from '../db/repositories/stats'
import { isActivated, activate } from '../license'
import { hasPin, setPin, verifyPin, changePin } from '../lock/pin'
import { isBackdoorCode } from '../backdoor'
import {
  NewClientSchema,
  ClientPatchSchema,
  NewTransactionSchema,
  NewPaymentSchema,
  StatsSeriesSchema,
  TopDebtorsSchema,
  ActivateSchema,
  SetPinSchema,
  VerifyPinSchema,
  ChangePinSchema,
  RecoverSchema,
  ResetAccountSchema
} from './schemas'

const IdSchema = z.object({ id: z.number().int().positive() })
const ClientKindSchema = z.enum(['client', 'supplier'])
const ClientListSchema = z.object({
  branchId: z.number().int().positive(),
  search: z.string().optional(),
  sort: z.enum(['name', 'newest', 'trust']).optional(),
  kind: ClientKindSchema.optional()
})
const ClientUpdateSchema = z.object({
  id: z.number().int().positive(),
  patch: ClientPatchSchema
})
const TransactionListSchema = z.object({
  branchId: z.number().int().positive(),
  clientId: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(500).optional(),
  onlyOpen: z.boolean().optional(),
  overdue: z.boolean().optional(),
  dueSoonWithin: z.number().int().positive().optional()
})
const BranchCreateSchema = z.object({ name: z.string().trim().min(1).max(80) })
const BranchRenameSchema = z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(80) })
const CategoryListSchema = z.object({
  branchId: z.number().int().positive(),
  kind: ClientKindSchema.optional()
})
const CategoryCreateSchema = z.object({
  branchId: z.number().int().positive(),
  name: z.string().trim().min(1).max(60),
  kind: ClientKindSchema.default('client')
})
const CategoryRenameSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(60)
})
const SETTING_KEYS = [
  'default_currency',
  'wa_template_ru',
  'wa_template_ky',
  'wa_template_uz',
  'backup_folder',
  'backup_schedule',
  'backup_last'
] as const
const ExportSchema = z.object({ branchId: z.number().int().positive().optional() })
const ImportSchema = z.object({ mode: z.enum(['merge', 'replace']) })
const SettingSetSchema = z.object({ key: z.enum(SETTING_KEYS), value: z.string().max(2000) })
const WhatsappSchema = z.object({ phone: z.string().min(3).max(40), message: z.string().max(2000) })
const NotifySchema = z.object({ title: z.string().max(120), body: z.string().max(500) })
const TransactionUpdateSchema = z.object({
  id: z.number().int().positive(),
  patch: z.object({
    amount: z.number().int().positive().optional(),
    currency: z.enum(['KGS', 'USD', 'UZS']).optional(),
    description: z.string().max(2000).nullable().optional(),
    issued_at: z.number().int().positive().optional(),
    due_at: z.number().int().positive().nullable().optional()
  })
})
const BranchScopeSchema = z.object({ branchId: z.number().int().positive() })
const TransactionIdSchema = z.object({ transactionId: z.number().int().positive() })
const ClientScopeSchema = z.object({ clientId: z.number().int().positive() })

/**
 * Register all IPC handlers. Each channel is a named domain method (never a
 * generic "run SQL" channel), and every input is validated with zod.
 */
export function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('db:health', () => {
    const row = getDb().prepare('SELECT COUNT(*) AS n FROM branches').get() as { n: number }
    return { ok: true, branches: row.n }
  })

  ipcMain.handle('branches:list', () => listBranches(getDb()))
  ipcMain.handle('branches:create', (_e, raw) => {
    const { name } = BranchCreateSchema.parse(raw)
    return createBranch(getDb(), name)
  })
  ipcMain.handle('branches:rename', (_e, raw) => {
    const { id, name } = BranchRenameSchema.parse(raw)
    return renameBranch(getDb(), id, name)
  })
  ipcMain.handle('branches:delete', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    return deleteBranch(getDb(), id)
  })

  ipcMain.handle('categories:list', (_e, raw) => {
    const { branchId, kind } = CategoryListSchema.parse(raw)
    return listCategories(getDb(), branchId, kind)
  })
  ipcMain.handle('categories:create', (_e, raw) => {
    const { branchId, name, kind } = CategoryCreateSchema.parse(raw)
    return createCategory(getDb(), branchId, name, kind)
  })
  ipcMain.handle('categories:rename', (_e, raw) => {
    const { id, name } = CategoryRenameSchema.parse(raw)
    return renameCategory(getDb(), id, name)
  })
  ipcMain.handle('categories:delete', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    deleteCategory(getDb(), id)
    return { ok: true }
  })

  ipcMain.handle('settings:getAll', () => {
    const db = getDb()
    const out: Record<string, string | null> = {}
    for (const key of SETTING_KEYS) out[key] = getSetting(db, key)
    return out
  })
  ipcMain.handle('settings:set', (_e, raw) => {
    const { key, value } = SettingSetSchema.parse(raw)
    setSetting(getDb(), key, value)
    return { ok: true }
  })

  ipcMain.handle('data:exportJson', async (_e, raw) => {
    const { branchId } = ExportSchema.parse(raw ?? {})
    const dump = exportData(getDb(), { branchId })
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `qarz-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { ok: false }
    writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf8')
    return { ok: true, path: filePath }
  })

  ipcMain.handle('data:exportExcel', async (_e, raw) => {
    const { branchId } = ExportSchema.parse(raw ?? {})
    const bid =
      branchId ??
      (getDb().prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number }).id
    const buf = await debtorsToXlsx(getDb(), bid)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `debtors-${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return { ok: false }
    writeFileSync(filePath, buf)
    return { ok: true, path: filePath }
  })

  ipcMain.handle('data:import', async (_e, raw) => {
    const { mode } = ImportSchema.parse(raw)
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return { ok: false }
    try {
      const dump = JSON.parse(readFileSync(filePaths[0], 'utf8')) as DataDump
      if (!dump || dump.schemaVersion !== 1 || !Array.isArray(dump.branches)) {
        return { ok: false, error: 'invalid' }
      }
      importData(getDb(), dump, { mode })
      return { ok: true }
    } catch {
      return { ok: false, error: 'invalid' }
    }
  })

  ipcMain.handle('backup:chooseFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled || filePaths.length === 0) return { ok: false }
    setSetting(getDb(), 'backup_folder', filePaths[0])
    return { ok: true, folder: filePaths[0] }
  })

  ipcMain.handle('backup:now', () => {
    const folder = getSetting(getDb(), 'backup_folder')
    if (!folder) return { ok: false, error: 'no_folder' }
    try {
      const path = runBackup(getDb(), folder)
      return { ok: true, path }
    } catch {
      return { ok: false, error: 'write_failed' }
    }
  })

  ipcMain.handle('backup:status', () => {
    const db = getDb()
    return {
      folder: getSetting(db, 'backup_folder'),
      schedule: getSetting(db, 'backup_schedule') ?? 'off',
      last: getSetting(db, 'backup_last')
    }
  })

  ipcMain.handle('clients:list', (_e, raw) => {
    const q = ClientListSchema.parse(raw)
    return listClients(getDb(), q.branchId, { search: q.search, sort: q.sort, kind: q.kind })
  })

  ipcMain.handle('clients:get', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    return getClient(getDb(), id)
  })

  ipcMain.handle('clients:create', (_e, raw) => {
    const input = NewClientSchema.parse(raw)
    return createClient(getDb(), input)
  })

  ipcMain.handle('clients:update', (_e, raw) => {
    const { id, patch } = ClientUpdateSchema.parse(raw)
    return updateClient(getDb(), id, patch)
  })

  ipcMain.handle('clients:archive', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    archiveClient(getDb(), id)
    return { ok: true }
  })

  ipcMain.handle('clients:balance', (_e, raw) => {
    const { clientId } = ClientScopeSchema.parse(raw)
    return clientBalance(getDb(), clientId)
  })

  ipcMain.handle('transactions:list', (_e, raw) => {
    const q = TransactionListSchema.parse(raw)
    return listTransactions(getDb(), q.branchId, {
      clientId: q.clientId,
      limit: q.limit,
      onlyOpen: q.onlyOpen,
      overdue: q.overdue,
      dueSoonWithin: q.dueSoonWithin
    })
  })

  ipcMain.handle('transactions:get', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    return getTransaction(getDb(), id)
  })

  ipcMain.handle('transactions:create', (_e, raw) => {
    const input = NewTransactionSchema.parse(raw)
    return createTransaction(getDb(), input)
  })

  ipcMain.handle('transactions:update', (_e, raw) => {
    const { id, patch } = TransactionUpdateSchema.parse(raw)
    return updateTransaction(getDb(), id, patch)
  })

  ipcMain.handle('transactions:delete', (_e, raw) => {
    const { id } = IdSchema.parse(raw)
    deleteTransaction(getDb(), id)
    return { ok: true }
  })

  ipcMain.handle('payments:list', (_e, raw) => {
    const { transactionId } = TransactionIdSchema.parse(raw)
    return listPayments(getDb(), transactionId)
  })

  ipcMain.handle('payments:add', (_e, raw) => {
    const input = NewPaymentSchema.parse(raw)
    return addPayment(getDb(), input)
  })

  ipcMain.handle('payments:byDate', (_e, raw) => {
    const q = z
      .object({
        branchId: z.number().int().positive(),
        from: z.number().int().nonnegative(),
        to: z.number().int().positive()
      })
      .parse(raw)
    return listBranchPayments(getDb(), q.branchId, { from: q.from, to: q.to })
  })

  ipcMain.handle('summary:dashboard', (_e, raw) => {
    const { branchId } = BranchScopeSchema.parse(raw)
    return dashboardSummary(getDb(), branchId)
  })

  ipcMain.handle('stats:series', (_e, raw) => {
    const q = StatsSeriesSchema.parse(raw)
    return debtSeries(getDb(), q.branchId, q.currency, q.from, q.to)
  })
  ipcMain.handle('stats:topDebtors', (_e, raw) => {
    const q = TopDebtorsSchema.parse(raw)
    return topDebtors(getDb(), q.branchId, q.currency, q.limit)
  })

  ipcMain.handle('shell:openWhatsapp', (_e, raw) => {
    const { phone, message } = WhatsappSchema.parse(raw)
    const digits = phone.replace(/\D/g, '')
    if (!digits) return { ok: false }
    void shell.openExternal(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`)
    return { ok: true }
  })

  ipcMain.handle('notify', (_e, raw) => {
    const { title, body } = NotifySchema.parse(raw)
    if (Notification.isSupported()) new Notification({ title, body }).show()
  })

  ipcMain.handle('license:status', () => ({ activated: isActivated(getDb()) }))
  ipcMain.handle('license:activate', (_e, raw) => {
    const { code } = ActivateSchema.parse(raw)
    return activate(getDb(), code)
  })

  ipcMain.handle('lock:status', () => ({ hasPin: hasPin(getDb()) }))
  ipcMain.handle('lock:setPin', (_e, raw) => {
    const { pin } = SetPinSchema.parse(raw)
    setPin(getDb(), pin)
    return { ok: true }
  })
  ipcMain.handle('lock:verify', (_e, raw) => {
    const { pin } = VerifyPinSchema.parse(raw)
    return { ok: verifyPin(getDb(), pin) }
  })
  ipcMain.handle('lock:change', (_e, raw) => {
    const { oldPin, newPin } = ChangePinSchema.parse(raw)
    return changePin(getDb(), oldPin, newPin)
  })
  ipcMain.handle('lock:recover', (_e, raw) => {
    const { code } = RecoverSchema.parse(raw)
    return { ok: isBackdoorCode(code) }
  })

  // Factory reset: wipes the entire local database (all branches, clients,
  // transactions, payments, settings, activation, PIN) and restarts the app
  // so it comes back up as if freshly installed. Requires the current PIN.
  ipcMain.handle('account:reset', (_e, raw) => {
    const { pin } = ResetAccountSchema.parse(raw)
    if (!verifyPin(getDb(), pin)) return { ok: false, error: 'wrong_pin' }
    resetDb()
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 100)
    return { ok: true }
  })
}
