import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonthNav } from '@/components/budget/MonthNav'
import { BudgetEditor } from '@/components/budget/BudgetEditor'
import { monthRange } from '@/lib/dateRange'
import { fetchCategoryActuals } from '@/lib/categoryActuals'
import type { Category } from '@/types'

async function getBudgetData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  month: number,
  year: number
) {
  const { start, end } = monthRange(month, year)

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
    const [{ data: rawItems }, actualByCategory] = await Promise.all([
      supabase
        .from('budget_items')
        .select('*, category:categories(id,name,color,icon,is_income,sort_order)')
        .eq('budget_id', budget.id)
        .order('sort_order'),
      fetchCategoryActuals({ supabase, householdId, start, end }),
    ])

    items = (rawItems ?? []).map((item) => {
      const actual = actualByCategory[item.category_id] ?? 0
      const pct = item.planned_amount > 0 ? Math.round((actual / item.planned_amount) * 100) : 0
      return { ...item, actual, pct }
    })
  }

  return { categories: (categories ?? []) as Category[], budget: budget ?? null, items }
}

export default async function BudgetPage() {
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

  const { categories, budget, items } = await getBudgetData(
    supabase,
    member.household_id,
    month,
    year
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Budget</h2>
          <p className="text-sm text-slate-500 mt-0.5">Plan and track your monthly spending.</p>
        </div>
        <MonthNav month={month} year={year} />
      </div>
      <BudgetEditor
        budget={budget}
        items={items}
        categories={categories}
        month={month}
        year={year}
        isReadOnly={false}
      />
    </div>
  )
}
