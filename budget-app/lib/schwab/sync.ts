import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/create'
import { SCHWAB_API_BASE } from './client'
import { refreshSchwabToken } from './oauth'

type AdminClient = ReturnType<typeof createAdminClient>

interface SchwabAccountNumber {
  accountNumber: string
  hashValue: string
}

interface SchwabPosition {
  instrument?: { symbol?: string; description?: string; assetType?: string }
  longQuantity?: number
  shortQuantity?: number
  marketValue?: number
  averagePrice?: number
}

interface SchwabSecuritiesAccount {
  accountNumber: string
  type?: string
  currentBalances?: { liquidationValue?: number; cashBalance?: number }
  positions?: SchwabPosition[]
}

interface SchwabAccountResponse {
  securitiesAccount: SchwabSecuritiesAccount
}

async function schwabFetch(path: string, accessToken: string): Promise<Response> {
  return fetch(`${SCHWAB_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export interface SchwabSyncResult {
  ok: boolean
  error?: string
}

// Always refreshes before syncing rather than reusing a cached access token —
// Schwab access tokens only live ~30 min so a once-daily cron would find them
// expired anyway, and refreshing on every sync is what keeps the refresh
// token's 7-day window rolling forward indefinitely (see lib/schwab/oauth.ts).
//
// Returns a result instead of throwing/swallowing internally — a previous
// version caught its own errors and just logged them, so every caller
// (including the manual "Sync Now" button) saw a false "success" even when
// the actual holdings fetch/write failed.
export async function syncSchwabHoldings(householdId: string): Promise<SchwabSyncResult> {
  const admin = createAdminClient()

  const { data: connection } = await admin
    .from('brokerage_connections')
    .select('id, refresh_token_vault_id, access_token_vault_id')
    .eq('household_id', householdId)
    .eq('provider', 'schwab')
    .single()
  if (!connection) return { ok: false, error: 'No Schwab connection found.' }

  const { data: refreshToken } = await admin.rpc('vault_get_schwab_token', {
    p_secret_id: connection.refresh_token_vault_id,
  })
  if (!refreshToken) return { ok: false, error: 'Could not retrieve the stored refresh token.' }

  let accessToken: string
  try {
    const tokens = await refreshSchwabToken(refreshToken as string)
    accessToken = tokens.access_token

    await admin.rpc('vault_update_schwab_token', {
      p_secret_id: connection.access_token_vault_id,
      p_token: tokens.access_token,
    })
    await admin.rpc('vault_update_schwab_token', {
      p_secret_id: connection.refresh_token_vault_id,
      p_token: tokens.refresh_token,
    })

    const now = Date.now()
    await admin
      .from('brokerage_connections')
      .update({
        access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed.'
    console.error(`[syncSchwabHoldings] refresh failed for household ${householdId}:`, err)
    await handleRefreshFailure(admin, householdId, connection.id)
    return { ok: false, error: message }
  }

  try {
    await fetchAndStoreHoldings(admin, householdId, connection.id, accessToken)
    await admin
      .from('brokerage_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Holdings fetch failed.'
    console.error(`[syncSchwabHoldings] holdings fetch failed for household ${householdId}:`, err)
    return { ok: false, error: message }
  }
}

async function handleRefreshFailure(admin: AdminClient, householdId: string, connectionId: string): Promise<void> {
  const { data: connection } = await admin
    .from('brokerage_connections')
    .select('refresh_token_expires_at, status')
    .eq('id', connectionId)
    .single()
  if (!connection) return

  const expiresAt = new Date(connection.refresh_token_expires_at).getTime()
  const daysUntilExpiry = (expiresAt - Date.now()) / (24 * 60 * 60 * 1000)

  // Refresh can fail transiently (Schwab downtime, a network blip) — only
  // surface a reconnect prompt once the 7-day window is genuinely at risk,
  // not on the first failed attempt.
  if (daysUntilExpiry > 2 && connection.status === 'active') return

  await admin
    .from('brokerage_connections')
    .update({ status: 'requires_reauth', updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (connection.status !== 'requires_reauth') {
    await createNotification({
      householdId,
      type: 'schwab_reconnect_required',
      title: 'Reconnect Schwab',
      body: 'Your Schwab connection needs to be reconnected before it expires.',
    })
  }
}

async function fetchAndStoreHoldings(
  admin: AdminClient,
  householdId: string,
  connectionId: string,
  accessToken: string
): Promise<void> {
  const numbersRes = await schwabFetch('/accounts/accountNumbers', accessToken)
  if (!numbersRes.ok) throw new Error(`accountNumbers fetch failed: ${numbersRes.status}`)
  const accountNumbers: SchwabAccountNumber[] = await numbersRes.json()

  const accountsRes = await schwabFetch('/accounts?fields=positions', accessToken)
  if (!accountsRes.ok) throw new Error(`accounts fetch failed: ${accountsRes.status}`)
  const accountsData: SchwabAccountResponse[] = await accountsRes.json()

  const today = new Date().toISOString().slice(0, 10)

  for (const { securitiesAccount } of accountsData) {
    const hashValue = accountNumbers.find(
      (a) => a.accountNumber === securitiesAccount.accountNumber
    )?.hashValue ?? securitiesAccount.accountNumber
    const last4 = securitiesAccount.accountNumber
      ? securitiesAccount.accountNumber.slice(-4)
      : null

    // market_value here is Schwab's liquidationValue — the account's TOTAL
    // value, cash included — not just the securities portion. cash_balance
    // is a subset of it, stored separately for display ("$X in cash of $Y
    // total"), never to be added on top of market_value.
    const totalValue = securitiesAccount.currentBalances?.liquidationValue ?? null

    const { data: investmentAccount, error: accountError } = await admin
      .from('investment_accounts')
      .upsert(
        {
          household_id: householdId,
          brokerage_connection_id: connectionId,
          schwab_account_id: hashValue,
          last4,
          account_type: securitiesAccount.type ?? null,
          cash_balance: securitiesAccount.currentBalances?.cashBalance ?? null,
          market_value: totalValue,
          balance_updated_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: 'schwab_account_id' }
      )
      .select('id')
      .single()
    if (accountError) throw new Error(`investment_accounts upsert failed: ${accountError.message}`)
    if (!investmentAccount) continue

    if (totalValue != null) {
      const { error: snapshotError } = await admin
        .from('investment_account_balance_snapshots')
        .upsert(
          { investment_account_id: investmentAccount.id, household_id: householdId, date: today, balance: totalValue },
          { onConflict: 'investment_account_id,date' }
        )
      if (snapshotError) throw new Error(`investment_account_balance_snapshots upsert failed: ${snapshotError.message}`)
    }

    const holdingRows = (securitiesAccount.positions ?? [])
      .filter((p) => p.instrument?.symbol)
      .map((p) => ({
        household_id: householdId,
        investment_account_id: investmentAccount.id,
        symbol: p.instrument!.symbol!,
        description: p.instrument?.description ?? null,
        asset_type: p.instrument?.assetType ?? null,
        quantity: (p.longQuantity ?? 0) - (p.shortQuantity ?? 0),
        market_value: p.marketValue ?? 0,
        cost_basis: p.averagePrice != null && p.longQuantity != null
          ? p.averagePrice * p.longQuantity
          : null,
        date: today,
      }))

    if (holdingRows.length > 0) {
      const { error: holdingsError } = await admin
        .from('investment_holdings')
        .upsert(holdingRows, { onConflict: 'investment_account_id,symbol,date' })
      if (holdingsError) throw new Error(`investment_holdings upsert failed: ${holdingsError.message}`)
    }
  }
}
