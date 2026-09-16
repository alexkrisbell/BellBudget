import { describe, it, expect } from 'vitest'
import { resolveIsIncome, normalizeCategoryForIncome } from './incomeResolution'

describe('resolveIsIncome', () => {
  it('trusts the category over a stale transaction-level flag', () => {
    expect(resolveIsIncome({ is_income: false, category: { is_income: true } })).toBe(true)
    expect(resolveIsIncome({ is_income: true, category: { is_income: false } })).toBe(false)
  })

  it('falls back to the transaction flag when uncategorized', () => {
    expect(resolveIsIncome({ is_income: true, category: null })).toBe(true)
    expect(resolveIsIncome({ is_income: false, category: null })).toBe(false)
    expect(resolveIsIncome({ is_income: true, category: undefined })).toBe(true)
  })

  it('handles category coming back as an array (Supabase to-one relation quirk)', () => {
    expect(resolveIsIncome({ is_income: false, category: [{ is_income: true }] })).toBe(true)
    expect(resolveIsIncome({ is_income: true, category: [] })).toBe(true)
  })
})

describe('normalizeCategoryForIncome', () => {
  it('passes through a plain object', () => {
    const cat = { is_income: true }
    expect(normalizeCategoryForIncome(cat)).toBe(cat)
  })

  it('unwraps a single-element array', () => {
    const cat = { is_income: true }
    expect(normalizeCategoryForIncome([cat])).toBe(cat)
  })

  it('returns null for null, undefined, or an empty array', () => {
    expect(normalizeCategoryForIncome(null)).toBeNull()
    expect(normalizeCategoryForIncome(undefined)).toBeNull()
    expect(normalizeCategoryForIncome([])).toBeNull()
  })
})
