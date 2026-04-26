import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/household/join — accept an invite token
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  // Accept either a full URL (from invite page) or just the token
  let token: string = (body.token ?? '').trim()
  if (token.includes('/')) {
    token = token.split('/').pop() ?? token
  }

  if (!token) {
    return Response.json({ error: 'Invite token is required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, invited_email, expires_at, accepted_at')
    .eq('invite_token', token)
    .single()

  if (!invite) {
    return Response.json({ error: 'Invalid invite token.' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return Response.json({ error: 'This invite has already been used.' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: 'This invite has expired.' }, { status: 410 })
  }

  // Check if user already belongs to a household
  const { data: existing } = await admin
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return Response.json({ error: 'You already belong to a household.' }, { status: 409 })
  }

  // Add member
  const { error: memberError } = await admin
    .from('household_members')
    .insert({ household_id: invite.household_id, user_id: user.id, role: 'member' })

  if (memberError) {
    return Response.json({ error: 'Failed to join household.' }, { status: 500 })
  }

  // Mark invite as accepted
  await admin
    .from('household_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Fetch household info to return
  const { data: household } = await admin
    .from('households')
    .select('id, name')
    .eq('id', invite.household_id)
    .single()

  return Response.json({ household })
}
