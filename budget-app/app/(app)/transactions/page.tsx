import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TransactionsClient } from '@/components/transactions/TransactionsClient'
import type { Account, Category } from '@/types'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .or(`household_id.is.null,household_id.eq.${member.household_id}`)
      .order('sort_order')
      .order('name'),
    supabase
      .from('accounts')
      .select('id, name, type, subtype, household_id, plaid_item_id, plaid_account_id, current_balance, available_balance, balance_updated_at, is_active, created_at')
      .eq('household_id', member.household_id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Transactions</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          View and categorize your spending.
        </p>
      </div>
      <TransactionsClient
        categories={(categories ?? []) as Category[]}
        accounts={(accounts ?? []) as Account[]}
      />
    </div>
  )
}
