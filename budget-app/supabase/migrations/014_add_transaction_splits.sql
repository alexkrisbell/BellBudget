-- Support splitting a single transaction across multiple categories
-- (e.g. one Sam's Club charge -> $80 Groceries + $20 Shopping).
--
-- Splits live in a child table rather than additional `transactions` rows
-- because `transactions.plaid_transaction_id` is UNIQUE NOT NULL and Plaid's
-- modify/remove webhook handling keys off it — two rows can't share or fake
-- that identity without corrupting sync.

CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  household_id   uuid        NOT NULL REFERENCES public.households(id)   ON DELETE CASCADE,
  category_id    uuid        NOT NULL REFERENCES public.categories(id),
  amount         numeric(12, 2) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_splits_transaction_id ON public.transaction_splits(transaction_id);
CREATE INDEX idx_splits_household_id   ON public.transaction_splits(household_id);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Members can view; writes are service-role only, same trust model as
-- `transactions` itself (the split API route uses the admin client).
CREATE POLICY splits_select ON public.transaction_splits
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- Single source of truth for "category actuals" math, used by the dashboard,
-- budget page, and budget-threshold notifications. Explodes split
-- transactions into their split rows and passes through non-split
-- transactions unchanged, so callers never need their own split-aware branch.
-- =============================================================================

CREATE OR REPLACE VIEW public.transaction_category_amounts AS
  SELECT
    t.id            AS transaction_id,
    t.household_id,
    t.date,
    t.is_income,
    t.excluded,
    t.pending,
    ts.category_id,
    ts.amount
  FROM public.transaction_splits ts
  JOIN public.transactions t ON t.id = ts.transaction_id
  UNION ALL
  SELECT
    t.id, t.household_id, t.date, t.is_income, t.excluded, t.pending,
    t.category_id, t.amount
  FROM public.transactions t
  WHERE NOT EXISTS (SELECT 1 FROM public.transaction_splits ts WHERE ts.transaction_id = t.id);
