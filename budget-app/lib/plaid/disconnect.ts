import { plaidClient } from './client'
import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

// Tells Plaid the Item is gone (frees it from the household's/account's
// Item count and stops any future billing for it) and cleans up its Vault
// secret. Best-effort on the Plaid/Vault side — a failure here shouldn't
// block the caller from disconnecting or deleting locally, since the token
// will simply age out on Plaid's side if the remove call fails.
export async function removePlaidItem(admin: AdminClient, plaidItemId: string): Promise<void> {
  const { data: item } = await admin
    .from('plaid_items')
    .select('access_token_vault_id')
    .eq('id', plaidItemId)
    .single()
  if (!item) return

  try {
    const { data: accessToken } = await admin.rpc('vault_get_plaid_token', {
      p_secret_id: item.access_token_vault_id,
    })
    if (accessToken) {
      await plaidClient.itemRemove({ access_token: accessToken as string })
    }
  } catch (err) {
    console.error(`[removePlaidItem] Plaid itemRemove failed for ${plaidItemId}:`, err)
  }

  try {
    await admin.rpc('vault_delete_plaid_token', { p_secret_id: item.access_token_vault_id })
  } catch (err) {
    console.error(`[removePlaidItem] Vault cleanup failed for ${plaidItemId}:`, err)
  }
}
