import { createAdminClient } from '@/lib/supabase/server'
import { syncTransactions } from '@/lib/plaid/sync'
import { syncSchwabHoldings } from '@/lib/schwab/sync'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const [{ data: items }, { data: connections }] = await Promise.all([
    admin.from('plaid_items').select('id').eq('status', 'active'),
    admin.from('brokerage_connections').select('household_id').neq('status', 'requires_reauth'),
  ])

  const plaidResults = items && items.length > 0
    ? await Promise.allSettled(items.map((item: { id: string }) => syncTransactions(item.id)))
    : []

  // Schwab's refresh token rotates and resets its 7-day expiry on every use,
  // so running this in the same daily cron as Plaid is what keeps the
  // connection alive indefinitely without the user re-authenticating.
  const schwabResults = connections && connections.length > 0
    ? await Promise.allSettled(
        connections.map((c: { household_id: string }) => syncSchwabHoldings(c.household_id))
      )
    : []

  return Response.json({
    plaid: {
      synced: plaidResults.filter((r) => r.status === 'fulfilled').length,
      failed: plaidResults.filter((r) => r.status === 'rejected').length,
      total: items?.length ?? 0,
    },
    schwab: {
      synced: schwabResults.filter((r) => r.status === 'fulfilled').length,
      failed: schwabResults.filter((r) => r.status === 'rejected').length,
      total: connections?.length ?? 0,
    },
  })
}
