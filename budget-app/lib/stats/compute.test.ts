import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeStatsData, type StatsRawData } from './compute'

// computeStatsData anchors its trailing-month window on "now" internally,
// so pin the clock for deterministic month buckets/labels.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-15'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('computeStatsData', () => {
  it('buckets income and spend per month and computes saved/rate', () => {
    const raw: StatsRawData = {
      transactions: [
        { date: '2026-05-01', amount: -3000, is_income: true, category: null },
        { date: '2026-05-05', amount: 1000, is_income: false, category: null },
        { date: '2026-05-10', amount: 1000, is_income: false, category: null },
      ],
    }

    const result = computeStatsData(raw, 1)

    expect(result.months).toHaveLength(1)
    expect(result.months[0]).toMatchObject({
      month: 5,
      year: 2026,
      label: 'May',
      income: 3000,
      spent: 2000,
      saved: 1000,
      rate: 1000 / 3000,
    })
  })

  it('counts a transaction as income when its category says so, even if is_income is stale', () => {
    // Same underlying bug as the dashboard: manually recategorizing a
    // transaction never updates its own is_income flag.
    const raw: StatsRawData = {
      transactions: [
        { date: '2026-05-01', amount: -1500, is_income: false, category: { is_income: true } },
      ],
    }

    const result = computeStatsData(raw, 1)

    expect(result.months[0].income).toBe(1500)
    expect(result.months[0].spent).toBe(0)
  })

  it('falls back to the transaction is_income flag when uncategorized', () => {
    const raw: StatsRawData = {
      transactions: [{ date: '2026-05-01', amount: -1500, is_income: true, category: null }],
    }

    const result = computeStatsData(raw, 1)

    expect(result.months[0].income).toBe(1500)
  })

  it('handles category coming back as an array (Supabase to-one relation quirk)', () => {
    const raw: StatsRawData = {
      transactions: [
        { date: '2026-05-01', amount: -1500, is_income: false, category: [{ is_income: true }] },
      ],
    }

    const result = computeStatsData(raw, 1)

    expect(result.months[0].income).toBe(1500)
  })

  it('fills months with no transactions as zero, keeping the window continuous', () => {
    const raw: StatsRawData = { transactions: [{ date: '2026-05-01', amount: 100, is_income: false, category: null }] }

    const result = computeStatsData(raw, 3)

    expect(result.months.map((m) => `${m.year}-${m.month}`)).toEqual(['2026-3', '2026-4', '2026-5'])
    expect(result.months[0]).toMatchObject({ income: 0, spent: 0, saved: 0, rate: null })
    expect(result.months[2].spent).toBe(100)
  })

  it('rolls the trailing window backward across a year boundary', () => {
    vi.setSystemTime(new Date('2026-01-15'))
    const result = computeStatsData({ transactions: [] }, 3)
    expect(result.months.map((m) => `${m.year}-${m.month}`)).toEqual(['2025-11', '2025-12', '2026-1'])
  })

  it('averages monthly spend across all months, including zero-activity ones', () => {
    const raw: StatsRawData = {
      transactions: [{ date: '2026-05-01', amount: 300, is_income: false, category: null }],
    }
    const result = computeStatsData(raw, 3)
    // months: Mar=0, Apr=0, May=300 -> avg = 100
    expect(result.avgMonthlySpend).toBe(100)
  })

  it('excludes zero-income months from the average savings rate', () => {
    const raw: StatsRawData = {
      transactions: [
        { date: '2026-04-01', amount: 100, is_income: false, category: null }, // no income this month -> rate null
        { date: '2026-05-01', amount: -1000, is_income: true, category: null },
        { date: '2026-05-02', amount: 500, is_income: false, category: null },
      ],
    }
    const result = computeStatsData(raw, 3)
    // Only May has income: rate = (1000-500)/1000 = 0.5. March has no data either (rate null).
    expect(result.avgSavingsRate).toBe(0.5)
  })
})
