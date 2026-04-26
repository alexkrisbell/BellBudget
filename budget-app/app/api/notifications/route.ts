import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('household_id', member.household_id)
    .is('read_at', null)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(20)

  const list = (notifications ?? []) as Notification[]
  return Response.json({ notifications: list, unread_count: list.length })
}
