import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/create'
import { classifyTransaction } from '@/lib/investments/classify'
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

// This endpoint's exact response shape is less publicly documented than
// /accounts — treated defensively (optional fields, fallbacks) since it
// wasn't verified against live data before this shipped.
interface SchwabTransaction {
  activityId?: number | string
  time?: string
  tradeDate?: string
  type?: string
  netAmount?: number
  description?: string
  transferItems?: Array<{ instrument?: { symbol?: string } }>
}

async function schwabFetch(path: string, accessToken: string): Promise<Response> {
  return fetch(`${SCHWAB_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export interface SchwabSyncResult {
  ok: boolean
  error?: string
  // Surfaced separately from `ok`/`error` because this endpoint is unverified
  // against live data — a transactions problem shouldn't read as the whole
  // sync failing (holdings/balance sync is proven and shouldn't regress),
  // but it still needs to be visible somewhere other than server logs.
  transactionsDebug?: string[]
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
    const transactionsDebug = await fetchAndStoreHoldings(admin, householdId, connection.id, accessToken)
    await admin
      .from('brokerage_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id)
    return { ok: true, transactionsDebug }
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
): Promise<string[]> {
  const transactionsDebug: string[] = []

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

    // Caught locally rather than propagated: this endpoint is unverified
    // against live data, and a failure here shouldn't regress the holdings/
    // balance sync (which already works) into reporting the whole sync as
    // failed. Collected into transactionsDebug so it's visible in the
    // "Sync Now" UI instead of only in server logs.
    const last4Label = last4 ?? hashValue.slice(-4)
    try {
      const debugLine = await fetchAndStoreTransactions(admin, householdId, investmentAccount.id, hashValue, accessToken)
      transactionsDebug.push(`····${last4Label}: ${debugLine}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      transactionsDebug.push(`····${last4Label}: failed — ${message}`)
      console.error(`[fetchAndStoreHoldings] transactions fetch failed for account ${investmentAccount.id}:`, err)
    }
  }

  return transactionsDebug
}

// Fetches a trailing window on every sync rather than tracking "since last
// sync" — Schwab activity volume for a personal account is low enough that
// re-fetching a 60-day overlap daily is cheap, and the unique constraint on
// (investment_account_id, schwab_activity_id) makes re-fetching the same
// transaction harmless. 60 days is a conservative guess at this endpoint's
// allowed range, not a confirmed Schwab limit — worth widening once real
// data confirms it works.
// A joined multi-value `types=TRADE,DIVIDEND_OR_INTEREST,...` string came
// back with zero results even for an account with a trade confirmed to have
// happened days earlier — suggesting `types` may only accept a single enum
// value at a time rather than a list, not just "unset means match nothing"
// as previously assumed. Querying once per type hedges against that without
// more guessing; the unique constraint on schwab_activity_id makes it safe
// for the same transaction to come back from more than one type's request.
const TRANSACTION_TYPES = [
  'TRADE',
  'RECEIVE_AND_DELIVER',
  'DIVIDEND_OR_INTEREST',
  'ACH_RECEIPT',
  'ACH_DISBURSEMENT',
  'CASH_RECEIPT',
  'CASH_DISBURSEMENT',
  'ELECTRONIC_FUND',
  'WIRE_OUT',
  'WIRE_IN',
  'JOURNAL',
  'MEMORANDUM',
  'MARGIN_CALL',
  'MONEY_MARKET',
  'SMA_ADJUSTMENT',
]

async function fetchAndStoreTransactions(
  admin: AdminClient,
  householdId: string,
  investmentAccountId: string,
  hashValue: string,
  accessToken: string
): Promise<string> {
  const end = new Date()
  const start = new Date(end.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Isolating a variable: hashValue has only ever been proven to work as a
  // matching key inside the bulk /accounts?fields=positions response — the
  // holdings sync never actually puts it in a URL path. This checks whether
  // hashValue works as a path segment for ANY endpoint, to tell apart "the
  // transactions endpoint specifically has a problem" from "hashValue in a
  // path doesn't work at all."
  let singleAccountProbe: string
  try {
    const probeRes = await schwabFetch(`/accounts/${encodeURIComponent(hashValue)}`, accessToken)
    const probeText = await probeRes.text()
    singleAccountProbe = probeRes.ok
      ? `single-account fetch OK (${probeText.length} bytes)`
      : `single-account fetch HTTP ${probeRes.status} — ${probeText.slice(0, 150)}`
  } catch (err) {
    singleAccountProbe = `single-account fetch threw — ${err instanceof Error ? err.message : String(err)}`
  }

  // Parallelized (not a sequential loop) — 15 requests per account run
  // serially would risk the manual "Sync Now" call blowing past Vercel's
  // function timeout.
  const perType = await Promise.all(
    TRANSACTION_TYPES.map(async (type): Promise<{ type: string; parsed: SchwabTransaction[]; issue?: string }> => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        types: type,
      })

      // hashValue is Schwab's "encrypted value" for the account — URL-encoded
      // defensively since it's never been confirmed plain-alphanumeric.
      const res = await schwabFetch(`/accounts/${encodeURIComponent(hashValue)}/transactions?${params.toString()}`, accessToken)
      const rawText = await res.text()
      if (!res.ok) {
        return { type, parsed: [], issue: `HTTP ${res.status} — ${rawText.slice(0, 150)}` }
      }

      let body: unknown
      try {
        body = JSON.parse(rawText)
      } catch {
        return { type, parsed: [], issue: `non-JSON — ${rawText.slice(0, 150)}` }
      }

      const parsed: SchwabTransaction[] = Array.isArray(body)
        ? body
        : Array.isArray((body as { transactions?: unknown })?.transactions)
          ? (body as { transactions: SchwabTransaction[] }).transactions
          : []

      if (!Array.isArray(body) && parsed.length === 0) {
        return { type, parsed: [], issue: `unexpected shape — ${JSON.stringify(body).slice(0, 150)}` }
      }

      return { type, parsed }
    })
  )

  const transactions: SchwabTransaction[] = []
  const issues: string[] = []
  for (const { type, parsed, issue } of perType) {
    if (issue) issues.push(`${type}: ${issue}`)
    transactions.push(...parsed)
  }

  if (transactions.length === 0) {
    const hashInfo = `hashValue len=${hashValue.length}, urlEncoded=${hashValue !== encodeURIComponent(hashValue)}`
    const rangeInfo = `range=${start.toISOString()}..${end.toISOString()}`
    return issues.length > 0
      ? `0 across all types (${hashInfo}, ${rangeInfo}, ${singleAccountProbe}); issues: ${issues.join(' | ')}`
      : `0 across all ${TRANSACTION_TYPES.length} types (${hashInfo}, ${rangeInfo}, ${singleAccountProbe})`
  }

  const rowsByActivityId = new Map<string, ReturnType<typeof buildRow>>()
  function buildRow(t: SchwabTransaction) {
    const rawType = t.type ?? 'UNKNOWN'
    const dateStr = t.tradeDate ?? t.time
    return {
      household_id: householdId,
      investment_account_id: investmentAccountId,
      schwab_activity_id: String(t.activityId),
      type: rawType,
      category: classifyTransaction(rawType),
      symbol: t.transferItems?.[0]?.instrument?.symbol ?? null,
      amount: t.netAmount!,
      description: t.description ?? null,
      transacted_at: dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10),
    }
  }
  // Deduped by activity id — the same transaction could plausibly come back
  // from more than one type's request if Schwab's per-type filter isn't
  // perfectly exclusive, and Postgres upsert errors on a batch that affects
  // the same conflict target twice.
  for (const t of transactions) {
    if (t.activityId == null || t.netAmount == null) continue
    rowsByActivityId.set(String(t.activityId), buildRow(t))
  }
  const rows = [...rowsByActivityId.values()]

  if (rows.length === 0) {
    return `fetched ${transactions.length} but none matched the expected fields — sample: ${JSON.stringify(transactions[0]).slice(0, 200)}`
  }

  const { error } = await admin
    .from('investment_transactions')
    .upsert(rows, { onConflict: 'investment_account_id,schwab_activity_id' })
  if (error) throw new Error(`investment_transactions upsert failed: ${error.message}`)

  return `stored ${rows.length}`
}
