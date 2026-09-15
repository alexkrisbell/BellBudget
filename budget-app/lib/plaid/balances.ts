import { plaidClient } from './client'
import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

// Refreshes each account's current/available balance from Plaid and records
// a daily snapshot (one row per account per day, upserted so re-syncing the
// same day just updates it) so net worth can be trended over time. Shared by
// the initial connect flow and every subsequent sync so there's one place
// balances get written, not two slightly different copies.
export async function updateAccountBalances(
  admin: AdminClient,
  householdId: string,
  accessToken: string
): Promise<void> {
  const { data: balData } = await plaidClient.accountsGet({ access_token: accessToken })

  const { data: accountRows } = await admin
    .from('accounts')
    .select('id, plaid_account_id')
    .eq('household_id', householdId)

  const accountIdByPlaidId = new Map<string, string>(
    (accountRows ?? []).map((a: { id: string; plaid_account_id: string }) => [a.plaid_account_id, a.id])
  )

  const today = new Date().toISOString().slice(0, 10)

  for (const acc of balData.accounts) {
    const internalId = accountIdByPlaidId.get(acc.account_id)
    if (!internalId) continue

    await admin
      .from('accounts')
      .update({
        current_balance: acc.balances.current ?? null,
        available_balance: acc.balances.available ?? null,
        balance_updated_at: new Date().toISOString(),
      })
      .eq('id', internalId)

    if (acc.balances.current !== null && acc.balances.current !== undefined) {
      await admin.from('account_balance_snapshots').upsert(
        { account_id: internalId, household_id: householdId, date: today, balance: acc.balances.current },
        { onConflict: 'account_id,date' }
      )
    }
  }
}
