import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchRecurringBillsRawData, detectRecurringBills } from '@/lib/recurringBills/detect'
import { formatCurrency, formatShortDate } from '@/lib/utils'

export default async function BillsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  const raw = await fetchRecurringBillsRawData({ supabase, householdId: member.household_id })
  const bills = detectRecurringBills(raw)
  const monthlyTotal = bills.reduce((s, b) => s + b.averageAmount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Recurring Bills</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Charges detected as roughly monthly, based on the last 6 months of transactions.
        </p>
      </div>

      {bills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-slate-500 font-medium">No recurring bills detected yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Once a charge shows up at a consistent amount roughly every month, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs text-slate-400 mb-0.5">Estimated monthly total</p>
            <p className="text-xl font-semibold text-slate-800">{formatCurrency(monthlyTotal)}/mo</p>
            <p className="text-xs text-slate-400 mt-0.5">across {bills.length} recurring charges</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {bills.map((bill) => (
              <div key={bill.key} className="flex items-center justify-between px-4 py-3.5 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-9 rounded-full flex items-center justify-center shrink-0 text-base"
                    style={{
                      backgroundColor: bill.category?.color ? `${bill.category.color}20` : '#f1f5f9',
                    }}
                  >
                    {bill.category?.icon ?? '🔁'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{bill.label}</p>
                    <p className="text-xs text-slate-400">
                      {bill.occurrences}× seen · next ~{formatShortDate(bill.nextExpectedDate)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0 text-slate-700">
                  {formatCurrency(bill.averageAmount)}/mo
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
