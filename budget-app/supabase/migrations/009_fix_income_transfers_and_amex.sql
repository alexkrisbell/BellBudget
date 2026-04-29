-- =============================================================================
-- Migration 009: Un-exclude income transfers from depository accounts,
--                re-exclude AMEX credit card payment transactions
--
-- Run AFTER migration 008.
--
-- Background:
--   Migration 008 step 4 un-excluded depository expense transactions (is_income=false)
--   but missed income transactions (is_income=true) like incoming Zelle payments.
--   The original sync code excluded ALL TRANSFER_IN, including TRANSFER_IN_DEPOSIT
--   (Zelle sent to you), which is real income and should be visible.
--
--   Migration 008 also accidentally un-excluded AMEX credit card payments from
--   checking (AMEX EPAYMENT ACH PMT). Those should stay excluded — they're the
--   same spending already tracked on the credit card, not new expenses.
-- =============================================================================

-- ─── 1. Un-exclude income transfers from depository accounts ─────────────────
-- These are incoming Zelle payments, ACH deposits, etc. that were incorrectly
-- excluded when the checking account was first synced with the old isTransfer().

UPDATE public.transactions t
SET
  excluded   = false,
  updated_at = now()
FROM public.accounts a
WHERE t.account_id = a.id
  AND a.type      = 'depository'
  AND t.excluded  = true
  AND t.is_income = true;

-- ─── 2. Re-exclude AMEX credit card payment transactions ─────────────────────
-- These were un-excluded by migration 008 step 4 but should remain hidden.
-- The shouldAlwaysExclude() function in sync.ts prevents new ones from appearing.

UPDATE public.transactions
SET
  excluded   = true,
  updated_at = now()
WHERE
  (lower(description) LIKE '%amex epayment%' OR lower(merchant_name) LIKE '%amex epayment%')
  AND excluded = false;
