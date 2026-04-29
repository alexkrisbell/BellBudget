import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check via user client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : null
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 })

  // accounts table has no UPDATE RLS policy (writes are service-role only)
  const admin = createAdminClient()
  const { error } = await admin
    .from('accounts')
    .update({ name })
    .eq('id', id)
    .eq('household_id', member.household_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
