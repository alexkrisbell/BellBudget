import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

// Best-effort on the Vault side, same pattern as removePlaidItem — Schwab has
// no server-side token revocation endpoint, so this just cleans up locally.
export async function removeSchwabConnection(admin: AdminClient, connectionId: string): Promise<void> {
  const { data: connection } = await admin
    .from('brokerage_connections')
    .select('access_token_vault_id, refresh_token_vault_id')
    .eq('id', connectionId)
    .single()
  if (!connection) return

  try {
    await admin.rpc('vault_delete_schwab_token', { p_secret_id: connection.access_token_vault_id })
    await admin.rpc('vault_delete_schwab_token', { p_secret_id: connection.refresh_token_vault_id })
  } catch (err) {
    console.error(`[removeSchwabConnection] Vault cleanup failed for ${connectionId}:`, err)
  }

  await admin.from('brokerage_connections').delete().eq('id', connectionId)
}
