import { describe, it, expect } from 'vitest'
import { validateSplits } from './transactionSplits'

const CATS = new Set(['groceries', 'shopping'])

describe('validateSplits', () => {
  it('accepts a valid two-way split that sums exactly', () => {
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 80 },
        { category_id: 'shopping', amount: 20 },
      ],
      100,
      false,
      CATS
    )
    expect(result).toEqual({ valid: true })
  })

  it('rejects splitting an income transaction', () => {
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 80 },
        { category_id: 'shopping', amount: 20 },
      ],
      100,
      true,
      CATS
    )
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/income/i)
  })

  it('rejects fewer than two splits', () => {
    const result = validateSplits([{ category_id: 'groceries', amount: 100 }], 100, false, CATS)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/at least 2/i)
  })

  it('rejects a row missing a category', () => {
    const result = validateSplits(
      [
        { category_id: '', amount: 80 },
        { category_id: 'shopping', amount: 20 },
      ],
      100,
      false,
      CATS
    )
    expect(result.valid).toBe(false)
  })

  it('rejects a non-positive amount', () => {
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 0 },
        { category_id: 'shopping', amount: 100 },
      ],
      100,
      false,
      CATS
    )
    expect(result.valid).toBe(false)
  })

  it('rejects a category not in the valid set', () => {
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 80 },
        { category_id: 'not-a-real-category', amount: 20 },
      ],
      100,
      false,
      CATS
    )
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalid category/i)
  })

  it('rejects splits that do not add up to the transaction total', () => {
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 80 },
        { category_id: 'shopping', amount: 15 },
      ],
      100,
      false,
      CATS
    )
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/add up/i)
  })

  it('does not false-reject on floating-point drift (cents-based comparison)', () => {
    // 33.33 + 33.33 + 33.34 === 100.00, but 33.33*100 has float noise in raw JS
    const result = validateSplits(
      [
        { category_id: 'groceries', amount: 33.33 },
        { category_id: 'shopping', amount: 33.33 },
        { category_id: 'groceries', amount: 33.34 },
      ],
      100,
      false,
      CATS
    )
    expect(result).toEqual({ valid: true })
  })
})
