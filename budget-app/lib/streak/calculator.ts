import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/create'

function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  return { start, end }
}

export async function evaluateStreak(householdId: string, month: number, year: number) {
  const admin = createAdminClient()

  // Fetch budget total for the month
  const { data: budget } = await admin
    .from('budgets')
    .select('id, budget_items(planned_amount)')
    .eq('household_id', householdId)
    .eq('month', month)
    .eq('year', year)
    .eq('is_template', false)
    .maybeSingle()

  // No budget → skip evaluation without resetting
  if (!budget) return { skipped: true }

  const budgetItems = (budget.budget_items ?? []) as Array<{ planned_amount: number }>
  const totalPlanned = budgetItems.reduce((s, i) => s + i.planned_amount, 0)

  // If no categories budgeted, skip
  if (totalPlanned === 0) return { skipped: true }

  // Fetch actual spending for the month (expenses only, not excluded)
  const { start, end } = monthRange(month, year)
  const { data: txData } = await admin
    .from('transactions')
    .select('amount')
    .eq('household_id', householdId)
    .eq('is_income', false)
    .eq('excluded', false)
    .eq('pending', false)
    .gte('date', start)
    .lt('date', end)

  const totalSpent = (txData ?? []).reduce((s, tx: { amount: number }) => s + tx.amount, 0)

  // Fetch current streak row
  const { data: streakRow } = await admin
    .from('streaks')
    .select('current_streak, longest_streak')
    .eq('household_id', householdId)
    .single()

  const current = streakRow?.current_streak ?? 0
  const longest = streakRow?.longest_streak ?? 0
  const success = totalSpent <= totalPlanned

  let newCurrent: number
  let newLongest: number
  const now = new Date().toISOString()

  if (success) {
    newCurrent = current + 1
    newLongest = Math.max(newCurrent, longest)

    await admin.from('streaks').upsert({
      household_id: householdId,
      current_streak: newCurrent,
      longest_streak: newLongest,
      last_evaluated_month: month,
      last_evaluated_year: year,
      last_success_at: now,
      updated_at: now,
    })

    await createNotification({
      householdId,
      type: 'streak_update',
      title: newCurrent === 1 ? 'Streak started! 🔥' : `${newCurrent} Month Streak! 🔥`,
      body:
        newCurrent === 1
          ? 'You stayed within budget this month. Keep it up!'
          : `You've stayed within budget for ${newCurrent} months in a row!`,
      metadata: { month, year, current_streak: newCurrent, longest_streak: newLongest },
    })
  } else {
    newCurrent = 0
    newLongest = longest

    await admin.from('streaks').upsert({
      household_id: householdId,
      current_streak: 0,
      longest_streak: longest,
      last_evaluated_month: month,
      last_evaluated_year: year,
      last_reset_at: now,
      updated_at: now,
    })

    await createNotification({
      householdId,
      type: 'streak_update',
      title: 'Budget exceeded — streak reset',
      body: `You went over budget in ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}. Start fresh this month!`,
      metadata: { month, year, total_spent: totalSpent, total_planned: totalPlanned },
    })
  }

  return { success, totalSpent, totalPlanned, newCurrent, newLongest }
}
