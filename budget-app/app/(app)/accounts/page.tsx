import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountCard } from '@/components/accounts/AccountCard'
import { PlaidLinkButton } from '@/components/accounts/PlaidLinkButton'
import { SyncButton } from '@/components/accounts/SyncButton'
import type { Account, PlaidItem } from '@/types'

interface AccountGroup {
  item: PlaidItem
  accounts: Account[]
  memberName: string | null
  txCount: number
}

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

  const [
    { data: plaidItems },
    { data: accounts },
    { data: householdMembers },
    { data: txCounts },
  ] = await Promise.all([
    supabase
      .from('plaid_items')
      .select('*')
      .eq('household_id', member.household_id)
      .neq('status', 'inactive')
      .order('created_at', { ascending: true }),
    supabase
      .from('accounts')
      .select('*')
      .eq('household_id', member.household_id)
      .eq('is_active', true)
      .order('name'),
    // Get all household members with their names
    supabase
      .from('household_members')
      .select('user_id, users(full_name)')
      .eq('household_id', member.household_id),
    // Count transactions per account so we can show sync status
    supabase
      .from('transactions')
      .select('account_id')
      .eq('household_id', member.household_id)
      .eq('excluded', false),
  ])

  // Build member name lookup
  const memberNameById: Record<string, string> = {}
  for (const m of householdMembers ?? []) {
    const name = (m.users as unknown as { full_name: string } | null)?.full_name
    if (name) memberNameById[m.user_id] = name
  }

  // Count transactions per account_id
  const txCountByAccountId: Record<string, number> = {}
  for (const tx of txCounts ?? []) {
    if (tx.account_id) {
      txCountByAccountId[tx.account_id] = (txCountByAccountId[tx.account_id] ?? 0) + 1
    }
  }

  // Group accounts by plaid_item_id
  const accountsByItem = (accounts ?? []).reduce(
    (map: Record<string, Account[]>, acc: Account) => {
      if (!map[acc.plaid_item_id]) map[acc.plaid_item_id] = []
      map[acc.plaid_item_id].push(acc)
      return map
    },
    {}
  )

  const groups: AccountGroup[] = (plaidItems ?? []).map((item: PlaidItem) => {
    const itemAccounts = accountsByItem[item.id] ?? []
    const txCount = itemAccounts.reduce((sum: number, acc: Account) => sum + (txCountByAccountId[acc.id] ?? 0), 0)
    return {
      item,
      accounts: itemAccounts,
      memberName: item.connected_by_user_id ? (memberNameById[item.connected_by_user_id] ?? null) : null,
      txCount,
    }
  })

  // Group by member so Alex's cards are under one section, Sarah's under another
  const byMember: Record<string, AccountGroup[]> = {}
  const unassigned: AccountGroup[] = []
  for (const group of groups) {
    if (group.memberName) {
      if (!byMember[group.memberName]) byMember[group.memberName] = []
      byMember[group.memberName].push(group)
    } else {
      unassigned.push(group)
    }
  }

  const memberSections = Object.entries(byMember)
  const hasGrouping = memberSections.length > 0 || unassigned.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Connected Accounts</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your bank and credit card connections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <PlaidLinkButton />
        </div>
      </div>

      {!hasGrouping ? (
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
        <div className="space-y-8">
          {memberSections.map(([name, memberGroups]) => (
            <div key={name}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {name}&apos;s Accounts
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {memberGroups.map((group) => (
                  <AccountCard key={group.item.id} group={group} txCount={group.txCount} />
                ))}
              </div>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div>
              {memberSections.length > 0 && (
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Other Accounts
                </h3>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {unassigned.map((group) => (
                  <AccountCard key={group.item.id} group={group} txCount={group.txCount} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
