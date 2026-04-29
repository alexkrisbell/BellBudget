import { createClient, createAdminClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import { CountryCode, Products } from 'plaid'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Check if this is a re-auth request for an existing item
    let body: { item_id?: string } = {}
    try { body = await request.json() } catch { /* empty body is fine */ }

    if (body.item_id) {
      // Update mode: fetch the access token for the existing item
      const admin = createAdminClient()
      const { data: item } = await admin
        .from('plaid_items')
        .select('access_token_vault_id, household_id')
        .eq('id', body.item_id)
        .single()
      if (!item) return Response.json({ error: 'Item not found.' }, { status: 404 })

      const { data: accessToken } = await admin.rpc('vault_get_plaid_token', {
        p_secret_id: item.access_token_vault_id,
      })
      if (!accessToken) return Response.json({ error: 'Failed to retrieve token.' }, { status: 500 })

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: user.id },
        client_name: 'Budget App',
        access_token: accessToken as string,
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: appUrl ? `${appUrl}/api/plaid/webhook` : undefined,
      })
      return Response.json({ link_token: response.data.link_token })
    }

    // New connection
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const redirectUri = appUrl ? `${appUrl}/plaid-oauth` : undefined
    console.log('[create-link-token] env:', process.env.PLAID_ENV, 'redirect_uri:', redirectUri)
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Budget App',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      redirect_uri: redirectUri,
      webhook: appUrl ? `${appUrl}/api/plaid/webhook` : undefined,
    })
    return Response.json({ link_token: response.data.link_token })
  } catch (err: unknown) {
    const plaidMsg =
      (err as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message
    const message = plaidMsg ?? (err instanceof Error ? err.message : 'Failed to create link token.')
    console.error('Plaid link token error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
