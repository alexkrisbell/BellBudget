import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : '📦'
  const color = typeof body.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : '#6B7280'
  const isIncome = body.is_income === true

  if (!name) return Response.json({ error: 'Category name is required.' }, { status: 400 })
  if (name.length > 40) return Response.json({ error: 'Category name is too long.' }, { status: 400 })

  // RLS (categories_insert) enforces household scoping and is_system = false
  // on its own — this write uses the user-scoped client, not the admin one.
  const { data: category, error } = await supabase
    .from('categories')
    .insert({
      household_id: member.household_id,
      name,
      icon,
      color,
      is_income: isIncome,
      is_system: false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A category with that name already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ category }, { status: 201 })
}
