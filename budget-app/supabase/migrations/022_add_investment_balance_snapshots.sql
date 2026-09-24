-- Daily balance snapshots per investment account, so net worth can include
-- Schwab balances the same way it already trends Plaid account balances via
-- account_balance_snapshots. balance is the account's TOTAL value (Schwab's
-- liquidationValue, stored as investment_accounts.market_value — cash
-- included), not market_value + cash_balance, which would double-count cash.

CREATE TABLE IF NOT EXISTS public.investment_account_balance_snapshots (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_account_id  uuid        NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  household_id           uuid        NOT NULL REFERENCES public.households(id)          ON DELETE CASCADE,
  date                   date        NOT NULL,
  balance                numeric(14, 2) NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investment_account_id, date)
);

CREATE INDEX idx_investment_snapshots_household_date
  ON public.investment_account_balance_snapshots(household_id, date);

ALTER TABLE public.investment_account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY investment_balance_snapshots_select ON public.investment_account_balance_snapshots
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
