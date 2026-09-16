import { createClient } from '@/lib/supabase/server'

export async function DELETE(
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

  // RLS (categories_delete) already blocks deleting system categories or
  // another household's categories — the explicit household_id check here
  // is just so a wrong id returns a clear 404 instead of a silent no-op.
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('id', id)
    .eq('household_id', member.household_id)
    .single()
  if (!existing) return Response.json({ error: 'Category not found.' }, { status: 404 })

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    // budget_items/transaction_splits restrict deletion of a category still in use.
    if (error.code === '23503') {
      return Response.json(
        { error: 'This category is still used by a budget or split transaction — remove that first.' },
        { status: 409 }
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
