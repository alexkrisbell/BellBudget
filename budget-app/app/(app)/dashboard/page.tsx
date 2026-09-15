import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { fetchDashboardRawData, computeDashboardData } from '@/lib/dashboard/compute'
import { fetchRecurringBillsRawData, detectRecurringBills } from '@/lib/recurringBills/detect'

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

  const [raw, recurringBillsRaw] = await Promise.all([
    fetchDashboardRawData({
      supabase,
      householdId: member.household_id,
      userId: user.id,
      month,
      year,
    }),
    fetchRecurringBillsRawData({ supabase, householdId: member.household_id }),
  ])
  const initialData = computeDashboardData(raw)
  const recurringBills = detectRecurringBills(recurringBillsRaw)

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your financial snapshot.</p>
      </div>
      <DashboardClient
        initialData={initialData}
        initialMonth={month}
        initialYear={year}
        recurringBills={recurringBills}
      />
    </div>
  )
}
