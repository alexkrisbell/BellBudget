import type { createClient } from '@/lib/supabase/server'
import { monthRange, trailingMonths } from '@/lib/dateRange'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Credit cards and loans are debts — their balance subtracts from net worth.
// Everything else (checking, savings, investment, and Plaid's catch-all
// "other") is treated as an asset.
const LIABILITY_TYPES = new Set(['credit', 'loan'])

interface SnapshotAccount {
  type: string
}

export interface NetWorthRawData {
  snapshots: Array<{
    date: string
    balance: number
    account: SnapshotAccount | SnapshotAccount[] | null
  }>
}

interface FetchNetWorthRawDataArgs {
  supabase: SupabaseServerClient
  householdId: string
  monthsBack: number
}

export async function fetchNetWorthRawData({
  supabase,
  householdId,
  monthsBack,
}: FetchNetWorthRawDataArgs): Promise<NetWorthRawData> {
  const months = trailingMonths(monthsBack)
  const { start } = monthRange(months[0].month, months[0].year)

  const { data } = await supabase
    .from('account_balance_snapshots')
    .select('date, balance, account:accounts(type)')
    .eq('household_id', householdId)
    .gte('date', start)
    .order('date', { ascending: true })

  return { snapshots: data ?? [] }
}

export interface NetWorthPoint {
  date: string
  netWorth: number
}

export interface NetWorthData {
  points: NetWorthPoint[]
  current: number | null
  changeAmount: number | null
}

function resolveAccountType(account: SnapshotAccount | SnapshotAccount[] | null): string | null {
  const a = Array.isArray(account) ? account[0] : account
  return a ? a.type : null
}

export function computeNetWorthData(raw: NetWorthRawData): NetWorthData {
  const byDate = new Map<string, number>()
  for (const snap of raw.snapshots) {
    const type = resolveAccountType(snap.account)
    const signed = type && LIABILITY_TYPES.has(type) ? -snap.balance : snap.balance
    byDate.set(snap.date, (byDate.get(snap.date) ?? 0) + signed)
  }

  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, netWorth]) => ({ date, netWorth }))

  const current = points.length > 0 ? points[points.length - 1].netWorth : null
  const changeAmount = points.length > 1 ? points[points.length - 1].netWorth - points[0].netWorth : null

  return { points, current, changeAmount }
}
