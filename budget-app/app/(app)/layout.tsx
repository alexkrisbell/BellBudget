import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { HouseholdInitializer } from '@/components/layout/HouseholdInitializer'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check household membership
  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, households(id, name)')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/onboarding')
  }

  // Fetch full user profile for display
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const householdId = member.household_id

  return (
    <div className="flex min-h-screen bg-slate-50">
      <HouseholdInitializer householdId={householdId} />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userFullName={profile?.full_name} householdId={householdId} />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
