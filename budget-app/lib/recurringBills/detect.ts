import type { createClient } from '@/lib/supabase/server'
import { normalizeMerchant } from '@/lib/categorization/rules'
import { trailingMonths, monthRange } from '@/lib/dateRange'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const LOOKBACK_MONTHS = 6
// 2 occurrences at a similar price ~30 days apart is coincidence-prone (e.g.
// two dinners at the same restaurant costing about the same) — 3+ is a much
// stronger signal, at the cost of a newly-started subscription not showing
// up until its third charge.
const MIN_OCCURRENCES = 3
const MIN_GAP_DAYS = 25
const MAX_GAP_DAYS = 35
const MIN_AMOUNT_TOLERANCE = 1
const AMOUNT_TOLERANCE_PCT = 0.05
// If the last charge is more than this many days ago (relative to the
// typical gap for that bill), treat it as no longer active — e.g. rent at a
// place you've since moved out of — rather than surfacing it forever.
const STALE_MULTIPLIER = 1.5
const MIN_STALE_CUTOFF_DAYS = 45

interface BillCategory {
  id: string
  name: string
  icon: string
  color: string
}

export interface RecurringTransactionInput {
  merchant_name: string | null
  description: string
  amount: number
  date: string // YYYY-MM-DD
  category: BillCategory | BillCategory[] | null
}

export interface RecurringBillsRawData {
  transactions: RecurringTransactionInput[]
}

interface FetchRecurringBillsRawDataArgs {
  supabase: SupabaseServerClient
  householdId: string
}

export async function fetchRecurringBillsRawData({
  supabase,
  householdId,
}: FetchRecurringBillsRawDataArgs): Promise<RecurringBillsRawData> {
  const months = trailingMonths(LOOKBACK_MONTHS)
  const { start } = monthRange(months[0].month, months[0].year)

  const { data } = await supabase
    .from('transactions')
    .select('merchant_name, description, amount, date, category:categories(id,name,icon,color)')
    .eq('household_id', householdId)
    .eq('is_income', false)
    .eq('excluded', false)
    .eq('pending', false)
    .gte('date', start)

  return { transactions: data ?? [] }
}

export interface RecurringBill {
  key: string
  label: string
  averageAmount: number
  lastAmount: number
  lastDate: string
  nextExpectedDate: string
  occurrences: number
  category: BillCategory | null
}

function normalizeCategory(category: BillCategory | BillCategory[] | null): BillCategory | null {
  return Array.isArray(category) ? (category[0] ?? null) : category
}

function daysBetween(earlier: string, later: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round(
    (new Date(later + 'T00:00:00').getTime() - new Date(earlier + 'T00:00:00').getTime()) / MS_PER_DAY
  )
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Groups expense transactions by normalized merchant and flags groups that
// look like a recurring monthly charge: at least 3 occurrences, all roughly
// the same amount (within 5%, or $1, whichever is larger — subscription
// prices sometimes shift slightly with tax), spaced 25-35 days apart, with
// the most recent charge still recent enough to look active.
//
// Known limitations:
// - A merchant used for both one-off and recurring purchases (e.g. "Amazon"
//   for both general shopping and a Prime subscription) won't be detected,
//   since the mixed amounts fail the tolerance check — the simpler
//   false-negative here is preferable to guessing which transactions in a
//   noisy group are "the real subscription."
// - The same underlying subscription can appear as two separate entries if
//   the biller's descriptor changes across charges (seen in practice: an
//   AI subscription billing once as the company's legal name and once as
//   its product name) — grouping is purely by merchant text, with no cross-
//   merchant amount/cadence correlation, to avoid falsely merging unrelated
//   same-priced bills.
export function detectRecurringBills(
  raw: RecurringBillsRawData,
  now: Date = new Date()
): RecurringBill[] {
  const todayStr = now.toISOString().slice(0, 10)
  const groups = new Map<string, RecurringTransactionInput[]>()
  for (const tx of raw.transactions) {
    const source = tx.merchant_name ?? tx.description
    if (!source) continue
    const key = normalizeMerchant(source)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const results: RecurringBill[] = []

  for (const [key, txs] of groups) {
    if (txs.length < MIN_OCCURRENCES) continue
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))

    const amounts = sorted.map((t) => t.amount)
    const minAmount = Math.min(...amounts)
    const maxAmount = Math.max(...amounts)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const tolerance = Math.max(MIN_AMOUNT_TOLERANCE, avgAmount * AMOUNT_TOLERANCE_PCT)
    if (maxAmount - minAmount > tolerance) continue

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }
    if (!gaps.every((g) => g >= MIN_GAP_DAYS && g <= MAX_GAP_DAYS)) continue

    const last = sorted[sorted.length - 1]
    const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 30

    const staleCutoffDays = Math.max(MIN_STALE_CUTOFF_DAYS, avgGap * STALE_MULTIPLIER)
    if (daysBetween(last.date, todayStr) > staleCutoffDays) continue

    results.push({
      key,
      label: last.merchant_name ?? last.description,
      averageAmount: avgAmount,
      lastAmount: last.amount,
      lastDate: last.date,
      nextExpectedDate: addDays(last.date, avgGap),
      occurrences: sorted.length,
      category: normalizeCategory(last.category),
    })
  }

  return results.sort((a, b) => b.averageAmount - a.averageAmount)
}
