import { describe, it, expect } from 'vitest'
import { monthRange, trailingMonths } from './dateRange'

describe('monthRange', () => {
  it('returns the first-of-month boundaries for a normal month', () => {
    expect(monthRange(5, 2026)).toEqual({ start: '2026-05-01', end: '2026-06-01' })
  })

  it('rolls over to January of the next year after December', () => {
    expect(monthRange(12, 2026)).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })

  it('pads single-digit months', () => {
    expect(monthRange(1, 2026)).toEqual({ start: '2026-01-01', end: '2026-02-01' })
  })
})

describe('trailingMonths', () => {
  it('returns the requested count, oldest first, ending at `from`', () => {
    expect(trailingMonths(3, new Date('2026-05-15'))).toEqual([
      { month: 3, year: 2026 },
      { month: 4, year: 2026 },
      { month: 5, year: 2026 },
    ])
  })

  it('rolls backward across a year boundary', () => {
    expect(trailingMonths(3, new Date('2026-01-15'))).toEqual([
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
    ])
  })

  it('returns just the current month when monthsBack is 1', () => {
    expect(trailingMonths(1, new Date('2026-05-15'))).toEqual([{ month: 5, year: 2026 }])
  })
})
