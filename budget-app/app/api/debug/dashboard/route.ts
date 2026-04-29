import { createClient } from '@/lib/supabase/server'

// Dev-only endpoint to inspect net-math data state.
// Hit /api/debug/dashboard?month=4&year=2026 to see what's in the DB.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production.' }, { status: 403 })
  }

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
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data: allTxs } = await supabase
    .from('transactions')
    .select('id, merchant_name, description, amount, is_income, excluded, pending, category_id, category:categories(name, is_income)')
    .eq('household_id', member.household_id)
    .gte('date', start)
    .lt('date', end)
    .order('date', { ascending: false })

  const txList = (allTxs ?? []).filter((tx) => !tx.excluded && !tx.pending)
  const incomeTxs = txList.filter((tx) => tx.is_income)
  const incomeInExpenseCategory = incomeTxs.filter((tx) => {
    const cat = tx.category as { name: string; is_income: boolean } | null
    return cat && !cat.is_income
  })

  const actualByCategory: Record<string, number> = {}
  for (const tx of txList) {
    if (tx.category_id) {
      actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount
    }
  }

  return Response.json({
    month,
    year,
    total_txs: allTxs?.length ?? 0,
    excluded_count: (allTxs ?? []).filter((tx) => tx.excluded).length,
    pending_count: (allTxs ?? []).filter((tx) => tx.pending).length,
    active_tx_count: txList.length,
    income_tx_count: incomeTxs.length,
    income_in_expense_category: incomeInExpenseCategory.map((tx) => ({
      id: tx.id,
      merchant: tx.merchant_name ?? tx.description,
      amount: tx.amount,
      category: (tx.category as { name: string } | null)?.name,
    })),
    net_actual_by_category: actualByCategory,
  })
}
