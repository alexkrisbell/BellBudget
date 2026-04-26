import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/household/invite — send an invite to an email address
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) {
    return Response.json({ error: 'Email is required.' }, { status: 400 })
  }

  // Get the user's household (must be a member)
  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return Response.json({ error: 'You do not belong to a household.' }, { status: 403 })
  }

  // Check for existing pending invite to this email
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('household_invites')
    .select('id')
    .eq('household_id', member.household_id)
    .eq('invited_email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existing) {
    return Response.json({ error: 'An active invite for this email already exists.' }, { status: 409 })
  }

  const { data: invite, error } = await admin
    .from('household_invites')
    .insert({
      household_id: member.household_id,
      invited_email: email,
      invited_by: user.id,
    })
    .select('invite_token')
    .single()

  if (error || !invite) {
    return Response.json({ error: 'Failed to create invite.' }, { status: 500 })
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.invite_token}`

  return Response.json({ invite_token: invite.invite_token, invite_url: inviteUrl }, { status: 201 })
}
