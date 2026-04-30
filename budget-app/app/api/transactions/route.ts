import { createClient } from '@/lib/supabase/server'

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
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const categoryId = searchParams.get('category_id')
  const accountId = searchParams.get('account_id')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
  const offset = (page - 1) * limit
  // When excluded=true, return only hidden transactions so the UI can display a "re-include" list
  const showExcluded = searchParams.get('excluded') === 'true'
  const incomeOnly = searchParams.get('income') === 'true'

  // Date range for the requested month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  let query = supabase
    .from('transactions')
    .select(
      'id, account_id, household_id, plaid_transaction_id, amount, merchant_name, description, date, authorized_date, category_id, categorization_source, user_id, is_income, pending, excluded, notes, created_at, updated_at, category:categories(id,name,color,icon,is_income), account:accounts(id,name,type,subtype)',
      { count: 'exact' }
    )
    .eq('household_id', member.household_id)
    .eq('excluded', showExcluded)
    .eq('pending', false)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (incomeOnly) query = query.eq('is_income', true) as typeof query
  if (categoryId) query = query.eq('category_id', categoryId) as typeof query
  if (accountId) query = query.eq('account_id', accountId) as typeof query

  const { data: transactions, error, count } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    transactions: transactions ?? [],
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > offset + limit,
  })
}
