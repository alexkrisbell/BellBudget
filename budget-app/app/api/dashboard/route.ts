import { createClient } from '@/lib/supabase/server'
import { fetchDashboardRawData, computeDashboardData } from '@/lib/dashboard/compute'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10)

  const raw = await fetchDashboardRawData({
    supabase,
    householdId: member.household_id,
    userId: user.id,
    month,
    year,
  })
  const data = computeDashboardData(raw)

  return Response.json(data)
}
