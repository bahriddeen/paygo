import { z } from 'zod'

const toNull = <T>(v: T | null | undefined): T | null => v ?? null
const ClientKind = z.enum(['client', 'supplier'])

export const NewClientSchema = z.object({
  branch_id: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  kind: ClientKind.default('client'),
  phone: z.string().max(40).nullish().transform(toNull),
  description: z.string().max(2000).nullish().transform(toNull),
  trust_level: z.number().int().min(1).max(5).default(3),
  group_id: z.number().int().positive().nullish().transform(toNull)
})

export const ClientPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  trust_level: z.number().int().min(1).max(5).optional(),
  group_id: z.number().int().positive().nullable().optional()
})

const Currency = z.enum(['KGS', 'USD', 'UZS'])

export const LineItemSchema = z.object({
  product: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unit_price: z.number().int().positive()
})

export const NewTransactionSchema = z.object({
  branch_id: z.number().int().positive(),
  client_id: z.number().int().positive(),
  direction: z.enum(['lend', 'borrow']),
  amount: z.number().int().positive(),
  currency: Currency,
  description: z.string().max(2000).nullish().transform(toNull),
  issued_at: z.number().int().positive().optional(),
  due_at: z.number().int().positive().nullish().transform(toNull),
  line_items: z.array(LineItemSchema).max(200).optional()
})

export const NewPaymentSchema = z.object({
  transaction_id: z.number().int().positive(),
  amount: z.number().int().positive(),
  method: z.string().max(20).nullish().transform(toNull),
  note: z.string().max(500).nullish().transform(toNull),
  paid_at: z.number().int().positive().optional()
})

export const PaymentPatchSchema = z.object({
  amount: z.number().int().positive().optional(),
  method: z.string().max(20).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  paid_at: z.number().int().positive().optional()
})

export const StatsSeriesSchema = z.object({
  branchId: z.number().int().positive(),
  currency: Currency,
  from: z.number().int().positive(),
  to: z.number().int().positive()
})
export const TopDebtorsSchema = z.object({
  branchId: z.number().int().positive(),
  currency: Currency,
  limit: z.number().int().positive().max(100)
})

const Pin = z.string().regex(/^\d{4}$/)

export const ActivateSchema = z.object({ code: z.string().min(1).max(300) })
export const SetPinSchema = z.object({ pin: Pin })
export const VerifyPinSchema = z.object({ pin: z.string().max(20) })
export const ChangePinSchema = z.object({ oldPin: z.string().max(20), newPin: Pin })
export const RecoverSchema = z.object({ code: z.string().max(40) })
export const ResetAccountSchema = z.object({ pin: z.string().max(20) })

export const WaSendDirectSchema = z.object({
  phone: z.string().min(3).max(40),
  message: z.string().min(1).max(2000),
  name: z.string().max(200)
})

export const WaSendBatchSchema = z.object({
  items: z
    .array(
      z.object({
        phone: z.string().min(3).max(40),
        message: z.string().min(1).max(2000),
        name: z.string().max(200)
      })
    )
    .min(1)
    .max(500),
  minDelaySec: z.number().int().min(1).max(600).default(10),
  maxDelaySec: z.number().int().min(1).max(600).default(30)
})

// z.input: the shape the renderer sends (before defaults/transforms).
export type NewClientInput = z.input<typeof NewClientSchema>
export type ClientPatchInput = z.input<typeof ClientPatchSchema>
export type NewTransactionInput = z.input<typeof NewTransactionSchema>
export type NewPaymentInput = z.input<typeof NewPaymentSchema>
export type PaymentPatchInput = z.input<typeof PaymentPatchSchema>
export type LineItemInput = z.input<typeof LineItemSchema>
