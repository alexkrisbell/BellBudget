import type { createClient } from '@/lib/supabase/server'
import type { DashboardData } from '@/types'
import { monthRange } from '@/lib/dateRange'
import { fetchCategoryActuals } from '@/lib/categoryActuals'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface TxCategory {
  id: string
  name: string
  color: string
  icon: string
  is_income: boolean
}

interface FetchDashboardRawDataArgs {
  supabase: SupabaseServerClient
  householdId: string
  userId: string
  month: number
  year: number
}

interface DashboardRawData {
  budget: {
    total_income_expected: number | null
    budget_items: unknown
  } | null
  transactions: Array<{
    id: string
    merchant_name: string | null
    description: string
    amount: number
    is_income: boolean
    date: string
    category_id: string | null
    category: TxCategory | TxCategory[] | null
    splits: unknown
  }> | null
  streak: {
    current_streak: number
    longest_streak: number
  } | null
  notifications: DashboardData['notifications'] | null
  categoryActuals: Record<string, number>
}

export async function fetchDashboardRawData({
  supabase,
  householdId,
  userId,
  month,
  year,
}: FetchDashboardRawDataArgs): Promise<DashboardRawData> {
  const { start, end } = monthRange(month, year)

  const [
    { data: budget },
    { data: transactions },
    { data: streak },
    { data: notifications },
    categoryActuals,
  ] = await Promise.all([
      supabase
        .from('budgets')
        .select(
          'total_income_expected, budget_items(category_id, planned_amount, category:categories(id,name,color,icon))'
        )
        .eq('household_id', householdId)
        .eq('month', month)
        .eq('year', year)
        .eq('is_template', false)
        .maybeSingle(),
      supabase
        .from('transactions')
        .select(
          'id, merchant_name, description, amount, is_income, date, category_id, category:categories(id,name,color,icon,is_income), splits:transaction_splits(id,transaction_id,household_id,category_id,amount,created_at,category:categories(id,name,color,icon))'
        )
        .eq('household_id', householdId)
        .eq('excluded', false)
        .eq('pending', false)
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('streaks')
        .select('current_streak, longest_streak')
        .eq('household_id', householdId)
        .maybeSingle(),
      supabase
        .from('notifications')
        .select('*')
        .eq('household_id', householdId)
        .is('read_at', null)
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(3),
      fetchCategoryActuals({ supabase, householdId, start, end }),
    ])

  return { budget, transactions, streak, notifications, categoryActuals }
}

// A category the user has (re)assigned is the more authoritative signal —
// manually recategorizing a transaction never updates its own is_income flag
// (see app/api/transactions/[id]/category/route.ts), so trust the category's
// is_income when one is set and only fall back to the transaction's own flag
// for uncategorized rows.
function normalizeCategory(category: TxCategory | TxCategory[] | null): TxCategory | null {
  return Array.isArray(category) ? (category[0] ?? null) : category
}

function resolveIsIncome(tx: { is_income: boolean; category: TxCategory | TxCategory[] | null }): boolean {
  const category = normalizeCategory(tx.category)
  return category ? category.is_income : tx.is_income
}

export function computeDashboardData(raw: DashboardRawData): DashboardData {
  const { budget, transactions, streak, notifications, categoryActuals: actualByCategory } = raw

  const txList = transactions ?? []
  const expenseTxs = txList.filter((tx) => !resolveIsIncome(tx))
  const incomeTxs = txList.filter((tx) => resolveIsIncome(tx))

  const budgetItems = (budget?.budget_items ?? []) as unknown as Array<{
    category_id: string
    planned_amount: number
    category: { id: string; name: string; color: string; icon: string } | null
  }>

  const categories = budgetItems.map((item) => {
    const actual = actualByCategory[item.category_id] ?? 0
    const planned = item.planned_amount
    const pct = planned > 0 ? Math.round((Math.max(0, actual) / planned) * 100) : 0
    return {
      id: item.category?.id ?? item.category_id,
      name: item.category?.name ?? 'Unknown',
      color: item.category?.color ?? '#6B7280',
      icon: item.category?.icon ?? '📦',
      planned,
      actual,
      pct,
    }
  })

  const totalBudgeted = budgetItems.reduce((s, i) => s + i.planned_amount, 0)
  const totalSpent = budgetItems.reduce(
    (s, item) => s + Math.max(0, actualByCategory[item.category_id] ?? 0),
    0
  )
  const totalRemaining = totalBudgeted - totalSpent
  const pctUsed = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
  const onTrack = totalBudgeted === 0 || totalSpent <= totalBudgeted
  const totalActualIncome = incomeTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0)

  // Group income by category so the user can see where money came from
  type TxWithCat = (typeof incomeTxs)[number]
  const incomeByCat: Record<string, { cat: TxWithCat['category']; amount: number }> = {}
  for (const tx of incomeTxs) {
    const key = tx.category_id ?? '__none__'
    if (!incomeByCat[key]) incomeByCat[key] = { cat: tx.category, amount: 0 }
    incomeByCat[key].amount += Math.abs(tx.amount)
  }
  type CatShape = { id: string; name: string; icon: string; color: string } | null
  const incomeSources = Object.values(incomeByCat)
    .map(({ cat, amount }) => {
      const c = cat as unknown as CatShape
      return {
        id: c?.id ?? '__none__',
        name: c?.name ?? 'Other Income',
        icon: c?.icon ?? '💵',
        color: c?.color ?? '#6B7280',
        amount,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return {
    total_budgeted: totalBudgeted,
    total_spent: totalSpent,
    total_remaining: totalRemaining,
    pct_used: pctUsed,
    categories,
    income: {
      expected: budget?.total_income_expected ?? null,
      actual: totalActualIncome,
      sources: incomeSources,
    },
    streak: {
      current: streak?.current_streak ?? 0,
      longest: streak?.longest_streak ?? 0,
      on_track: onTrack,
    },
    notifications: notifications ?? [],
    recent_transactions: expenseTxs.slice(0, 5).map((tx) => ({
      id: tx.id,
      merchant_name: tx.merchant_name,
      description: tx.description,
      amount: tx.amount,
      is_income: resolveIsIncome(tx),
      date: tx.date,
      category: normalizeCategory(tx.category),
      splits: tx.splits as unknown as DashboardData['recent_transactions'][number]['splits'],
    })),
  }
}
