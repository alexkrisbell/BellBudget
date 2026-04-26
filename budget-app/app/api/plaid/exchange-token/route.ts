import { createClient, createAdminClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import { syncTransactions } from '@/lib/plaid/sync'

interface ExchangeTokenBody {
  public_token: string
  institution_id: string
  institution_name: string
  accounts: Array<{
    id: string // plaid account id
    name: string
    official_name?: string | null
    type: string
    subtype?: string | null
    balances?: { current?: number | null; available?: number | null }
  }>
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch household
  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return Response.json({ error: 'No household found.' }, { status: 400 })
  }

  const body: ExchangeTokenBody = await request.json()
  const { public_token, institution_id, institution_name, accounts } = body

  if (!public_token || !institution_id || !institution_name) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  try {
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    })
    const { access_token, item_id } = exchangeResponse.data

    const admin = createAdminClient()

    // Store access token in Vault
    const { data: vaultId, error: vaultError } = await admin.rpc('vault_store_plaid_token', {
      p_access_token: access_token,
      p_item_id: item_id,
    })

    if (vaultError || !vaultId) {
      console.error('Vault error:', vaultError)
      return Response.json({ error: 'Failed to securely store access token.' }, { status: 500 })
    }

    // Create plaid_item row
    const { data: plaidItem, error: itemError } = await admin
      .from('plaid_items')
      .insert({
        household_id: member.household_id,
        plaid_item_id: item_id,
        access_token_vault_id: vaultId,
        institution_id,
        institution_name,
        status: 'active',
      })
      .select()
      .single()

    if (itemError || !plaidItem) {
      console.error('plaid_item insert error:', itemError)
      return Response.json({ error: 'Failed to save account connection.' }, { status: 500 })
    }

    // Insert accounts
    const accountRows = accounts.map((acc) => ({
      household_id: member.household_id,
      plaid_item_id: plaidItem.id,
      plaid_account_id: acc.id,
      name: acc.name,
      official_name: acc.official_name ?? null,
      type: acc.type,
      subtype: acc.subtype ?? null,
      current_balance: acc.balances?.current ?? null,
      available_balance: acc.balances?.available ?? null,
      balance_updated_at: acc.balances ? new Date().toISOString() : null,
      is_active: true,
    }))

    const { error: accError } = await admin
      .from('accounts')
      .upsert(accountRows, { onConflict: 'plaid_account_id', ignoreDuplicates: false })

    if (accError) {
      console.error('accounts upsert error:', accError)
    }

    // Trigger initial sync (non-blocking — fire and forget so UI is fast)
    syncTransactions(plaidItem.id).catch((err) =>
      console.error('Initial sync failed for item', plaidItem.id, err)
    )

    return Response.json({ plaid_item_id: plaidItem.id }, { status: 201 })
  } catch (err) {
    console.error('Exchange token error:', err)
    return Response.json({ error: 'Failed to connect account.' }, { status: 500 })
  }
}
