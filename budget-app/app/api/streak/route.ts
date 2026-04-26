import { createClient } from '@/lib/supabase/server'
import type { StreakResponse } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const [{ data: streak }, { data: budget }, { data: txData }] = await Promise.all([
    supabase
      .from('streaks')
      .select('current_streak, longest_streak, last_success_at')
      .eq('household_id', member.household_id)
      .maybeSingle(),
    supabase
      .from('budgets')
      .select('budget_items(planned_amount)')
      .eq('household_id', member.household_id)
      .eq('month', month)
      .eq('year', year)
      .eq('is_template', false)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('amount')
      .eq('household_id', member.household_id)
      .eq('is_income', false)
      .eq('excluded', false)
      .eq('pending', false)
      .gte('date', start)
      .lt('date', end),
  ])

  const budgetItems = (budget?.budget_items ?? []) as Array<{ planned_amount: number }>
  const totalPlanned = budgetItems.reduce((s, i) => s + i.planned_amount, 0)
  const totalSpent = (txData ?? []).reduce((s, tx: { amount: number }) => s + tx.amount, 0)
  const on_track_this_month = totalPlanned === 0 || totalSpent <= totalPlanned

  const response: StreakResponse = {
    current: streak?.current_streak ?? 0,
    longest: streak?.longest_streak ?? 0,
    last_success_at: streak?.last_success_at ?? null,
    on_track_this_month,
  }

  return Response.json(response)
}
