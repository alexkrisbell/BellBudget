import type { createClient } from '@/lib/supabase/server'
import { monthRange, trailingMonths } from '@/lib/dateRange'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface FetchStatsRawDataArgs {
  supabase: SupabaseServerClient
  householdId: string
  monthsBack: number
}

interface StatsRawData {
  transactions: Array<{
    date: string
    amount: number
    is_income: boolean
    category: { is_income: boolean } | { is_income: boolean }[] | null
  }>
}

export async function fetchStatsRawData({
  supabase,
  householdId,
  monthsBack,
}: FetchStatsRawDataArgs): Promise<StatsRawData> {
  const months = trailingMonths(monthsBack)
  const { start } = monthRange(months[0].month, months[0].year)
  const { end } = monthRange(months.at(-1)!.month, months.at(-1)!.year)

  const { data } = await supabase
    .from('transactions')
    .select('date, amount, is_income, category:categories(is_income)')
    .eq('household_id', householdId)
    .eq('excluded', false)
    .eq('pending', false)
    .gte('date', start)
    .lt('date', end)

  return { transactions: data ?? [] }
}

// A category the user has (re)assigned is the more authoritative signal —
// manually recategorizing a transaction never updates its own is_income flag
// (see app/api/transactions/[id]/category/route.ts), so trust the category's
// is_income when one is set and only fall back to the transaction's own flag
// for uncategorized rows.
function resolveIsIncome(tx: StatsRawData['transactions'][number]): boolean {
  const category = Array.isArray(tx.category) ? tx.category[0] : tx.category
  return category ? category.is_income : tx.is_income
}

export interface MonthStat {
  month: number
  year: number
  label: string
  income: number
  spent: number
  saved: number
  rate: number | null
}

export interface StatsData {
  months: MonthStat[]
  avgMonthlySpend: number
  avgSavingsRate: number | null
}

export function computeStatsData(raw: StatsRawData, monthsBack: number): StatsData {
  const buckets = new Map<string, { income: number; spent: number }>()
  for (const tx of raw.transactions) {
    const [yearStr, monthStr] = tx.date.split('-')
    const key = `${yearStr}-${monthStr}`
    if (!buckets.has(key)) buckets.set(key, { income: 0, spent: 0 })
    const bucket = buckets.get(key)!
    if (resolveIsIncome(tx)) {
      bucket.income += Math.abs(tx.amount)
    } else {
      bucket.spent += tx.amount
    }
  }

  const months: MonthStat[] = trailingMonths(monthsBack).map(({ month, year }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const bucket = buckets.get(key) ?? { income: 0, spent: 0 }
    const saved = bucket.income - bucket.spent
    const rate = bucket.income > 0 ? saved / bucket.income : null
    return {
      month,
      year,
      label: MONTH_LABELS[month - 1],
      income: bucket.income,
      spent: bucket.spent,
      saved,
      rate,
    }
  })

  const avgMonthlySpend = months.reduce((s, m) => s + m.spent, 0) / months.length
  const monthsWithIncome = months.filter((m) => m.rate !== null)
  const avgSavingsRate =
    monthsWithIncome.length > 0
      ? monthsWithIncome.reduce((s, m) => s + (m.rate ?? 0), 0) / monthsWithIncome.length
      : null

  return { months, avgMonthlySpend, avgSavingsRate }
}
