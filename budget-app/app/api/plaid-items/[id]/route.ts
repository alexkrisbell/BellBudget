import { createClient, createAdminClient } from '@/lib/supabase/server'
import { removePlaidItem } from '@/lib/plaid/disconnect'

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

  const body = await request.json()
  const admin = createAdminClient()

  if (body.action === 'disconnect') {
    const { data: item } = await admin
      .from('plaid_items')
      .select('id')
      .eq('id', id)
      .eq('household_id', member.household_id)
      .single()
    if (!item) return Response.json({ error: 'Item not found.' }, { status: 404 })

    await removePlaidItem(admin, item.id)

    const { error } = await admin
      .from('plaid_items')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('household_id', member.household_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const name = typeof body.institution_name === 'string' ? body.institution_name.trim() : null
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 })

  const { error } = await admin
    .from('plaid_items')
    .update({ institution_name: name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', member.household_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
