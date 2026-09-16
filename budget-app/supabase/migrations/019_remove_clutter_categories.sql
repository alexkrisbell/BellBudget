-- Remove system categories that turned out to be clutter rather than useful:
-- Freelance, Transfer (income), Investments, Payments, Misc (expense).
--
-- categorization_rules cascades on category delete (fine — rules just
-- relearn) and transactions.category_id is SET NULL (fine — becomes
-- uncategorized). budget_items and transaction_splits have no ON DELETE
-- behavior (RESTRICT), so any existing usage is reassigned to the matching
-- "Other" / "Other Income" fallback first, merging planned amounts rather
-- than violating budget_items' UNIQUE(budget_id, category_id) constraint
-- when a budget already has its own "Other" line.

DO $$
DECLARE
  cat RECORD;
  fallback_id uuid;
BEGIN
  FOR cat IN
    SELECT id, is_income
    FROM public.categories
    WHERE household_id IS NULL
      AND name IN ('Freelance', 'Transfer', 'Investments', 'Payments', 'Misc')
  LOOP
    SELECT id INTO fallback_id
    FROM public.categories
    WHERE household_id IS NULL
      AND is_income = cat.is_income
      AND name = CASE WHEN cat.is_income THEN 'Other Income' ELSE 'Other' END
    LIMIT 1;

    -- transaction_splits: no conflict risk, just move them.
    UPDATE public.transaction_splits
    SET category_id = fallback_id
    WHERE category_id = cat.id;

    -- budget_items: merge into an existing fallback line in the same budget
    -- first (to avoid violating the UNIQUE(budget_id, category_id) constraint),
    -- then delete the now-merged duplicates.
    UPDATE public.budget_items existing
    SET planned_amount = existing.planned_amount + dup.planned_amount
    FROM public.budget_items dup
    WHERE dup.category_id = cat.id
      AND existing.category_id = fallback_id
      AND existing.budget_id = dup.budget_id;

    DELETE FROM public.budget_items dup
    USING public.budget_items existing
    WHERE dup.category_id = cat.id
      AND existing.category_id = fallback_id
      AND existing.budget_id = dup.budget_id;

    -- Any remaining budget_items rows for this category had no conflicting
    -- fallback line in their budget, so they can be reassigned directly.
    UPDATE public.budget_items
    SET category_id = fallback_id
    WHERE category_id = cat.id;
  END LOOP;

  DELETE FROM public.categories
  WHERE household_id IS NULL
    AND name IN ('Freelance', 'Transfer', 'Investments', 'Payments', 'Misc');
END $$;
