import { createClient, createAdminClient } from '@/lib/supabase/server'
import { syncTransactions } from '@/lib/plaid/sync'

// Rate limiting: one manual sync per household per 5 minutes
const lastSyncTime = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return Response.json({ error: 'No household found.' }, { status: 400 })
  }

  // Rate limit check
  const now = Date.now()
  const last = lastSyncTime.get(member.household_id) ?? 0
  if (now - last < RATE_LIMIT_MS) {
    const waitSecs = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000)
    return Response.json(
      { error: `Please wait ${waitSecs}s before syncing again.` },
      { status: 429 }
    )
  }
  lastSyncTime.set(member.household_id, now)

  const body = await request.json().catch(() => ({}))
  const specificItemId = body?.item_id as string | undefined
  const force = body?.force === true

  const admin = createAdminClient()
  let query = admin
    .from('plaid_items')
    .select('id')
    .eq('household_id', member.household_id)
    .eq('status', 'active')

  if (specificItemId) {
    query = query.eq('id', specificItemId) as typeof query
  }

  const { data: items } = await query

  // Force mode: reset all cursors so Plaid re-sends everything from the beginning.
  // Safe because the upsert uses ignoreDuplicates so existing rows are untouched.
  if (force && items && items.length > 0) {
    const ids = items.map((i: { id: string }) => i.id)
    await admin.from('plaid_items').update({ cursor: null }).in('id', ids)
  }

  if (!items || items.length === 0) {
    return Response.json({ message: 'No active accounts to sync.' })
  }

  const results = await Promise.allSettled(
    items.map((item: { id: string }) => syncTransactions(item.id))
  )

  const totals = results.reduce(
    (acc, r) => {
      if (r.status === 'fulfilled') {
        acc.added += r.value.added
        acc.modified += r.value.modified
        acc.removed += r.value.removed
      }
      return acc
    },
    { added: 0, modified: 0, removed: 0 }
  )

  return Response.json(totals)
}
