import { describe, it, expect } from 'vitest'
import { computeDashboardData, type DashboardRawData } from './compute'

function makeRaw(overrides: Partial<DashboardRawData> = {}): DashboardRawData {
  return {
    budget: null,
    transactions: [],
    streak: null,
    notifications: [],
    categoryActuals: {},
    ...overrides,
  }
}

describe('computeDashboardData', () => {
  it('computes planned/actual/pct for a budget category', () => {
    const raw = makeRaw({
      budget: {
        total_income_expected: null,
        budget_items: [
          {
            category_id: 'c1',
            planned_amount: 500,
            category: { id: 'c1', name: 'Groceries', color: '#10B981', icon: '🛒' },
          },
        ],
      },
      categoryActuals: { c1: 300 },
    })

    const result = computeDashboardData(raw)

    expect(result.categories).toEqual([
      { id: 'c1', name: 'Groceries', color: '#10B981', icon: '🛒', planned: 500, actual: 300, pct: 60 },
    ])
    expect(result.total_budgeted).toBe(500)
    expect(result.total_spent).toBe(300)
    expect(result.total_remaining).toBe(200)
    expect(result.pct_used).toBe(60)
    expect(result.streak.on_track).toBe(true)
  })

  it('flags overspending with a negative remaining and on_track = false', () => {
    const raw = makeRaw({
      budget: {
        total_income_expected: null,
        budget_items: [
          {
            category_id: 'c1',
            planned_amount: 500,
            category: { id: 'c1', name: 'Groceries', color: '#10B981', icon: '🛒' },
          },
        ],
      },
      categoryActuals: { c1: 600 },
    })

    const result = computeDashboardData(raw)

    expect(result.categories[0].pct).toBe(120)
    expect(result.total_remaining).toBe(-100)
    expect(result.streak.on_track).toBe(false)
  })

  it('counts a transaction as income when its category says so, even if is_income is stale', () => {
    // Regression test: manually recategorizing a transaction only ever updates
    // category_id (see app/api/transactions/[id]/category/route.ts) — it never
    // touches is_income. A transaction moved into an income category must still
    // count as income even though its own is_income flag was never flipped.
    const raw = makeRaw({
      transactions: [
        {
          id: 't1',
          merchant_name: 'Employer',
          description: 'ACH DEPOSIT',
          amount: -2000,
          is_income: false, // stale/wrong flag
          date: '2026-05-01',
          category_id: 'inc1',
          category: { id: 'inc1', name: 'Paycheck', color: '#10B981', icon: '💰', is_income: true },
          splits: null,
        },
      ],
    })

    const result = computeDashboardData(raw)

    expect(result.income.actual).toBe(2000)
    expect(result.income.sources).toEqual([
      { id: 'inc1', name: 'Paycheck', icon: '💰', color: '#10B981', amount: 2000 },
    ])
    // Correctly-classified income must not also show up as a recent expense.
    expect(result.recent_transactions).toHaveLength(0)
  })

  it('falls back to the transaction is_income flag when uncategorized', () => {
    const raw = makeRaw({
      transactions: [
        {
          id: 't1',
          merchant_name: 'Unknown Deposit',
          description: 'DEPOSIT',
          amount: -500,
          is_income: true,
          date: '2026-05-01',
          category_id: null,
          category: null,
          splits: null,
        },
      ],
    })

    const result = computeDashboardData(raw)

    expect(result.income.actual).toBe(500)
    expect(result.income.sources).toEqual([
      { id: '__none__', name: 'Other Income', icon: '💵', color: '#6B7280', amount: 500 },
    ])
  })

  it('limits recent_transactions to 5 expense transactions', () => {
    const transactions = Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      merchant_name: `Merchant ${i}`,
      description: 'purchase',
      amount: 10,
      is_income: false,
      date: '2026-05-01',
      category_id: null,
      category: null,
      splits: null,
    }))

    const result = computeDashboardData(makeRaw({ transactions }))

    expect(result.recent_transactions).toHaveLength(5)
  })

  it('defaults streak and passes notifications through when absent', () => {
    const result = computeDashboardData(makeRaw({ streak: null, notifications: null }))

    expect(result.streak).toEqual({ current: 0, longest: 0, on_track: true })
    expect(result.notifications).toEqual([])
  })
})
