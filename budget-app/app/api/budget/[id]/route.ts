import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { items: itemsInput, total_income_expected } = body

  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .eq('household_id', member.household_id)
    .maybeSingle()

  if (!budget) return Response.json({ error: 'Budget not found.' }, { status: 404 })

  if (total_income_expected !== undefined) {
    await supabase
      .from('budgets')
      .update({ total_income_expected, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  if (Array.isArray(itemsInput)) {
    await supabase.from('budget_items').delete().eq('budget_id', id)

    if (itemsInput.length > 0) {
      await supabase.from('budget_items').insert(
        itemsInput.map((item: { category_id: string; planned_amount: number }, idx: number) => ({
          budget_id: id,
          category_id: item.category_id,
          planned_amount: Number(item.planned_amount) || 0,
          sort_order: idx,
        }))
      )
    }
  }

  const { data: updated } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single()

  return Response.json({ budget: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const { id } = await params

  const { data: budget } = await supabase
    .from('budgets')
    .select('id')
    .eq('id', id)
    .eq('household_id', member.household_id)
    .maybeSingle()

  if (!budget) return Response.json({ error: 'Budget not found.' }, { status: 404 })

  await supabase.from('budgets').delete().eq('id', id)

  return new Response(null, { status: 204 })
}
