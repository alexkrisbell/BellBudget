import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  const excluded = Boolean(body.excluded)

  const { error } = await supabase
    .from('transactions')
    .update({ excluded, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', member.household_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ excluded })
}
