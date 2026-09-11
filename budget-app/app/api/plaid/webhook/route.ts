import { createAdminClient } from '@/lib/supabase/server'
import { syncTransactions } from '@/lib/plaid/sync'
import { verifyPlaidWebhook } from '@/lib/plaid/webhookVerification'

export async function POST(request: Request) {
  const rawBody = await request.text()

  try {
    await verifyPlaidWebhook(rawBody, request.headers.get('plaid-verification'))
  } catch (err) {
    console.error('Plaid webhook verification failed:', err)
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const { webhook_type, webhook_code, item_id } = body

  const admin = createAdminClient()

  if (webhook_type === 'TRANSACTIONS') {
    if (
      webhook_code === 'SYNC_UPDATES_AVAILABLE' ||
      webhook_code === 'INITIAL_UPDATE' ||
      webhook_code === 'HISTORICAL_UPDATE'
    ) {
      // Find our internal item by Plaid's item_id
      const { data: plaidItem } = await admin
        .from('plaid_items')
        .select('id')
        .eq('plaid_item_id', item_id)
        .single()

      if (plaidItem) {
        // Non-blocking sync
        syncTransactions(plaidItem.id).catch((err) =>
          console.error('Webhook sync failed for item', plaidItem.id, err)
        )
      }
    }
  }

  if (webhook_type === 'ITEM') {
    if (webhook_code === 'ERROR') {
      const errorCode = body.error?.error_code ?? 'UNKNOWN'
      const requiresReauth = errorCode === 'ITEM_LOGIN_REQUIRED'

      await admin
        .from('plaid_items')
        .update({
          status: requiresReauth ? 'requires_reauth' : 'error',
          error_code: errorCode,
          updated_at: new Date().toISOString(),
        })
        .eq('plaid_item_id', item_id)

      if (requiresReauth) {
        // Create notification for the household
        const { data: plaidItem } = await admin
          .from('plaid_items')
          .select('id, household_id, institution_name')
          .eq('plaid_item_id', item_id)
          .single()

        if (plaidItem) {
          await admin.from('notifications').insert({
            household_id: plaidItem.household_id,
            type: 'item_error',
            title: 'Bank reconnection required',
            body: `Your ${plaidItem.institution_name} connection needs to be re-authenticated. Please reconnect in Settings.`,
            metadata: { plaid_item_id: plaidItem.id, error_code: errorCode },
          })
        }
      }
    }
  }

  return Response.json({ received: true })
}
