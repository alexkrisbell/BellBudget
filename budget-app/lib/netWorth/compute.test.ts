import { describe, it, expect } from 'vitest'
import { computeNetWorthData, type NetWorthRawData } from './compute'

describe('computeNetWorthData', () => {
  it('sums asset accounts and subtracts liability accounts on the same day', () => {
    const raw: NetWorthRawData = {
      snapshots: [
        { date: '2026-05-01', balance: 5000, account: { type: 'depository' } },
        { date: '2026-05-01', balance: 10000, account: { type: 'investment' } },
        { date: '2026-05-01', balance: 1200, account: { type: 'credit' } },
      ],
    }

    const result = computeNetWorthData(raw)

    expect(result.points).toEqual([{ date: '2026-05-01', netWorth: 5000 + 10000 - 1200 }])
    expect(result.current).toBe(13800)
  })

  it('treats loans as liabilities and unknown/other types as assets', () => {
    const raw: NetWorthRawData = {
      snapshots: [
        { date: '2026-05-01', balance: 20000, account: { type: 'loan' } },
        { date: '2026-05-01', balance: 500, account: { type: 'other' } },
      ],
    }

    const result = computeNetWorthData(raw)

    expect(result.current).toBe(500 - 20000)
  })

  it('produces one point per day, sorted chronologically', () => {
    const raw: NetWorthRawData = {
      snapshots: [
        { date: '2026-05-03', balance: 100, account: { type: 'depository' } },
        { date: '2026-05-01', balance: 100, account: { type: 'depository' } },
        { date: '2026-05-02', balance: 100, account: { type: 'depository' } },
      ],
    }

    const result = computeNetWorthData(raw)

    expect(result.points.map((p) => p.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('computes change as the difference between the first and last point', () => {
    const raw: NetWorthRawData = {
      snapshots: [
        { date: '2026-04-01', balance: 1000, account: { type: 'depository' } },
        { date: '2026-05-01', balance: 1500, account: { type: 'depository' } },
      ],
    }

    const result = computeNetWorthData(raw)

    expect(result.changeAmount).toBe(500)
  })

  it('handles account coming back as an array (Supabase to-one relation quirk)', () => {
    const raw: NetWorthRawData = {
      snapshots: [{ date: '2026-05-01', balance: 1200, account: [{ type: 'credit' }] }],
    }

    const result = computeNetWorthData(raw)

    expect(result.current).toBe(-1200)
  })

  it('returns nulls for current/change when there is no history yet', () => {
    const result = computeNetWorthData({ snapshots: [] })
    expect(result.points).toEqual([])
    expect(result.current).toBeNull()
    expect(result.changeAmount).toBeNull()
  })

  it('returns null change (but a real current value) with only one day of history', () => {
    const raw: NetWorthRawData = {
      snapshots: [{ date: '2026-05-01', balance: 1000, account: { type: 'depository' } }],
    }
    const result = computeNetWorthData(raw)
    expect(result.current).toBe(1000)
    expect(result.changeAmount).toBeNull()
  })

  it('adds investment snapshots as assets alongside bank/credit accounts on the same day', () => {
    const raw: NetWorthRawData = {
      snapshots: [
        { date: '2026-05-01', balance: 5000, account: { type: 'depository' } },
        { date: '2026-05-01', balance: 1200, account: { type: 'credit' } },
      ],
      investmentSnapshots: [{ date: '2026-05-01', balance: 100000 }],
    }

    const result = computeNetWorthData(raw)

    expect(result.current).toBe(5000 - 1200 + 100000)
  })

  it('treats a day with only investment snapshots as its own point', () => {
    const raw: NetWorthRawData = {
      snapshots: [],
      investmentSnapshots: [{ date: '2026-05-01', balance: 50000 }],
    }

    const result = computeNetWorthData(raw)

    expect(result.points).toEqual([{ date: '2026-05-01', netWorth: 50000 }])
  })

  it('works without investmentSnapshots at all (optional field, backward compatible)', () => {
    const result = computeNetWorthData({
      snapshots: [{ date: '2026-05-01', balance: 1000, account: { type: 'depository' } }],
    })
    expect(result.current).toBe(1000)
  })
})
