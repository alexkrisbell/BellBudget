import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/household — fetch the current user's household + all members
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role, households(id, name, created_by, created_at)')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return Response.json({ household: null })
  }

  const { data: members } = await supabase
    .from('household_members')
    .select('id, role, joined_at, user:users(id, full_name, email)')
    .eq('household_id', member.household_id)
    .order('joined_at')

  return Response.json({
    household: member.households,
    role: member.role,
    members: members ?? [],
  })
}

// PATCH /api/household — rename the household
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const name = (body.name ?? '').trim()
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 })

  const { error } = await supabase
    .from('households')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', member.household_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ name })
}

// POST /api/household — create a new household and add the creator as owner
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const name = (body.name ?? '').trim()
  if (!name) {
    return Response.json({ error: 'Household name is required.' }, { status: 400 })
  }

  // Check if user already belongs to a household
  const { data: existing } = await supabase
    .from('household_members')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return Response.json({ error: 'You already belong to a household.' }, { status: 409 })
  }

  const admin = createAdminClient()

  // Create household
  const { data: household, error: hhError } = await admin
    .from('households')
    .insert({ name, created_by: user.id })
    .select()
    .single()

  if (hhError || !household) {
    return Response.json({ error: 'Failed to create household.' }, { status: 500 })
  }

  // Add creator as owner (service role bypasses RLS)
  const { error: memberError } = await admin
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    return Response.json({ error: 'Failed to add household member.' }, { status: 500 })
  }

  return Response.json({ household }, { status: 201 })
}
