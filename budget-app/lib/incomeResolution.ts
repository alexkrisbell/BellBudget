// Single source of truth for "is this transaction income" — previously
// duplicated (correctly) in lib/dashboard/compute.ts and lib/stats/compute.ts,
// and (incorrectly, still trusting the raw flag) in the transactions list's
// income filter, which made the Dashboard's income total and the "Income"
// transaction list disagree with each other for the exact same month.
//
// A category the user has (re)assigned is the more authoritative signal —
// manually recategorizing a transaction never updates its own is_income flag
// (see app/api/transactions/[id]/category/route.ts) — so trust the
// category's is_income when one is set, and only fall back to the
// transaction's own flag when it's uncategorized.

export interface IncomeCategory {
  is_income: boolean
}

export function normalizeCategoryForIncome<T extends IncomeCategory>(
  category: T | T[] | null | undefined
): T | null {
  if (Array.isArray(category)) return category[0] ?? null
  return category ?? null
}

export function resolveIsIncome(tx: {
  is_income: boolean
  category: IncomeCategory | IncomeCategory[] | null | undefined
}): boolean {
  const category = normalizeCategoryForIncome(tx.category)
  return category ? category.is_income : tx.is_income
}
