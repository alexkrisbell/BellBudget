export interface SplitInput {
  category_id: string
  amount: number
}

export interface SplitValidationResult {
  valid: boolean
  error?: string
}

// Pure validation for a proposed set of transaction splits, kept separate
// from the API route so it can be unit tested without a DB. `validCategoryIds`
// is the set of category ids the caller has already confirmed belong to this
// household (or are shared system categories) — this function only checks
// shape/arithmetic, not category ownership.
export function validateSplits(
  splits: SplitInput[],
  transactionAmount: number,
  isIncome: boolean,
  validCategoryIds: Set<string>
): SplitValidationResult {
  if (isIncome) {
    return { valid: false, error: 'Income transactions cannot be split.' }
  }
  if (splits.length < 2) {
    return { valid: false, error: 'A split needs at least 2 categories.' }
  }
  if (splits.some((s) => !s.category_id || !(Number(s.amount) > 0))) {
    return { valid: false, error: 'Each split needs a category and a positive amount.' }
  }
  if (splits.some((s) => !validCategoryIds.has(s.category_id))) {
    return { valid: false, error: 'Invalid category.' }
  }

  // Cents-based comparison to avoid floating-point drift (e.g. 0.1 + 0.2 !== 0.3).
  const splitCents = splits.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0)
  const transactionCents = Math.round(transactionAmount * 100)
  if (splitCents !== transactionCents) {
    return { valid: false, error: 'Split amounts must add up to the transaction total.' }
  }

  return { valid: true }
}
