import { describe, it, expect } from 'vitest'
import { computeInvestmentsData, type InvestmentsRawData } from './compute'
import type { InvestmentAccount, InvestmentHolding } from '@/types'

function account(overrides: Partial<InvestmentAccount> = {}): InvestmentAccount {
  return {
    id: 'acc-1',
    household_id: 'hh-1',
    brokerage_connection_id: 'conn-1',
    schwab_account_id: 'hash-1',
    nickname: null,
    last4: '4821',
    account_type: 'IRA',
    cash_balance: 100,
    market_value: 1000,
    balance_updated_at: '2026-05-01T00:00:00Z',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function holding(overrides: Partial<InvestmentHolding> = {}): InvestmentHolding {
  return {
    id: 'h-1',
    household_id: 'hh-1',
    investment_account_id: 'acc-1',
    symbol: 'VTI',
    description: 'Vanguard Total Stock Market',
    asset_type: 'EQUITY',
    quantity: 10,
    market_value: 1000,
    cost_basis: 800,
    date: '2026-05-01',
    created_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeInvestmentsData', () => {
  it('picks only the most recent day of holdings for each account', () => {
    const raw: InvestmentsRawData = {
      accounts: [account()],
      holdings: [
        holding({ id: 'h-old', date: '2026-04-30', market_value: 900 }),
        holding({ id: 'h-new', date: '2026-05-01', market_value: 1000 }),
      ],
    }

    const result = computeInvestmentsData(raw)

    expect(result[0].asOfDate).toBe('2026-05-01')
    expect(result[0].holdings).toEqual([holding({ id: 'h-new', date: '2026-05-01', market_value: 1000 })])
  })

  it('sorts holdings within an account by value descending', () => {
    const raw: InvestmentsRawData = {
      accounts: [account()],
      holdings: [
        holding({ id: 'h-small', symbol: 'BND', market_value: 200 }),
        holding({ id: 'h-big', symbol: 'VTI', market_value: 800 }),
      ],
    }

    const result = computeInvestmentsData(raw)

    expect(result[0].holdings.map((h) => h.symbol)).toEqual(['VTI', 'BND'])
  })

  it('keeps each account\'s holdings independent of other accounts\' sync dates', () => {
    const raw: InvestmentsRawData = {
      accounts: [account({ id: 'acc-1' }), account({ id: 'acc-2' })],
      holdings: [
        holding({ investment_account_id: 'acc-1', date: '2026-05-01' }),
        holding({ investment_account_id: 'acc-2', date: '2026-04-28' }), // stale sync
      ],
    }

    const result = computeInvestmentsData(raw)

    expect(result.find((r) => r.account.id === 'acc-1')?.asOfDate).toBe('2026-05-01')
    expect(result.find((r) => r.account.id === 'acc-2')?.asOfDate).toBe('2026-04-28')
  })

  it('returns an empty holdings array and null asOfDate for an account with no holdings rows yet', () => {
    const raw: InvestmentsRawData = { accounts: [account()], holdings: [] }

    const result = computeInvestmentsData(raw)

    expect(result[0].holdings).toEqual([])
    expect(result[0].asOfDate).toBeNull()
  })

  it('returns an empty list when there are no investment accounts', () => {
    const result = computeInvestmentsData({ accounts: [], holdings: [] })
    expect(result).toEqual([])
  })
})
