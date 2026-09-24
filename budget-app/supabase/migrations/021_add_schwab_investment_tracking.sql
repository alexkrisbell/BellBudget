-- Investment tracking via Schwab's Trader API (read-only: balances, positions,
-- transactions — no order entry, per CLAUDE.md §4/§6). Mirrors the plaid_items
-- shape, but Schwab needs BOTH an access token (short-lived, ~30 min) and a
-- refresh token (hard-expires after 7 days with no extension mechanism other
-- than being used) tracked separately, so token_expires_at/refresh_token_expires_at
-- both exist here where plaid_items only ever needed one long-lived token.

CREATE TABLE IF NOT EXISTS public.brokerage_connections (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id              uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  provider                  text        NOT NULL DEFAULT 'schwab' CHECK (provider IN ('schwab')),
  access_token_vault_id     uuid        NOT NULL,   -- vault.secrets.id
  refresh_token_vault_id    uuid        NOT NULL,   -- vault.secrets.id
  access_token_expires_at   timestamptz NOT NULL,
  refresh_token_expires_at  timestamptz NOT NULL,
  status                    text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'error', 'requires_reauth')),
  error_code                text,
  last_synced_at            timestamptz,
  connected_by_user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, provider)
);

CREATE INDEX idx_brokerage_connections_household_id ON public.brokerage_connections(household_id);

CREATE TABLE IF NOT EXISTS public.investment_accounts (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id             uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- SET NULL (not CASCADE) so historical holdings/net-worth data survives a
  -- disconnect+reconnect, same "keep the history" choice as plaid_items.
  brokerage_connection_id  uuid        REFERENCES public.brokerage_connections(id) ON DELETE SET NULL,
  schwab_account_id        text        UNIQUE NOT NULL, -- Schwab's own encrypted hashValue, not the raw account number
  nickname                 text,
  account_type             text,
  cash_balance             numeric(14, 2),
  market_value             numeric(14, 2),
  balance_updated_at       timestamptz,
  is_active                boolean     NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_accounts_household_id ON public.investment_accounts(household_id);

-- Daily position snapshots per holding, same "starts accumulating from whenever
-- this is applied" limitation as account_balance_snapshots — Schwab only gives
-- current positions, no position history endpoint.
CREATE TABLE IF NOT EXISTS public.investment_holdings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id            uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  investment_account_id   uuid        NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  symbol                  text        NOT NULL,
  description             text,
  quantity                numeric(18, 6) NOT NULL,
  market_value            numeric(14, 2) NOT NULL,
  cost_basis              numeric(14, 2),
  date                    date        NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investment_account_id, symbol, date)
);

CREATE INDEX idx_investment_holdings_household_date ON public.investment_holdings(household_id, date);

ALTER TABLE public.brokerage_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_holdings   ENABLE ROW LEVEL SECURITY;

-- Members can view; writes are service-role only, same trust model as plaid_items/accounts.
CREATE POLICY brokerage_connections_select ON public.brokerage_connections
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY investment_accounts_select ON public.investment_accounts
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY investment_holdings_select ON public.investment_holdings
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- Vault helpers for Schwab tokens. Generic over "a token" (not Plaid-specific)
-- since a brokerage_connections row needs two secrets (access + refresh) —
-- callers pass their own label rather than this deriving one from an item id.
CREATE OR REPLACE FUNCTION public.vault_store_schwab_token(p_token text, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_id uuid;
BEGIN
  SELECT vault.create_secret(p_token, p_label, 'Schwab OAuth token') INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_get_schwab_token(p_secret_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_update_schwab_token(p_secret_id uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  UPDATE vault.secrets SET secret = p_token WHERE id = p_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_schwab_token(p_secret_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_store_schwab_token(text, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_get_schwab_token(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_update_schwab_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_delete_schwab_token(uuid)       FROM PUBLIC;

-- Proactive reconnect notification, surfaced when the daily sync can no longer
-- refresh the connection's tokens before the 7-day refresh-token window lapses.
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'budget_warning',
    'budget_exceeded',
    'paycheck',
    'streak_update',
    'item_error',
    'sync_failed',
    'schwab_reconnect_required'
  ));
