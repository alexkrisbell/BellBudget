import { createClient } from '@/lib/supabase/server'

function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  return { start, end }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') ?? '0', 10)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  if (!month || !year) return Response.json({ error: 'month and year required.' }, { status: 400 })

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('household_id', member.household_id)
    .eq('month', month)
    .eq('year', year)
    .eq('is_template', false)
    .maybeSingle()

  if (!budget) return Response.json({ budget: null, items: [] })

  const { start, end } = monthRange(month, year)

  const [{ data: rawItems }, { data: txActuals }] = await Promise.all([
    supabase
      .from('budget_items')
      .select('*, category:categories(id,name,color,icon,is_income,sort_order)')
      .eq('budget_id', budget.id)
      .order('sort_order'),
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('household_id', member.household_id)
      .eq('is_income', false)
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

  const items = (rawItems ?? []).map((item) => {
    const actual = actualByCategory[item.category_id] ?? 0
    const pct = item.planned_amount > 0 ? Math.round((actual / item.planned_amount) * 100) : 0
    return { ...item, actual, pct }
  })

  return Response.json({ budget, items })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { month, year, copy_from, items: itemsInput, total_income_expected } = body

  if (!month || !year) return Response.json({ error: 'month and year are required.' }, { status: 400 })

  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('household_id', member.household_id)
    .eq('month', month)
    .eq('year', year)
    .eq('is_template', false)
    .maybeSingle()

  if (existing) return Response.json({ error: 'Budget already exists for this month.' }, { status: 409 })

  const { data: budget, error: budgetErr } = await supabase
    .from('budgets')
    .insert({
      household_id: member.household_id,
      month,
      year,
      total_income_expected: total_income_expected ?? null,
      is_template: false,
    })
    .select()
    .single()

  if (budgetErr || !budget) {
    return Response.json({ error: budgetErr?.message ?? 'Failed to create budget.' }, { status: 500 })
  }

  if (copy_from) {
    const { data: sourceBudget } = await supabase
      .from('budgets')
      .select('id')
      .eq('id', copy_from)
      .eq('household_id', member.household_id)
      .maybeSingle()

    if (sourceBudget) {
      const { data: sourceItems } = await supabase
        .from('budget_items')
        .select('category_id, planned_amount, sort_order')
        .eq('budget_id', copy_from)

      if (sourceItems && sourceItems.length > 0) {
        await supabase
          .from('budget_items')
          .insert(sourceItems.map((si) => ({ ...si, budget_id: budget.id })))
      }
    }
  } else if (Array.isArray(itemsInput) && itemsInput.length > 0) {
    await supabase.from('budget_items').insert(
      itemsInput.map((item: { category_id: string; planned_amount: number }, idx: number) => ({
        budget_id: budget.id,
        category_id: item.category_id,
        planned_amount: Number(item.planned_amount) || 0,
        sort_order: idx,
      }))
    )
  }

  return Response.json({ budget }, { status: 201 })
}
