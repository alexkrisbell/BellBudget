-- =============================================================================
-- Migration 008: Add Payments + Misc categories, clean up duplicate Plaid
--                connections, and un-exclude depository transfer transactions
--
-- Run AFTER migration 007.
-- =============================================================================

-- ─── 0. Extend plaid_items status constraint to include 'inactive' ───────────
-- The original constraint only allowed 'active', 'error', 'requires_reauth'.
-- 'inactive' is needed to mark superseded/duplicate connections without deleting them.
ALTER TABLE public.plaid_items
  DROP CONSTRAINT IF EXISTS plaid_items_status_check;

ALTER TABLE public.plaid_items
  ADD CONSTRAINT plaid_items_status_check
  CHECK (status IN ('active', 'error', 'requires_reauth', 'inactive'));

-- ─── 1. Bump income category sort_order to make room for new expense categories
UPDATE public.categories
SET sort_order = sort_order + 2
WHERE is_income = true AND household_id IS NULL;

-- ─── 2. Add new expense categories ──────────────────────────────────────────
INSERT INTO public.categories
  (id, household_id, name, color, icon, is_income, is_system, sort_order)
VALUES
  (gen_random_uuid(), NULL, 'Payments', '#64748B', '💳', false, true, 18),
  (gen_random_uuid(), NULL, 'Misc',     '#9CA3AF', '🗂️', false, true, 19)
ON CONFLICT DO NOTHING;

-- ─── 3. Deduplicate Plaid connections ───────────────────────────────────────
-- Keep the most-recently-created plaid_item per (household, institution).
-- Older duplicates are set to 'inactive'; their accounts are deactivated.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY household_id, institution_id
      ORDER BY created_at DESC
    ) AS rn
  FROM public.plaid_items
)
UPDATE public.plaid_items
SET status = 'inactive', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE public.accounts
SET is_active = false
WHERE plaid_item_id IN (
  SELECT id FROM public.plaid_items WHERE status = 'inactive'
);

-- ─── 4. Un-exclude depository-account transfers ──────────────────────────────
-- When the USAA checking account was first synced, ALL TRANSFER_OUT transactions
-- were auto-excluded (old logic). Un-exclude them all so Zelle payments appear.
-- If a credit card payment from checking also surfaces, it can be re-excluded manually.

UPDATE public.transactions t
SET
  excluded   = false,
  updated_at = now()
FROM public.accounts a
WHERE t.account_id = a.id
  AND a.type      = 'depository'
  AND a.is_active = true
  AND t.excluded  = true
  AND t.is_income = false;
