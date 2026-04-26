import { createAdminClient } from '@/lib/supabase/server'
import { syncTransactions } from '@/lib/plaid/sync'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: items } = await admin
    .from('plaid_items')
    .select('id')
    .eq('status', 'active')

  if (!items || items.length === 0) {
    return Response.json({ message: 'No active items to sync.' })
  }

  const results = await Promise.allSettled(
    items.map((item: { id: string }) => syncTransactions(item.id))
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return Response.json({ synced: succeeded, failed, total: items.length })
}
