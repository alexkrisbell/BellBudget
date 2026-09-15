import { describe, it, expect } from 'vitest'
import { detectRecurringBills, type RecurringBillsRawData } from './detect'

function tx(overrides: Partial<RecurringBillsRawData['transactions'][number]> = {}) {
  return {
    merchant_name: 'Netflix',
    description: 'NETFLIX.COM',
    amount: 15.49,
    date: '2026-01-15',
    category: null,
    ...overrides,
  }
}

// Pin "now" a few days after the latest fixture transaction so the
// staleness filter doesn't depend on when the test suite actually runs.
const NOW = new Date('2026-03-20')

describe('detectRecurringBills', () => {
  it('flags a same-amount, ~monthly charge seen 3 times', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15' }),
        tx({ date: '2026-02-14' }),
        tx({ date: '2026-03-16' }),
      ],
    }

    const result = detectRecurringBills(raw, NOW)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      label: 'Netflix',
      averageAmount: 15.49,
      lastDate: '2026-03-16',
      occurrences: 3,
    })
  })

  it('requires at least 3 occurrences (2 same-price visits can be coincidence)', () => {
    const raw: RecurringBillsRawData = {
      transactions: [tx({ date: '2026-01-15' }), tx({ date: '2026-02-14' })],
    }
    expect(detectRecurringBills(raw, NOW)).toEqual([])
  })

  it('ignores a merchant with wildly inconsistent amounts (e.g. general shopping)', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Amazon', date: '2026-01-05', amount: 12.99 }),
        tx({ merchant_name: 'Amazon', date: '2026-02-04', amount: 84.5 }),
        tx({ merchant_name: 'Amazon', date: '2026-03-06', amount: 6.25 }),
      ],
    }
    expect(detectRecurringBills(raw, NOW)).toEqual([])
  })

  it('ignores charges that are not roughly monthly apart', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-05' }),
        tx({ date: '2026-01-12' }), // a week later, not a month
        tx({ date: '2026-01-19' }),
      ],
    }
    expect(detectRecurringBills(raw, NOW)).toEqual([])
  })

  it('tolerates small amount drift (tax/fee changes) within 5%', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', amount: 15.49 }),
        tx({ date: '2026-02-14', amount: 15.99 }),
        tx({ date: '2026-03-16', amount: 15.49 }),
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result).toHaveLength(1)
  })

  it('rejects amount drift beyond the tolerance', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', amount: 15.49 }),
        tx({ date: '2026-02-14', amount: 25.0 }),
        tx({ date: '2026-03-16', amount: 15.49 }),
      ],
    }
    expect(detectRecurringBills(raw, NOW)).toEqual([])
  })

  it('estimates the next expected date from the average gap', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-01' }),
        tx({ date: '2026-01-31' }), // 30-day gap
        tx({ date: '2026-03-02' }), // another 30-day gap
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result[0].nextExpectedDate).toBe('2026-04-01')
  })

  it('sorts results by average amount, largest first', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Netflix', date: '2026-01-15', amount: 15.49 }),
        tx({ merchant_name: 'Netflix', date: '2026-02-14', amount: 15.49 }),
        tx({ merchant_name: 'Netflix', date: '2026-03-16', amount: 15.49 }),
        tx({ merchant_name: 'Gym', description: 'GYM MEMBERSHIP', date: '2026-01-10', amount: 60 }),
        tx({ merchant_name: 'Gym', description: 'GYM MEMBERSHIP', date: '2026-02-09', amount: 60 }),
        tx({ merchant_name: 'Gym', description: 'GYM MEMBERSHIP', date: '2026-03-11', amount: 60 }),
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result.map((r) => r.label)).toEqual(['Gym', 'Netflix'])
  })

  it('handles category coming back as an array (Supabase to-one relation quirk)', () => {
    const cat = { id: 'c1', name: 'Subscriptions', icon: '📱', color: '#0EA5E9' }
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', category: [cat] }),
        tx({ date: '2026-02-14', category: [cat] }),
        tx({ date: '2026-03-16', category: [cat] }),
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result[0].category).toEqual(cat)
  })

  it('falls back to description when merchant_name is missing', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: null, description: 'SPOTIFY USA', date: '2026-01-15' }),
        tx({ merchant_name: null, description: 'SPOTIFY USA', date: '2026-02-14' }),
        tx({ merchant_name: null, description: 'SPOTIFY USA', date: '2026-03-16' }),
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('SPOTIFY USA')
  })

  it('excludes a bill whose last charge is long past (e.g. rent from a place you moved out of)', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Old Landlord', date: '2025-09-01', amount: 1200 }),
        tx({ merchant_name: 'Old Landlord', date: '2025-10-01', amount: 1200 }),
        tx({ merchant_name: 'Old Landlord', date: '2025-11-01', amount: 1200 }),
      ],
    }
    // "now" (2026-03-20) is ~4.5 months after the last charge — well past the
    // ~45-day stale cutoff for a monthly bill.
    expect(detectRecurringBills(raw, NOW)).toEqual([])
  })

  it('still includes a bill whose last charge was recent', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Current Landlord', date: '2026-01-01', amount: 1500 }),
        tx({ merchant_name: 'Current Landlord', date: '2026-02-01', amount: 1500 }),
        tx({ merchant_name: 'Current Landlord', date: '2026-03-01', amount: 1500 }),
      ],
    }
    const result = detectRecurringBills(raw, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Current Landlord')
  })
})
