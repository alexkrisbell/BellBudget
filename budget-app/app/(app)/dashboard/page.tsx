import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { ConnectAccountsPrompt } from '@/components/dashboard/ConnectAccountsPrompt'
import { CreateBudgetPrompt } from '@/components/dashboard/CreateBudgetPrompt'
import { fetchDashboardRawData, computeDashboardData } from '@/lib/dashboard/compute'

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

  const [{ count: accountCount }, raw] = await Promise.all([
    supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', member.household_id)
      .eq('is_active', true),
    fetchDashboardRawData({
      supabase,
      householdId: member.household_id,
      userId: user.id,
      month,
      year,
    }),
  ])
  const initialData = computeDashboardData(raw)

  // Guide a brand-new household through the two things that make the app
  // actually work, one at a time, before showing the (otherwise empty) full
  // dashboard — connecting accounts and setting up a budget.
  const needsAccounts = (accountCount ?? 0) === 0
  const needsBudget = !needsAccounts && initialData.categories.length === 0

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your financial snapshot.</p>
      </div>
      {needsAccounts ? (
        <ConnectAccountsPrompt />
      ) : needsBudget ? (
        <CreateBudgetPrompt />
      ) : (
        <DashboardClient initialData={initialData} initialMonth={month} initialYear={year} />
      )}
    </div>
  )
}
