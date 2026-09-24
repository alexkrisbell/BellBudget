import type { createClient } from '@/lib/supabase/server'
import type { InvestmentAccount, InvestmentHolding } from '@/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface InvestmentsRawData {
  accounts: InvestmentAccount[]
  holdings: InvestmentHolding[]
}

interface FetchInvestmentsRawDataArgs {
  supabase: SupabaseServerClient
  householdId: string
}

export async function fetchInvestmentsRawData({
  supabase,
  householdId,
}: FetchInvestmentsRawDataArgs): Promise<InvestmentsRawData> {
  // Holdings get a new row per sync day — only need enough lookback to find
  // the latest day per account, not the whole history.
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: accounts }, { data: holdings }] = await Promise.all([
    supabase
      .from('investment_accounts')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('investment_holdings')
      .select('*')
      .eq('household_id', householdId)
      .gte('date', cutoff)
      .order('date', { ascending: false }),
  ])

  return { accounts: accounts ?? [], holdings: holdings ?? [] }
}

export interface AccountHoldings {
  account: InvestmentAccount
  holdings: InvestmentHolding[]
  asOfDate: string | null
}

export function computeInvestmentsData(raw: InvestmentsRawData): AccountHoldings[] {
  const holdingsByAccount = new Map<string, InvestmentHolding[]>()
  for (const h of raw.holdings) {
    const list = holdingsByAccount.get(h.investment_account_id) ?? []
    list.push(h)
    holdingsByAccount.set(h.investment_account_id, list)
  }

  return raw.accounts.map((account) => {
    const all = holdingsByAccount.get(account.id) ?? []
    const asOfDate = all.reduce((max, h) => (h.date > max ? h.date : max), '') || null
    const holdings = asOfDate
      ? all.filter((h) => h.date === asOfDate).sort((a, b) => b.market_value - a.market_value)
      : []
    return { account, holdings, asOfDate }
  })
}
