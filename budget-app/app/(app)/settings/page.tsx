import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HouseholdCard } from '@/components/settings/HouseholdCard'
import { MembersCard } from '@/components/settings/MembersCard'
import { InviteCard } from '@/components/settings/InviteCard'

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

  const { data: members } = await supabase
    .from('household_members')
    .select('id, role, joined_at, user:users(id, full_name, email)')
    .eq('household_id', member.household_id)
    .order('joined_at')

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
    </div>
  )
}
