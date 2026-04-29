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

    // Check if this exact Plaid item is already stored (e.g. duplicate click).
    // Dedup on plaid_item_id (not institution_id) so that two household members
    // can each connect their own accounts at the same bank.
    const { data: existingItem } = await admin
      .from('plaid_items')
      .select('id, access_token_vault_id')
      .eq('household_id', member.household_id)
      .eq('plaid_item_id', item_id)
      .neq('status', 'inactive')
      .maybeSingle()

    let plaidItemId: string

    if (existingItem) {
      // Update the vault with the new access token (handles re-auth and accidental re-connects)
      await admin.rpc('vault_update_plaid_token', {
        p_secret_id: existingItem.access_token_vault_id,
        p_access_token: access_token,
      })

      // Refresh the plaid_item row: new item_id, active status, reset cursor so we
      // re-fetch any transactions missed during a re-auth gap
      await admin
        .from('plaid_items')
        .update({
          plaid_item_id: item_id,
          institution_name,
          status: 'active',
          cursor: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id)

      // Upsert accounts under the existing plaid_item
      const accountRows = accounts.map((acc) => ({
        household_id: member.household_id,
        plaid_item_id: existingItem.id,
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

      await admin
        .from('accounts')
        .upsert(accountRows, { onConflict: 'plaid_account_id', ignoreDuplicates: false })

      plaidItemId = existingItem.id
    } else {
      // First time connecting this institution — store token and create new plaid_item
      const { data: vaultId, error: vaultError } = await admin.rpc('vault_store_plaid_token', {
        p_access_token: access_token,
        p_item_id: item_id,
      })

      if (vaultError || !vaultId) {
        console.error('Vault error:', vaultError)
        return Response.json({ error: 'Failed to securely store access token.' }, { status: 500 })
      }

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

      plaidItemId = plaidItem.id
    }

    // Trigger sync (non-blocking)
    syncTransactions(plaidItemId).catch((err) =>
      console.error('Sync failed for item', plaidItemId, err)
    )

    return Response.json({ plaid_item_id: plaidItemId }, { status: existingItem ? 200 : 201 })
  } catch (err) {
    console.error('Exchange token error:', err)
    return Response.json({ error: 'Failed to connect account.' }, { status: 500 })
  }
}
