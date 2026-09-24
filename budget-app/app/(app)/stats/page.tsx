import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchStatsRawData, computeStatsData } from '@/lib/stats/compute'
import { fetchNetWorthRawData, computeNetWorthData } from '@/lib/netWorth/compute'
import { fetchRecurringBillsRawData, detectRecurringBills } from '@/lib/recurringBills/detect'
import { fetchInvestmentsRawData, computeInvestmentsData } from '@/lib/investments/compute'
import { StatsClient } from '@/components/stats/StatsClient'
import { RecurringBillsCard } from '@/components/shared/RecurringBillsCard'
import { HoldingsCard } from '@/components/investments/HoldingsCard'

const ALLOWED_MONTHS = [3, 6, 12]

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  const { months: monthsRaw } = await searchParams
  const monthsParam = parseInt(Array.isArray(monthsRaw) ? monthsRaw[0] : monthsRaw ?? '6', 10)
  const months = ALLOWED_MONTHS.includes(monthsParam) ? monthsParam : 6

  const [statsRaw, netWorthRaw, recurringBillsRaw, investmentsRaw] = await Promise.all([
    fetchStatsRawData({ supabase, householdId: member.household_id, monthsBack: months }),
    fetchNetWorthRawData({ supabase, householdId: member.household_id, monthsBack: months }),
    fetchRecurringBillsRawData({ supabase, householdId: member.household_id }),
    fetchInvestmentsRawData({ supabase, householdId: member.household_id }),
  ])
  const initialData = computeStatsData(statsRaw, months)
  const initialNetWorth = computeNetWorthData(netWorthRaw)
  const recurringBills = detectRecurringBills(recurringBillsRaw)
  const investmentAccounts = computeInvestmentsData(investmentsRaw)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Stats</h2>
        <p className="text-sm text-slate-500 mt-0.5">Net worth, savings, and investments over time.</p>
      </div>
      <Suspense>
        <StatsClient
          initialData={initialData}
          initialNetWorth={initialNetWorth}
          initialMonths={months}
        />
      </Suspense>
      <HoldingsCard accounts={investmentAccounts} />
      <RecurringBillsCard bills={recurringBills} />
    </div>
  )
}
