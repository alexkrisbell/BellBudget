import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountCard } from '@/components/accounts/AccountCard'
import { PlaidLinkButton } from '@/components/accounts/PlaidLinkButton'
import type { Account, PlaidItem } from '@/types'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/onboarding')

  // Fetch all plaid items for this household (exclude deactivated/superseded connections)
  const { data: plaidItems } = await supabase
    .from('plaid_items')
    .select('*')
    .eq('household_id', member.household_id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })

  // Fetch all accounts grouped by plaid_item
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('household_id', member.household_id)
    .eq('is_active', true)
    .order('name')

  // Group accounts by their plaid_item_id (our internal UUID)
  const accountsByItem = (accounts ?? []).reduce(
    (map: Record<string, Account[]>, acc: Account) => {
      const key = acc.plaid_item_id
      if (!map[key]) map[key] = []
      map[key].push(acc)
      return map
    },
    {}
  )

  const groups = (plaidItems ?? []).map((item: PlaidItem) => ({
    item,
    accounts: accountsByItem[item.id] ?? [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Connected Accounts</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your bank and credit card connections.
          </p>
        </div>
        <PlaidLinkButton />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-slate-500 font-medium">No accounts connected yet.</p>
          <p className="text-sm text-slate-400 mt-1">
            Connect your bank or credit card to start tracking transactions automatically.
          </p>
          <div className="mt-4 flex justify-center">
            <PlaidLinkButton />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <AccountCard key={group.item.id} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
