import { createClient } from '@/lib/supabase/server'
import { fetchStatsRawData, computeStatsData } from '@/lib/stats/compute'

const ALLOWED_MONTHS = [3, 6, 12]

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
  const monthsParam = parseInt(searchParams.get('months') ?? '6', 10)
  const monthsBack = ALLOWED_MONTHS.includes(monthsParam) ? monthsParam : 6

  const raw = await fetchStatsRawData({ supabase, householdId: member.household_id, monthsBack })
  const data = computeStatsData(raw, monthsBack)

  return Response.json(data)
}
