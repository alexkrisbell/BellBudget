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

describe('detectRecurringBills', () => {
  it('flags a same-amount, ~monthly charge seen 3 times', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15' }),
        tx({ date: '2026-02-14' }),
        tx({ date: '2026-03-16' }),
      ],
    }

    const result = detectRecurringBills(raw)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      label: 'Netflix',
      averageAmount: 15.49,
      lastDate: '2026-03-16',
      occurrences: 3,
    })
  })

  it('requires at least 2 occurrences', () => {
    const raw: RecurringBillsRawData = { transactions: [tx({ date: '2026-01-15' })] }
    expect(detectRecurringBills(raw)).toEqual([])
  })

  it('ignores a merchant with wildly inconsistent amounts (e.g. general shopping)', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Amazon', date: '2026-01-05', amount: 12.99 }),
        tx({ merchant_name: 'Amazon', date: '2026-01-20', amount: 84.5 }),
        tx({ merchant_name: 'Amazon', date: '2026-02-11', amount: 6.25 }),
      ],
    }
    expect(detectRecurringBills(raw)).toEqual([])
  })

  it('ignores charges that are not roughly monthly apart', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-05' }),
        tx({ date: '2026-01-12' }), // a week later, not a month
        tx({ date: '2026-01-19' }),
      ],
    }
    expect(detectRecurringBills(raw)).toEqual([])
  })

  it('tolerates small amount drift (tax/fee changes) within 5%', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', amount: 15.49 }),
        tx({ date: '2026-02-14', amount: 15.99 }),
      ],
    }
    const result = detectRecurringBills(raw)
    expect(result).toHaveLength(1)
  })

  it('rejects amount drift beyond the tolerance', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', amount: 15.49 }),
        tx({ date: '2026-02-14', amount: 25.0 }),
      ],
    }
    expect(detectRecurringBills(raw)).toEqual([])
  })

  it('estimates the next expected date from the average gap', () => {
    const raw: RecurringBillsRawData = {
      transactions: [tx({ date: '2026-01-01' }), tx({ date: '2026-01-31' })], // 30-day gap
    }
    const result = detectRecurringBills(raw)
    expect(result[0].nextExpectedDate).toBe('2026-03-02')
  })

  it('sorts results by average amount, largest first', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: 'Netflix', date: '2026-01-15', amount: 15.49 }),
        tx({ merchant_name: 'Netflix', date: '2026-02-14', amount: 15.49 }),
        tx({ merchant_name: 'Gym', description: 'GYM MEMBERSHIP', date: '2026-01-10', amount: 60 }),
        tx({ merchant_name: 'Gym', description: 'GYM MEMBERSHIP', date: '2026-02-09', amount: 60 }),
      ],
    }
    const result = detectRecurringBills(raw)
    expect(result.map((r) => r.label)).toEqual(['Gym', 'Netflix'])
  })

  it('handles category coming back as an array (Supabase to-one relation quirk)', () => {
    const cat = { id: 'c1', name: 'Subscriptions', icon: '📱', color: '#0EA5E9' }
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ date: '2026-01-15', category: [cat] }),
        tx({ date: '2026-02-14', category: [cat] }),
      ],
    }
    const result = detectRecurringBills(raw)
    expect(result[0].category).toEqual(cat)
  })

  it('falls back to description when merchant_name is missing', () => {
    const raw: RecurringBillsRawData = {
      transactions: [
        tx({ merchant_name: null, description: 'SPOTIFY USA', date: '2026-01-15' }),
        tx({ merchant_name: null, description: 'SPOTIFY USA', date: '2026-02-14' }),
      ],
    }
    const result = detectRecurringBills(raw)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('SPOTIFY USA')
  })
})
