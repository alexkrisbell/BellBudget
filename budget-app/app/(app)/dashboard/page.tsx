import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { DashboardData } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const [
    { data: budget },
    { data: transactions },
    { data: streak },
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from('budgets')
      .select('total_income_expected, budget_items(category_id, planned_amount, category:categories(id,name,color,icon))')
      .eq('household_id', member.household_id)
      .eq('month', month)
      .eq('year', year)
      .eq('is_template', false)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('id, merchant_name, description, amount, is_income, date, category_id, category:categories(id,name,color,icon)')
      .eq('household_id', member.household_id)
      .eq('excluded', false)
      .eq('pending', false)
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false }),
    supabase
      .from('streaks')
      .select('current_streak, longest_streak')
      .eq('household_id', member.household_id)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('*')
      .eq('household_id', member.household_id)
      .is('read_at', null)
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const txList = transactions ?? []
  const expenseTxs = txList.filter((tx) => !tx.is_income)
  const incomeTxs = txList.filter((tx) => tx.is_income)

  const actualByCategory: Record<string, number> = {}
  for (const tx of txList) {
    if (tx.category_id) {
      actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount
    }
  }

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
  const totalSpent = budgetItems.reduce((s, item) => s + Math.max(0, actualByCategory[item.category_id] ?? 0), 0)
  const totalRemaining = totalBudgeted - totalSpent
  const pctUsed = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0
  const onTrack = totalBudgeted === 0 || totalSpent <= totalBudgeted
  const totalActualIncome = incomeTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0)

  // Group income by category so the user can see where money came from
  type TxWithCat = typeof incomeTxs[number]
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

  const initialData: DashboardData = {
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
    notifications: (notifications ?? []) as DashboardData['notifications'],
    recent_transactions: expenseTxs.slice(0, 5).map((tx) => ({
      id: tx.id,
      merchant_name: tx.merchant_name,
      description: tx.description,
      amount: tx.amount,
      is_income: tx.is_income,
      date: tx.date,
      category: tx.category as unknown as { id: string; name: string; color: string; icon: string } | null,
    })),
  }

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your financial snapshot.</p>
      </div>
      <DashboardClient initialData={initialData} initialMonth={month} initialYear={year} />
    </div>
  )
}
