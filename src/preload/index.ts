import { contextBridge, ipcRenderer } from 'electron'
import type { Branch } from '../main/db/repositories/branches'
import type { Category } from '../main/db/repositories/categories'
import type { Client, ClientSort, ClientKind } from '../main/db/repositories/clients'
import type { Transaction, TransactionWithBalance } from '../main/db/repositories/transactions'
import type { Payment, PaymentWithClient } from '../main/db/repositories/payments'
import type { DashboardSummary, DirectionBalance } from '../main/db/repositories/summary'
import type { DebtSeriesPoint, TopDebtor } from '../main/db/repositories/stats'
import type { CurrencyCode } from '../shared/currency'
import type {
  NewClientInput,
  ClientPatchInput,
  NewTransactionInput,
  NewPaymentInput
} from '../main/ipc/schemas'
import type { WaStatus, BatchItem, BatchProgress, BatchDone } from '../main/whatsapp/client'

export interface TransactionQuery {
  branchId: number
  clientId?: number
  limit?: number
  onlyOpen?: boolean
  overdue?: boolean
  dueSoonWithin?: number
}

/**
 * The ONLY bridge between renderer and main. Named domain methods only —
 * never raw ipcRenderer, never arbitrary SQL. `AppApi` types `window.api`.
 */
const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version')
  },
  db: {
    health: (): Promise<{ ok: boolean; branches: number }> => ipcRenderer.invoke('db:health')
  },
  branches: {
    list: (): Promise<Branch[]> => ipcRenderer.invoke('branches:list'),
    create: (name: string): Promise<Branch> => ipcRenderer.invoke('branches:create', { name }),
    rename: (id: number, name: string): Promise<Branch> =>
      ipcRenderer.invoke('branches:rename', { id, name }),
    delete: (id: number): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke('branches:delete', { id })
  },
  categories: {
    list: (branchId: number, kind?: ClientKind): Promise<Category[]> =>
      ipcRenderer.invoke('categories:list', { branchId, kind }),
    create: (branchId: number, name: string, kind?: ClientKind): Promise<Category> =>
      ipcRenderer.invoke('categories:create', { branchId, name, kind }),
    rename: (id: number, name: string): Promise<Category> =>
      ipcRenderer.invoke('categories:rename', { id, name }),
    delete: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('categories:delete', { id })
  },
  settings: {
    getAll: (): Promise<Record<string, string | null>> => ipcRenderer.invoke('settings:getAll'),
    set: (key: string, value: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('settings:set', { key, value })
  },
  data: {
    exportJson: (branchId?: number): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke('data:exportJson', { branchId }),
    exportExcel: (branchId?: number): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke('data:exportExcel', { branchId }),
    import: (mode: 'merge' | 'replace'): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('data:import', { mode })
  },
  backup: {
    chooseFolder: (): Promise<{ ok: boolean; folder?: string }> =>
      ipcRenderer.invoke('backup:chooseFolder'),
    now: (): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('backup:now'),
    status: (): Promise<{ folder: string | null; schedule: string; last: string | null }> =>
      ipcRenderer.invoke('backup:status')
  },
  clients: {
    list: (
      query: { branchId: number; search?: string; sort?: ClientSort; kind?: ClientKind }
    ): Promise<Client[]> => ipcRenderer.invoke('clients:list', query),
    get: (id: number): Promise<Client | null> => ipcRenderer.invoke('clients:get', { id }),
    create: (input: NewClientInput): Promise<Client> => ipcRenderer.invoke('clients:create', input),
    update: (id: number, patch: ClientPatchInput): Promise<Client> =>
      ipcRenderer.invoke('clients:update', { id, patch }),
    archive: (id: number): Promise<{ ok: boolean }> => ipcRenderer.invoke('clients:archive', { id }),
    balance: (clientId: number): Promise<DirectionBalance[]> =>
      ipcRenderer.invoke('clients:balance', { clientId })
  },
  transactions: {
    list: (query: TransactionQuery): Promise<TransactionWithBalance[]> =>
      ipcRenderer.invoke('transactions:list', query),
    get: (id: number): Promise<Transaction | null> => ipcRenderer.invoke('transactions:get', { id }),
    create: (input: NewTransactionInput): Promise<Transaction> =>
      ipcRenderer.invoke('transactions:create', input),
    update: (
      id: number,
      patch: {
        amount?: number
        currency?: 'KGS' | 'USD' | 'UZS'
        description?: string | null
        issued_at?: number
        due_at?: number | null
      }
    ): Promise<Transaction> => ipcRenderer.invoke('transactions:update', { id, patch }),
    delete: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('transactions:delete', { id })
  },
  payments: {
    list: (transactionId: number): Promise<Payment[]> =>
      ipcRenderer.invoke('payments:list', { transactionId }),
    add: (input: NewPaymentInput): Promise<Payment> => ipcRenderer.invoke('payments:add', input),
    byDate: (branchId: number, from: number, to: number): Promise<PaymentWithClient[]> =>
      ipcRenderer.invoke('payments:byDate', { branchId, from, to })
  },
  summary: {
    dashboard: (branchId: number): Promise<DashboardSummary> =>
      ipcRenderer.invoke('summary:dashboard', { branchId })
  },
  stats: {
    series: (query: {
      branchId: number
      currency: CurrencyCode
      from: number
      to: number
    }): Promise<DebtSeriesPoint[]> => ipcRenderer.invoke('stats:series', query),
    topDebtors: (query: {
      branchId: number
      currency: CurrencyCode
      limit: number
    }): Promise<TopDebtor[]> => ipcRenderer.invoke('stats:topDebtors', query)
  },
  license: {
    status: (): Promise<{ activated: boolean }> => ipcRenderer.invoke('license:status'),
    activate: (code: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('license:activate', { code })
  },
  lock: {
    status: (): Promise<{ hasPin: boolean }> => ipcRenderer.invoke('lock:status'),
    setPin: (pin: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('lock:setPin', { pin }),
    verify: (pin: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('lock:verify', { pin }),
    change: (oldPin: string, newPin: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('lock:change', { oldPin, newPin }),
    recover: (code: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('lock:recover', { code })
  },
  account: {
    reset: (pin: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('account:reset', { pin })
  },
  whatsapp: {
    open: (phone: string, message: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('shell:openWhatsapp', { phone, message }),
    status: (): Promise<WaStatus> => ipcRenderer.invoke('whatsapp:status'),
    connect: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('whatsapp:connect'),
    logout: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('whatsapp:logout'),
    sendBatch: (
      items: BatchItem[],
      minDelaySec: number,
      maxDelaySec: number
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('whatsapp:sendBatch', { items, minDelaySec, maxDelaySec }),
    cancelBatch: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('whatsapp:cancelBatch'),
    onQr: (cb: (dataUrl: string) => void): (() => void) => {
      const listener = (_e: unknown, dataUrl: string): void => cb(dataUrl)
      ipcRenderer.on('whatsapp:qr', listener)
      return () => ipcRenderer.removeListener('whatsapp:qr', listener)
    },
    onStatus: (cb: (status: WaStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: WaStatus): void => cb(status)
      ipcRenderer.on('whatsapp:status', listener)
      return () => ipcRenderer.removeListener('whatsapp:status', listener)
    },
    onBatchProgress: (cb: (p: BatchProgress) => void): (() => void) => {
      const listener = (_e: unknown, p: BatchProgress): void => cb(p)
      ipcRenderer.on('whatsapp:batch-progress', listener)
      return () => ipcRenderer.removeListener('whatsapp:batch-progress', listener)
    },
    onBatchDone: (cb: (d: BatchDone) => void): (() => void) => {
      const listener = (_e: unknown, d: BatchDone): void => cb(d)
      ipcRenderer.on('whatsapp:batch-done', listener)
      return () => ipcRenderer.removeListener('whatsapp:batch-done', listener)
    }
  },
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notify', { title, body })
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(globalThis as unknown as { api: typeof api }).api = api
}

export type AppApi = typeof api
export type { Branch } from '../main/db/repositories/branches'
export type { Category } from '../main/db/repositories/categories'
export type { Client, ClientSort, ClientKind } from '../main/db/repositories/clients'
export type { Transaction, TransactionWithBalance, Direction } from '../main/db/repositories/transactions'
export type { Payment, PaymentWithClient } from '../main/db/repositories/payments'
export type { DashboardSummary, DirectionBalance, CurrencyAmount } from '../main/db/repositories/summary'
export type { DebtSeriesPoint, TopDebtor } from '../main/db/repositories/stats'
export type {
  NewClientInput,
  ClientPatchInput,
  NewTransactionInput,
  NewPaymentInput
} from '../main/ipc/schemas'
export type { WaStatus, BatchItem, BatchProgress, BatchDone } from '../main/whatsapp/client'
