-- =============================================================================
-- Migration 010: Move income transactions out of expense categories
--
-- Run AFTER migration 009.
--
-- Problem: Incoming Zelle payments (e.g. Robin Winkles rent/income) were
-- categorized as expense categories (Misc, Other, etc.) because:
--   a) The sync code didn't distinguish income vs expense when categorizing
--   b) The AI sometimes returned expense category names for income transactions
--
-- Fix: Reassign any income transaction (is_income=true) that currently sits in
-- an expense category (is_income=false) to "Other Income".
--
-- The categorization engine now has a safeguard (step 7) that prevents this
-- going forward for new syncs.
-- =============================================================================

UPDATE public.transactions t
SET
  category_id           = c_income.id,
  categorization_source = 'rule',
  updated_at            = now()
FROM
  public.categories c_expense,
  public.categories c_income
WHERE
  -- transaction is in an expense category
  t.category_id = c_expense.id
  AND c_expense.is_income = false
  -- but the transaction is income
  AND t.is_income = true
  AND t.excluded  = false
  -- target: Other Income system category
  AND c_income.name        = 'Other Income'
  AND c_income.household_id IS NULL;
