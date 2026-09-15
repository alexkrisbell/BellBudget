-- Daily balance snapshots per account, so net worth can be trended over time.
-- Plaid only ever gives us the CURRENT balance — there's no historical
-- balance endpoint in use here — so this table only starts accumulating
-- history from whenever this migration is applied forward.

CREATE TABLE IF NOT EXISTS public.account_balance_snapshots (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid        NOT NULL REFERENCES public.accounts(id)   ON DELETE CASCADE,
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  date         date        NOT NULL,
  balance      numeric(12, 2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, date)
);

CREATE INDEX idx_snapshots_household_date ON public.account_balance_snapshots(household_id, date);

ALTER TABLE public.account_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Members can view; writes are service-role only, same trust model as `accounts`.
CREATE POLICY snapshots_select ON public.account_balance_snapshots
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
