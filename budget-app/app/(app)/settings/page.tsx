import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HouseholdCard } from '@/components/settings/HouseholdCard'
import { MembersCard } from '@/components/settings/MembersCard'
import { InviteCard } from '@/components/settings/InviteCard'
import { CategoriesCard } from '@/components/settings/CategoriesCard'
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard'
import type { Category } from '@/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role, households(id, name)')
    .eq('user_id', user.id)
    .single()
  if (!member) redirect('/onboarding')

  const [{ data: members }, { data: customCategories }] = await Promise.all([
    supabase
      .from('household_members')
      .select('id, role, joined_at, user:users(id, full_name, email)')
      .eq('household_id', member.household_id)
      .order('joined_at'),
    supabase
      .from('categories')
      .select('*')
      .eq('household_id', member.household_id)
      .eq('is_system', false)
      .order('name'),
  ])

  const household = member.households as unknown as { id: string; name: string }
  const memberList = (members ?? []) as unknown as Array<{
    id: string
    role: string
    joined_at: string
    user: { id: string; full_name: string; email: string } | null
  }>

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage your household and members.</p>
      </div>

      <HouseholdCard
        householdId={household.id}
        initialName={household.name}
      />

      <MembersCard members={memberList} currentUserId={user.id} />

      <InviteCard />

      <CategoriesCard initialCategories={(customCategories ?? []) as Category[]} />

      <DeleteAccountCard
        isLastMember={memberList.length <= 1}
        householdName={household.name}
      />
    </div>
  )
}
