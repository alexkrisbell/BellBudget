import { createClient, createAdminClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return Response.json({ error: 'No household.' }, { status: 400 })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  if (!appUrl) return Response.json({ error: 'APP_URL not configured.' }, { status: 500 })

  const webhookUrl = `${appUrl}/api/plaid/webhook`

  const admin = createAdminClient()
  const { data: items } = await admin
    .from('plaid_items')
    .select('id, plaid_item_id, access_token_vault_id, institution_name')
    .eq('household_id', member.household_id)
    .eq('status', 'active')

  if (!items || items.length === 0) {
    return Response.json({ registered: 0, message: 'No active items.' })
  }

  let registered = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      const { data: accessToken } = await admin.rpc('vault_get_plaid_token', {
        p_secret_id: item.access_token_vault_id,
      })
      if (!accessToken) {
        errors.push(`${item.institution_name}: failed to retrieve access token`)
        continue
      }

      await plaidClient.itemWebhookUpdate({
        access_token: accessToken as string,
        webhook: webhookUrl,
      })
      registered++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${item.institution_name}: ${msg}`)
    }
  }

  return Response.json({ registered, total: items.length, webhook_url: webhookUrl, errors })
}
