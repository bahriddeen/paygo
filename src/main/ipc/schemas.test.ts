import { describe, test, expect } from 'vitest'
import { NewClientSchema, ClientPatchSchema } from './schemas'

describe('NewClientSchema', () => {
  test('accepts a minimal client and applies defaults', () => {
    const r = NewClientSchema.parse({ branch_id: 1, name: 'Ali' })
    expect(r.trust_level).toBe(3)
    expect(r.phone).toBeNull()
    expect(r.description).toBeNull()
  })

  test('trims the name', () => {
    expect(NewClientSchema.parse({ branch_id: 1, name: '  Ali  ' }).name).toBe('Ali')
  })

  test('rejects an empty or whitespace name', () => {
    expect(() => NewClientSchema.parse({ branch_id: 1, name: '   ' })).toThrow()
  })

  test('rejects trust_level outside 1..5', () => {
    expect(() => NewClientSchema.parse({ branch_id: 1, name: 'Ali', trust_level: 6 })).toThrow()
    expect(() => NewClientSchema.parse({ branch_id: 1, name: 'Ali', trust_level: 0 })).toThrow()
  })

  test('requires a positive branch_id', () => {
    expect(() => NewClientSchema.parse({ branch_id: 0, name: 'Ali' })).toThrow()
  })
})

describe('ClientPatchSchema', () => {
  test('allows a partial update', () => {
    expect(ClientPatchSchema.parse({ trust_level: 5 })).toEqual({ trust_level: 5 })
  })

  test('rejects an empty name when the field is provided', () => {
    expect(() => ClientPatchSchema.parse({ name: '' })).toThrow()
  })
})
