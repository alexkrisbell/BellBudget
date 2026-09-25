-- Schwab transaction history, needed to answer "how much did we invest this
-- month" from actual contributions/trades/dividends rather than just the
-- current balance snapshot. type is Schwab's raw activity type string;
-- category is our own classification of it (see lib/investments/classify.ts)
-- so re-classifying later doesn't require re-fetching from Schwab.

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           uuid        NOT NULL REFERENCES public.households(id)          ON DELETE CASCADE,
  investment_account_id  uuid        NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  schwab_activity_id     text        NOT NULL,
  type                   text        NOT NULL,
  category               text        NOT NULL
                           CHECK (category IN ('contribution', 'withdrawal', 'dividend_or_interest', 'trade', 'transfer', 'fee', 'other')),
  symbol                 text,
  amount                 numeric(14, 2) NOT NULL,
  description            text,
  transacted_at          date        NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investment_account_id, schwab_activity_id)
);

CREATE INDEX idx_investment_transactions_household_date
  ON public.investment_transactions(household_id, transacted_at);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY investment_transactions_select ON public.investment_transactions
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
