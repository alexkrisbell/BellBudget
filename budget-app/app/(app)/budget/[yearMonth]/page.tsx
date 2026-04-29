import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MonthNav } from '@/components/budget/MonthNav'
import { BudgetEditor } from '@/components/budget/BudgetEditor'
import type { Category } from '@/types'

async function getBudgetData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  month: number,
  year: number
) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const [{ data: categories }, { data: budget }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .eq('is_income', false)
      .order('sort_order')
      .order('name'),
    supabase
      .from('budgets')
      .select('*')
      .eq('household_id', householdId)
      .eq('month', month)
      .eq('year', year)
      .eq('is_template', false)
      .maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = []
  if (budget) {
    const [{ data: rawItems }, { data: txActuals }] = await Promise.all([
      supabase
        .from('budget_items')
        .select('*, category:categories(id,name,color,icon,is_income,sort_order)')
        .eq('budget_id', budget.id)
        .order('sort_order'),
      supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('household_id', householdId)
        .eq('excluded', false)
        .eq('pending', false)
        .gte('date', start)
        .lt('date', end),
    ])

    const actualByCategory: Record<string, number> = {}
    for (const tx of txActuals ?? []) {
      if (tx.category_id) {
        actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount
      }
    }

    items = (rawItems ?? []).map((item) => {
      const actual = actualByCategory[item.category_id] ?? 0
      const pct = item.planned_amount > 0 ? Math.round((Math.max(0, actual) / item.planned_amount) * 100) : 0
      return { ...item, actual, pct }
    })
  }

  return { categories: (categories ?? []) as Category[], budget: budget ?? null, items }
}

export default async function BudgetMonthPage({
  params,
}: {
  params: Promise<{ yearMonth: string }>
}) {
  const { yearMonth } = await params
  const match = yearMonth.match(/^(\d{4})-(\d{2})$/)
  if (!match) notFound()

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  if (month < 1 || month > 12) notFound()

  // Redirect current month to canonical /budget
  const now = new Date()
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    redirect('/budget')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  // Past months are read-only; future months are editable
  const isPast =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth() + 1)

  const { categories, budget, items } = await getBudgetData(
    supabase,
    member.household_id,
    month,
    year
  )

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Budget</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {MONTH_NAMES[month - 1]} {year}
            {isPast && (
              <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                Past
              </span>
            )}
          </p>
        </div>
        <MonthNav month={month} year={year} />
      </div>
      <BudgetEditor
        budget={budget}
        items={items}
        categories={categories}
        month={month}
        year={year}
        isReadOnly={isPast}
      />
    </div>
  )
}
