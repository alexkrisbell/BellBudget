import { createClient, createAdminClient } from '@/lib/supabase/server'
import { removeSchwabConnection } from '@/lib/schwab/disconnect'

async function getHouseholdId(): Promise<{ householdId: string } | { error: Response }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return { error: Response.json({ error: 'No household.' }, { status: 400 }) }

  return { householdId: member.household_id }
}

export async function GET() {
  const result = await getHouseholdId()
  if ('error' in result) return result.error

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('brokerage_connections')
    .select('id, status, last_synced_at, created_at')
    .eq('household_id', result.householdId)
    .eq('provider', 'schwab')
    .maybeSingle()

  return Response.json({ connection })
}

export async function DELETE() {
  const result = await getHouseholdId()
  if ('error' in result) return result.error

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('brokerage_connections')
    .select('id')
    .eq('household_id', result.householdId)
    .eq('provider', 'schwab')
    .maybeSingle()
  if (!connection) return Response.json({ error: 'No Schwab connection found.' }, { status: 404 })

  await removeSchwabConnection(admin, connection.id)

  await admin
    .from('investment_accounts')
    .update({ is_active: false })
    .eq('household_id', result.householdId)

  return Response.json({ ok: true })
}
