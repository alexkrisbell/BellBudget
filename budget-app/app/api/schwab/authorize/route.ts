import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSchwabState, getSchwabAuthorizationUrl } from '@/lib/schwab/oauth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const state = createSchwabState(member.household_id)
  return NextResponse.redirect(getSchwabAuthorizationUrl(state))
}
