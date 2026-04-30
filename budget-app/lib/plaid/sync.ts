import { plaidClient } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { categorizeBatch } from '@/lib/categorization/engine'
import { createNotification } from '@/lib/notifications/create'
import type { RemovedTransaction, Transaction as PlaidTransaction } from 'plaid'

// Internal account transfers (e.g. paying a credit card bill from checking, moving money
// between own accounts) should be excluded — they're not real spending.
// External payments like Zelle to a landlord or utility are real expenses and must NOT
// be excluded, even though Plaid labels them TRANSFER_OUT.
// We distinguish them via the detailed subcategory:
//   TRANSFER_OUT_ACCOUNT_TRANSFER → internal (exclude)
//   TRANSFER_OUT_SAVINGS           → internal (exclude)
//   TRANSFER_OUT_DEPOSIT           → external Zelle/Venmo (keep)
//   TRANSFER_IN_ACCOUNT_TRANSFER   → internal (exclude)
const INTERNAL_TRANSFER_DETAILS = new Set([
  'TRANSFER_OUT_ACCOUNT_TRANSFER',
  'TRANSFER_OUT_SAVINGS',
  'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_IN_ACCOUNT_TRANSFER',
])

function isTransfer(tx: PlaidTransaction): boolean {
  const primary = (tx.personal_finance_category?.primary ?? '').toUpperCase()
  const detailed = (tx.personal_finance_category?.detailed ?? '').toUpperCase()

  if (primary === 'LOAN_PAYMENTS') return true

  // For transfer categories, only exclude internal account-to-account moves
  if (primary === 'TRANSFER_OUT' || primary === 'TRANSFER_IN') {
    // If we have detailed data, use it to decide; otherwise fall back to excluding all transfers
    // so credit card payments aren't double-counted when detailed data is unavailable
    if (detailed) return INTERNAL_TRANSFER_DETAILS.has(detailed)
    return true
  }

  return false
}

// Merchant keyword patterns that should always be excluded regardless of Plaid category.
// These are credit card payments or pass-through charges that would double-count spending.
const ALWAYS_EXCLUDE_KEYWORDS = ['amex epayment', 'amex payment']

function shouldAlwaysExclude(tx: PlaidTransaction): boolean {
  const name = ((tx.merchant_name ?? tx.name) ?? '').toLowerCase()
  return ALWAYS_EXCLUDE_KEYWORDS.some((kw) => name.includes(kw))
}

export interface SyncResult {
  added: number
  modified: number
  removed: number
}

export async function syncTransactions(itemId: string): Promise<SyncResult> {
  const supabase = createAdminClient()

  // Fetch the plaid_item row (includes vault id + cursor)
  const { data: item, error: itemError } = await supabase
    .from('plaid_items')
    .select('id, household_id, plaid_item_id, access_token_vault_id, cursor, status')
    .eq('id', itemId)
    .single()

  if (itemError || !item) throw new Error(`plaid_item not found: ${itemId}`)
  if (item.status === 'requires_reauth') {
    throw new Error(`plaid_item ${itemId} requires re-authentication`)
  }

  // Decrypt access token via vault helper
  const { data: tokenData, error: tokenError } = await supabase.rpc('vault_get_plaid_token', {
    p_secret_id: item.access_token_vault_id,
  })
  if (tokenError || !tokenData) throw new Error('Failed to retrieve Plaid access token from vault')
  const accessToken = tokenData as string

  // Load system categories once (name → id map + income category id set)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .is('household_id', null)
  const categoryByName = new Map<string, string>(
    (categories ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
  )

  // Load accounts for this item once (plaid_account_id → internal id)
  const { data: accountData } = await supabase
    .from('accounts')
    .select('id, plaid_account_id')
    .eq('household_id', item.household_id)
    .eq('is_active', true)
  const accountByPlaidId = new Map<string, string>(
    (accountData ?? []).map((a: { id: string; plaid_account_id: string }) => [a.plaid_account_id, a.id])
  )

  const result: SyncResult = { added: 0, modified: 0, removed: 0 }
  let cursor = item.cursor ?? undefined
  let hasMore = true

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    })
    const data = response.data

    // Process added transactions
    if (data.added.length > 0) {
      const categorizationResults = await categorizeBatch(
        data.added as PlaidTransaction[],
        item.household_id,
        categoryByName
      )

      const rows = (data.added as PlaidTransaction[]).map((tx) => {
        const cat = categorizationResults.get(tx.transaction_id)
        return {
          account_id: accountByPlaidId.get(tx.account_id) ?? null,
          household_id: item.household_id,
          plaid_transaction_id: tx.transaction_id,
          amount: tx.amount,
          merchant_name: tx.merchant_name ?? null,
          description: tx.name,
          date: tx.date,
          authorized_date: tx.authorized_date ?? null,
          category_id: cat?.category_id ?? null,
          categorization_source: cat?.source ?? 'plaid',
          is_income: tx.amount < 0,
          pending: tx.pending,
          excluded: isTransfer(tx) || shouldAlwaysExclude(tx),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      })

      const { error } = await supabase
        .from('transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id', ignoreDuplicates: true })
      if (!error) {
        result.added += rows.length
        await triggerNotifications(supabase, item.household_id, data.added as PlaidTransaction[])
      }
    }

    // Process modified transactions
    for (const tx of data.modified as PlaidTransaction[]) {
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: tx.amount,
          merchant_name: tx.merchant_name ?? null,
          description: tx.name,
          date: tx.date,
          authorized_date: tx.authorized_date ?? null,
          pending: tx.pending,
          updated_at: new Date().toISOString(),
        })
        .eq('plaid_transaction_id', tx.transaction_id)
      if (!error) result.modified++
    }

    // Process removed transactions
    if (data.removed.length > 0) {
      const ids = (data.removed as RemovedTransaction[]).map((r) => r.transaction_id)
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('plaid_transaction_id', ids)
      if (!error) result.removed += ids.length
    }

    cursor = data.next_cursor
    hasMore = data.has_more
  }

  // Refresh live account balances
  try {
    const { data: balData } = await plaidClient.accountsGet({ access_token: accessToken })
    for (const acc of balData.accounts) {
      const internalId = accountByPlaidId.get(acc.account_id)
      if (!internalId) continue
      await supabase.from('accounts').update({
        current_balance: acc.balances.current ?? null,
        available_balance: acc.balances.available ?? null,
        balance_updated_at: new Date().toISOString(),
      }).eq('id', internalId)
    }
  } catch {
    // Non-critical — balances will retry on next sync
  }

  // Persist cursor and sync time
  await supabase
    .from('plaid_items')
    .update({
      cursor,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  return result
}

// ─── Notification triggers ───────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

async function triggerNotifications(
  supabase: AdminClient,
  householdId: string,
  added: PlaidTransaction[]
) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // 1. Paycheck notifications — income transactions over $500
  const paychecks = added.filter((tx) => tx.amount < 0 && Math.abs(tx.amount) >= 500)
  for (const tx of paychecks) {
    await createNotification({
      householdId,
      type: 'paycheck',
      title: 'Paycheck received',
      body: `${tx.merchant_name ?? tx.name}: $${Math.abs(tx.amount).toLocaleString()} deposited`,
      metadata: { amount: Math.abs(tx.amount), merchant: tx.merchant_name ?? tx.name },
    })
  }

  // 2. Budget threshold notifications — only check current month expenses
  const expenseTxs = added.filter((tx) => {
    if (tx.amount <= 0) return false
    const txDate = new Date(tx.date)
    return txDate.getMonth() + 1 === month && txDate.getFullYear() === year
  })
  if (expenseTxs.length === 0) return

  // Fetch current month's budget items
  const { data: budget } = await supabase
    .from('budgets')
    .select('id, budget_items(category_id, planned_amount, category:categories(name))')
    .eq('household_id', householdId)
    .eq('month', month)
    .eq('year', year)
    .eq('is_template', false)
    .maybeSingle()

  if (!budget) return

  const budgetItems = (budget.budget_items ?? []) as unknown as Array<{
    category_id: string
    planned_amount: number
    category: { name: string } | null
  }>
  if (budgetItems.length === 0) return

  // Fetch all current month actuals per category
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data: txData } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('household_id', householdId)
    .eq('excluded', false)
    .eq('pending', false)
    .gte('date', start)
    .lt('date', end)

  const actualByCategory: Record<string, number> = {}
  for (const tx of txData ?? []) {
    if (tx.category_id) {
      actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount
    }
  }

  // Fetch already-sent notifications this month to avoid duplicates
  const notifStart = `${year}-${String(month).padStart(2, '0')}-01`
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('type, metadata')
    .eq('household_id', householdId)
    .in('type', ['budget_warning', 'budget_exceeded'])
    .gte('created_at', notifStart)

  const alreadySentWarning = new Set<string>()
  const alreadySentExceeded = new Set<string>()
  for (const n of existingNotifs ?? []) {
    const catId = (n.metadata as Record<string, unknown>)?.category_id as string | undefined
    if (!catId) continue
    if (n.type === 'budget_warning') alreadySentWarning.add(catId)
    if (n.type === 'budget_exceeded') alreadySentExceeded.add(catId)
  }

  for (const item of budgetItems) {
    if (item.planned_amount <= 0) continue
    const actual = actualByCategory[item.category_id] ?? 0
    const pct = (actual / item.planned_amount) * 100
    const catName = item.category?.name ?? 'Unknown'

    if (pct > 100 && !alreadySentExceeded.has(item.category_id)) {
      await createNotification({
        householdId,
        type: 'budget_exceeded',
        title: `${catName} budget exceeded`,
        body: `You've spent $${actual.toLocaleString()} of your $${item.planned_amount.toLocaleString()} ${catName} budget (${Math.round(pct)}%).`,
        metadata: { category_id: item.category_id, pct_used: Math.round(pct) },
      })
    } else if (pct >= 80 && pct <= 100 && !alreadySentWarning.has(item.category_id)) {
      await createNotification({
        householdId,
        type: 'budget_warning',
        title: `${catName} at ${Math.round(pct)}%`,
        body: `You've used ${Math.round(pct)}% of your $${item.planned_amount.toLocaleString()} ${catName} budget.`,
        metadata: { category_id: item.category_id, pct_used: Math.round(pct) },
      })
    }
  }
}
