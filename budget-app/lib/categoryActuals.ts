import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface FetchCategoryActualsArgs {
  supabase: SupabaseServerClient
  householdId: string
  start: string
  end: string
}

// Pure aggregation step, split out from the fetch so it can be unit tested
// without a DB: sum of spend per category, ignoring rows with no category.
export function aggregateCategoryActuals(
  rows: Array<{ category_id: string | null; amount: number }>
): Record<string, number> {
  const actualByCategory: Record<string, number> = {}
  for (const row of rows) {
    if (row.category_id) {
      actualByCategory[row.category_id] = (actualByCategory[row.category_id] ?? 0) + row.amount
    }
  }
  return actualByCategory
}

// Single source of truth for "category actuals" math (sum of spend per
// category for a date range). Reads from transaction_category_amounts,
// which explodes split transactions into their split rows and passes
// non-split transactions through unchanged — so callers never need their
// own split-aware branch.
export async function fetchCategoryActuals({
  supabase,
  householdId,
  start,
  end,
}: FetchCategoryActualsArgs): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('transaction_category_amounts')
    .select('category_id, amount')
    .eq('household_id', householdId)
    .eq('excluded', false)
    .eq('pending', false)
    .gte('date', start)
    .lt('date', end)

  return aggregateCategoryActuals(data ?? [])
}
