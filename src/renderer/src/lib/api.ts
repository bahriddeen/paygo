import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Branch,
  Category,
  Client,
  ClientSort,
  ClientKind,
  NewClientInput,
  ClientPatchInput,
  Transaction,
  TransactionWithBalance,
  Direction,
  Payment,
  PaymentWithClient,
  DashboardSummary,
  DirectionBalance,
  NewTransactionInput,
  NewPaymentInput,
  TransactionQuery,
  DebtSeriesPoint,
  TopDebtor
} from '../../../preload'
import type { CurrencyCode } from './format'

export type {
  Branch,
  Category,
  Client,
  ClientSort,
  ClientKind,
  NewClientInput,
  ClientPatchInput,
  Transaction,
  TransactionWithBalance,
  Direction,
  Payment,
  PaymentWithClient,
  DashboardSummary,
  DirectionBalance,
  NewTransactionInput,
  NewPaymentInput,
  DebtSeriesPoint,
  TopDebtor
}

export function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: () => window.api.branches.list() })
}

export function useCategories(branchId?: number, kind: ClientKind = 'client') {
  return useQuery({
    queryKey: ['categories', branchId, kind],
    queryFn: () => window.api.categories.list(branchId!, kind),
    enabled: !!branchId
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { branchId: number; name: string; kind?: ClientKind }) =>
      window.api.categories.create(args.branchId, args.name, args.kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  })
}

export function useRenameCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; name: string }) =>
      window.api.categories.rename(args.id, args.name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    }
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => window.api.settings.getAll() })
}

export function useBackupStatus() {
  return useQuery({ queryKey: ['backup-status'], queryFn: () => window.api.backup.status() })
}

export function useSetSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { key: string; value: string }) =>
      window.api.settings.set(args.key, args.value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] })
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.branches.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] })
  })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => window.api.branches.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] })
  })
}

export function useRenameBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; name: string }) =>
      window.api.branches.rename(args.id, args.name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] })
  })
}

export function useAppVersion() {
  return useQuery({ queryKey: ['app-version'], queryFn: () => window.api.app.version() })
}

export function useLicenseStatus() {
  return useQuery({ queryKey: ['license-status'], queryFn: () => window.api.license.status() })
}

export function useLockStatus() {
  return useQuery({ queryKey: ['lock-status'], queryFn: () => window.api.lock.status() })
}

export interface ClientQuery {
  branchId: number
  search?: string
  sort?: ClientSort
  kind?: ClientKind
}

export function useClients(query?: ClientQuery) {
  return useQuery({
    queryKey: ['clients', query ?? null],
    queryFn: () => window.api.clients.list(query!),
    enabled: !!query
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewClientInput) => window.api.clients.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; patch: ClientPatchInput }) =>
      window.api.clients.update(args.id, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useArchiveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.clients.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] })
  })
}

export function useClientBalance(clientId?: number) {
  return useQuery({
    queryKey: ['client-balance', clientId],
    queryFn: () => window.api.clients.balance(clientId!),
    enabled: !!clientId
  })
}

export function useDashboard(branchId?: number) {
  return useQuery({
    queryKey: ['summary', branchId],
    queryFn: () => window.api.summary.dashboard(branchId!),
    enabled: !!branchId
  })
}

export function useTransactions(query?: TransactionQuery) {
  return useQuery({
    queryKey: ['transactions', query ?? null],
    queryFn: () => window.api.transactions.list(query!),
    enabled: !!query
  })
}

export function useBranchPayments(query?: { branchId: number; from: number; to: number }) {
  return useQuery({
    queryKey: ['payments', query ?? null],
    queryFn: () => window.api.payments.byDate(query!.branchId, query!.from, query!.to),
    enabled: !!query
  })
}

// Invalidate everything a new debt or payment can change.
function invalidateLedger(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['summary'] })
  qc.invalidateQueries({ queryKey: ['payments'] })
  qc.invalidateQueries({ queryKey: ['client-balance'] })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTransactionInput) => window.api.transactions.create(input),
    onSuccess: () => invalidateLedger(qc)
  })
}

export function useAddPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewPaymentInput) => window.api.payments.add(input),
    onSuccess: () => invalidateLedger(qc)
  })
}

export interface TransactionPatchInput {
  amount?: number
  currency?: 'KGS' | 'USD' | 'UZS'
  description?: string | null
  issued_at?: number
  due_at?: number | null
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number; patch: TransactionPatchInput }) =>
      window.api.transactions.update(args.id, args.patch),
    onSuccess: () => invalidateLedger(qc)
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.transactions.delete(id),
    onSuccess: () => invalidateLedger(qc)
  })
}

export function useDebtSeries(query?: {
  branchId: number
  currency: CurrencyCode
  from: number
  to: number
}) {
  return useQuery({
    queryKey: ['stats-series', query ?? null],
    queryFn: () => window.api.stats.series(query!),
    enabled: !!query
  })
}

export function useTopDebtors(query?: { branchId: number; currency: CurrencyCode; limit: number }) {
  return useQuery({
    queryKey: ['stats-top', query ?? null],
    queryFn: () => window.api.stats.topDebtors(query!),
    enabled: !!query
  })
}
