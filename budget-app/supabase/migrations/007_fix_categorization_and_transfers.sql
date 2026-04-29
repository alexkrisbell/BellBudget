-- =============================================================================
-- Migration 007: Fix miscategorized transactions and seed correction rules
--
-- Fixes:
--   1. "Platinum Resy Credit" and any Resy transaction → Dining Out
--   2. "USAA INSURANCE PAYMESAN ANTONIO" and any USAA Insurance → Transportation
--   3. Un-exclude Zelle payments from checking accounts that were incorrectly
--      marked as internal transfers (identified by 'zelle' in the description)
-- =============================================================================

DO $$
DECLARE
  dining_out_id    uuid;
  transportation_id uuid;
BEGIN
  -- Look up system category IDs (household_id IS NULL means system/shared category)
  SELECT id INTO dining_out_id
    FROM public.categories
    WHERE name = 'Dining Out' AND household_id IS NULL
    LIMIT 1;

  SELECT id INTO transportation_id
    FROM public.categories
    WHERE name = 'Transportation' AND household_id IS NULL
    LIMIT 1;

  IF dining_out_id IS NULL OR transportation_id IS NULL THEN
    RAISE EXCEPTION 'Required system categories not found. Run migration 004 first.';
  END IF;

  -- ─── 1. Re-categorize existing Resy transactions → Dining Out ──────────────
  UPDATE public.transactions
  SET
    category_id           = dining_out_id,
    categorization_source = 'rule',
    updated_at            = now()
  WHERE
    (lower(merchant_name) LIKE '%resy%' OR lower(description) LIKE '%resy%')
    AND category_id IS DISTINCT FROM dining_out_id;

  -- ─── 2. Re-categorize existing USAA Insurance transactions → Transportation ─
  UPDATE public.transactions
  SET
    category_id           = transportation_id,
    categorization_source = 'rule',
    updated_at            = now()
  WHERE
    (lower(merchant_name) LIKE '%usaa insurance%' OR lower(description) LIKE '%usaa insurance%')
    AND category_id IS DISTINCT FROM transportation_id;

  -- ─── 3. Un-exclude Zelle payments that were auto-excluded as transfers ──────
  -- These are real expenses (rent, utilities paid via Zelle) from depository
  -- accounts. We identify them by 'zelle' appearing in the description.
  UPDATE public.transactions t
  SET
    excluded   = false,
    updated_at = now()
  FROM public.accounts a
  WHERE t.account_id = a.id
    AND a.type      = 'depository'
    AND t.excluded  = true
    AND t.is_income = false
    AND (lower(t.description) LIKE '%zelle%' OR lower(t.merchant_name) LIKE '%zelle%');

  -- ─── 4. Seed correction rules into every existing household ────────────────
  -- Priority 10 matches user rules so these apply immediately. ON CONFLICT DO
  -- NOTHING means existing user overrides are preserved.

  INSERT INTO public.categorization_rules
    (household_id, merchant_keyword, category_id, match_type, priority, source, usage_count)
  SELECT h.id, 'resy', dining_out_id, 'contains', 10, 'system', 0
  FROM public.households h
  ON CONFLICT (household_id, merchant_keyword) DO NOTHING;

  INSERT INTO public.categorization_rules
    (household_id, merchant_keyword, category_id, match_type, priority, source, usage_count)
  SELECT h.id, 'usaa insurance', transportation_id, 'contains', 10, 'system', 0
  FROM public.households h
  ON CONFLICT (household_id, merchant_keyword) DO NOTHING;

END $$;
