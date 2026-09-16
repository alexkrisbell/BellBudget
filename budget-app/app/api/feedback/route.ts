import { createClient, createAdminClient } from '@/lib/supabase/server'

const MAX_MESSAGE_LENGTH = 4000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const pagePath = typeof body.page_path === 'string' ? body.page_path.slice(0, 200) : null

  if (!message) {
    return Response.json({ error: 'Please enter a message.' }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: 'Message is too long.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('feedback').insert({
    household_id: member?.household_id ?? null,
    user_id: user.id,
    message,
    page_path: pagePath,
  })
  if (error) return Response.json({ error: 'Failed to send feedback.' }, { status: 500 })

  return Response.json({ ok: true }, { status: 201 })
}
