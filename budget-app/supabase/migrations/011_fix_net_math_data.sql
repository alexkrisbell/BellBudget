-- =============================================================================
-- Migration 011: Ensure net-math data is in correct state
--
-- The dashboard now uses net math: income transactions in expense categories
-- subtract from that category's spending. For this to work, income transactions
-- must be (a) not excluded and (b) have a valid category_id.
--
-- This migration is idempotent — safe to re-run.
-- =============================================================================

-- Step 1: Un-exclude any income transactions from depository accounts that are
-- still excluded. Migration 009 did this, but run again safely in case it was
-- not applied or partially failed.
UPDATE public.transactions t
SET excluded    = false,
    updated_at  = now()
FROM public.accounts a
WHERE t.account_id  = a.id
  AND a.type        = 'depository'
  AND t.excluded    = true
  AND t.is_income   = true;

-- Step 2: Assign "Other Income" to any income transactions that have a NULL
-- category_id — these were never categorized and would be silently skipped
-- by the net-math loop.
UPDATE public.transactions t
SET category_id           = c.id,
    categorization_source = 'rule',
    updated_at            = now()
FROM public.categories c
WHERE t.category_id       IS NULL
  AND t.is_income          = true
  AND t.excluded           = false
  AND c.name               = 'Other Income'
  AND c.household_id       IS NULL;
