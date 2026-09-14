import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

// Guardrails against runaway Plaid Item creation (each Item is a recurring
// per-month cost on a paid plan) — either from abuse or from a bug that
// lets someone connect the same handful of accounts over and over.
export const MAX_ACTIVE_ITEMS_PER_HOUSEHOLD = 8
const MAX_NEW_CONNECTIONS_PER_WINDOW = 3
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

export class ConnectionLimitError extends Error {}

// Call before creating a new Plaid Item (i.e. before linkTokenCreate for a
// brand-new connection, and again before itemPublicTokenExchange) — not for
// update-mode/re-auth of an existing Item, which doesn't create a new one.
export async function assertCanConnectNewAccount(
  admin: AdminClient,
  householdId: string
): Promise<void> {
  const { count: activeCount } = await admin
    .from('plaid_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .neq('status', 'inactive')

  if ((activeCount ?? 0) >= MAX_ACTIVE_ITEMS_PER_HOUSEHOLD) {
    throw new ConnectionLimitError(
      `Your household has reached the limit of ${MAX_ACTIVE_ITEMS_PER_HOUSEHOLD} connected accounts. Disconnect one in Settings before adding another.`
    )
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count: recentCount } = await admin
    .from('plaid_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .gte('created_at', since)

  if ((recentCount ?? 0) >= MAX_NEW_CONNECTIONS_PER_WINDOW) {
    throw new ConnectionLimitError(
      'Too many new accounts connected in the last 24 hours. Please wait before connecting another.'
    )
  }
}
