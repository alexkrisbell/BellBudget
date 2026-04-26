-- =============================================================================
-- Migration 001: Initial Schema
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Prerequisites:
--   1. Enable Vault extension: Dashboard → Database → Extensions → supabase_vault
--   2. pgcrypto is enabled by default on all Supabase projects

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- USERS
-- Mirror of auth.users, populated by trigger on signup (migration 003)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        UNIQUE NOT NULL,
  full_name   text        NOT NULL DEFAULT '',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- HOUSEHOLDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.households (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  created_by  uuid        NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- HOUSEHOLD MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.household_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  role          text        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'member')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE INDEX idx_hm_user_id       ON public.household_members(user_id);
CREATE INDEX idx_hm_household_id  ON public.household_members(household_id);
-- Composite index used by is_household_member() helper in RLS policies
CREATE INDEX idx_hm_lookup        ON public.household_members(household_id, user_id);

-- =============================================================================
-- HOUSEHOLD INVITES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.household_invites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_email   text        NOT NULL,
  invite_token    text        UNIQUE NOT NULL
                                DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid        NOT NULL REFERENCES public.users(id),
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_token        ON public.household_invites(invite_token);
CREATE INDEX idx_invites_household_id ON public.household_invites(household_id);

-- =============================================================================
-- PLAID ITEMS
-- One row per bank connection. Raw access token stored in Supabase Vault.
-- access_token_vault_id stores the UUID returned by vault.create_secret().
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plaid_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plaid_item_id         text        UNIQUE NOT NULL,
  access_token_vault_id uuid        NOT NULL,   -- vault.secrets.id
  institution_id        text        NOT NULL,
  institution_name      text        NOT NULL,
  status                text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'error', 'requires_reauth')),
  error_code            text,
  cursor                text,                   -- /transactions/sync incremental cursor
  last_synced_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plaid_items_household_id ON public.plaid_items(household_id);
CREATE INDEX idx_plaid_items_status       ON public.plaid_items(household_id, status);

-- =============================================================================
-- ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plaid_item_id       uuid        NOT NULL REFERENCES public.plaid_items(id)  ON DELETE CASCADE,
  plaid_account_id    text        UNIQUE NOT NULL,
  name                text        NOT NULL,
  official_name       text,
  type                text        NOT NULL
                        CHECK (type IN ('depository', 'credit', 'loan', 'investment', 'other')),
  subtype             text,
  current_balance     numeric(12, 2),
  available_balance   numeric(12, 2),
  balance_updated_at  timestamptz,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_household_id  ON public.accounts(household_id);
CREATE INDEX idx_accounts_plaid_item_id ON public.accounts(plaid_item_id);

-- =============================================================================
-- CATEGORIES
-- household_id IS NULL  →  system default (visible to all households)
-- household_id NOT NULL →  custom category for that household
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        REFERENCES public.households(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  color         text        NOT NULL DEFAULT '#6B7280',
  icon          text        NOT NULL DEFAULT '📦',
  is_income     boolean     NOT NULL DEFAULT false,
  is_system     boolean     NOT NULL DEFAULT false,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Unique name per household (custom categories)
CREATE UNIQUE INDEX idx_categories_unique_household_name
  ON public.categories(household_id, name)
  WHERE household_id IS NOT NULL;

-- Unique name across system categories
CREATE UNIQUE INDEX idx_categories_unique_system_name
  ON public.categories(name)
  WHERE household_id IS NULL;

CREATE INDEX idx_categories_household_id ON public.categories(household_id);

-- =============================================================================
-- CATEGORIZATION RULES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  merchant_keyword  text        NOT NULL,
  category_id       uuid        NOT NULL REFERENCES public.categories(id)  ON DELETE CASCADE,
  match_type        text        NOT NULL DEFAULT 'contains'
                      CHECK (match_type IN ('exact', 'contains', 'starts_with')),
  priority          int         NOT NULL DEFAULT 0,
  source            text        NOT NULL DEFAULT 'system'
                      CHECK (source IN ('user', 'ai', 'system')),
  usage_count       int         NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Composite index used by categorization engine (load rules ordered by priority)
CREATE INDEX idx_cat_rules_lookup
  ON public.categorization_rules(household_id, source, priority DESC);

-- =============================================================================
-- TRANSACTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid        NOT NULL REFERENCES public.accounts(id)    ON DELETE CASCADE,
  household_id          uuid        NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  plaid_transaction_id  text        UNIQUE NOT NULL,
  amount                numeric(12, 2) NOT NULL, -- Plaid: positive=debit/expense, negative=income
  merchant_name         text,
  description           text        NOT NULL DEFAULT '',
  date                  date        NOT NULL,
  authorized_date       date,
  category_id           uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  categorization_source text        NOT NULL DEFAULT 'plaid'
                          CHECK (categorization_source IN ('plaid', 'rule', 'ai', 'user')),
  user_id               uuid        REFERENCES public.users(id)      ON DELETE SET NULL,
  is_income             boolean     NOT NULL DEFAULT false,
  pending               boolean     NOT NULL DEFAULT false,
  excluded              boolean     NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Primary query pattern: household transactions by date (dashboard, transactions page)
CREATE INDEX idx_tx_household_date     ON public.transactions(household_id, date DESC);
-- Category breakdown queries (budget actuals)
CREATE INDEX idx_tx_household_category ON public.transactions(household_id, category_id, date);
-- Sync dedup check
CREATE INDEX idx_tx_account_id         ON public.transactions(account_id);
-- Income detection (streak + income strip)
CREATE INDEX idx_tx_household_income   ON public.transactions(household_id, is_income, date);

-- =============================================================================
-- BUDGETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budgets (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  month                 int         NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                  int         NOT NULL CHECK (year >= 2020),
  total_income_expected numeric(12, 2),
  notes                 text,
  is_template           boolean     NOT NULL DEFAULT false,
  template_name         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Only one active (non-template) budget per household per month/year
CREATE UNIQUE INDEX idx_budgets_unique_active
  ON public.budgets(household_id, month, year)
  WHERE NOT is_template;

CREATE INDEX idx_budgets_household_id ON public.budgets(household_id);

-- =============================================================================
-- BUDGET ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.budget_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       uuid        NOT NULL REFERENCES public.budgets(id)     ON DELETE CASCADE,
  category_id     uuid        NOT NULL REFERENCES public.categories(id),
  planned_amount  numeric(12, 2) NOT NULL DEFAULT 0
                    CHECK (planned_amount >= 0),
  sort_order      int         NOT NULL DEFAULT 0,
  UNIQUE (budget_id, category_id)
);

CREATE INDEX idx_budget_items_budget_id ON public.budget_items(budget_id);

-- =============================================================================
-- STREAKS
-- One row per household, created by trigger when household is created
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.streaks (
  household_id          uuid  PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  current_streak        int   NOT NULL DEFAULT 0,
  longest_streak        int   NOT NULL DEFAULT 0,
  last_evaluated_month  int   CHECK (last_evaluated_month BETWEEN 1 AND 12),
  last_evaluated_year   int,
  last_success_at       timestamptz,
  last_reset_at         timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  user_id       uuid        REFERENCES public.users(id)                ON DELETE SET NULL,
  type          text        NOT NULL
                  CHECK (type IN (
                    'budget_warning',
                    'budget_exceeded',
                    'paycheck',
                    'streak_update',
                    'item_error'
                  )),
  title         text        NOT NULL,
  body          text        NOT NULL,
  metadata      jsonb,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_household_unread
  ON public.notifications(household_id, read_at, created_at DESC);
CREATE INDEX idx_notif_user_id
  ON public.notifications(user_id)
  WHERE user_id IS NOT NULL;
