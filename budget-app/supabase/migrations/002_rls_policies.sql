-- =============================================================================
-- Migration 002: Row Level Security Policies
-- Run AFTER migration 001.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION
-- Returns true if auth.uid() is a member of the given household.
-- SECURITY DEFINER so it runs with the definer's privileges, preventing
-- infinite recursion when called from within RLS policies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_household_member(hid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE household_id = hid
      AND user_id      = auth.uid()
  );
$$;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS
-- Users can read their own profile plus profiles of household co-members.
-- Updates limited to own profile only.
-- Inserts are handled by the auth trigger (migration 003).
-- =============================================================================

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_members a
      JOIN   public.household_members b ON a.household_id = b.household_id
      WHERE  a.user_id = auth.uid()
        AND  b.user_id = users.id
    )
  );

CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- HOUSEHOLDS
-- Any authenticated user may create a household (onboarding).
-- Members may view and update their household.
-- Only owners may delete.
-- =============================================================================

CREATE POLICY households_select ON public.households
  FOR SELECT TO authenticated
  USING (public.is_household_member(id));

CREATE POLICY households_insert ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (public.is_household_member(id))
  WITH CHECK (public.is_household_member(id));

CREATE POLICY households_delete ON public.households
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- =============================================================================
-- HOUSEHOLD MEMBERS
-- Members can view everyone in their household.
-- All writes (invite acceptance, removal) go through service_role API routes.
-- =============================================================================

CREATE POLICY hm_select ON public.household_members
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- HOUSEHOLD INVITES
-- Members can view invites for their household (e.g. settings page).
-- Writes (create, accept) go through service_role API routes.
-- =============================================================================

CREATE POLICY invites_select ON public.household_invites
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- PLAID ITEMS
-- Members can view connected banks (status, institution name, last synced).
-- Writes (link, update cursor, status) go through service_role API routes.
-- Note: access_token_vault_id is visible but the vault secret is server-only.
-- =============================================================================

CREATE POLICY plaid_items_select ON public.plaid_items
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- ACCOUNTS
-- Members can view all accounts in their household.
-- Writes go through service_role API routes (synced from Plaid).
-- =============================================================================

CREATE POLICY accounts_select ON public.accounts
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- CATEGORIES
-- All authenticated users can view system categories (household_id IS NULL).
-- Members can view, create, update, and delete their own custom categories.
-- System categories cannot be modified or deleted.
-- =============================================================================

CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING (
    household_id IS NULL
    OR public.is_household_member(household_id)
  );

CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id IS NOT NULL
    AND public.is_household_member(household_id)
    AND is_system = false
  );

CREATE POLICY categories_update ON public.categories
  FOR UPDATE TO authenticated
  USING (
    household_id IS NOT NULL
    AND public.is_household_member(household_id)
    AND is_system = false
  )
  WITH CHECK (
    household_id IS NOT NULL
    AND public.is_household_member(household_id)
    AND is_system = false
  );

CREATE POLICY categories_delete ON public.categories
  FOR DELETE TO authenticated
  USING (
    household_id IS NOT NULL
    AND public.is_household_member(household_id)
    AND is_system = false
  );

-- =============================================================================
-- CATEGORIZATION RULES
-- Full CRUD for household members (rules are per-household).
-- =============================================================================

CREATE POLICY cat_rules_select ON public.categorization_rules
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY cat_rules_insert ON public.categorization_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY cat_rules_update ON public.categorization_rules
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY cat_rules_delete ON public.categorization_rules
  FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- TRANSACTIONS
-- Members can view all household transactions.
-- All writes (sync, category update) go through service_role API routes.
-- =============================================================================

CREATE POLICY tx_select ON public.transactions
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- BUDGETS
-- Full CRUD for household members.
-- =============================================================================

CREATE POLICY budgets_select ON public.budgets
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY budgets_insert ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY budgets_update ON public.budgets
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY budgets_delete ON public.budgets
  FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- BUDGET ITEMS
-- Access is gated on the parent budget's household membership.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.budget_item_household_check(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.budgets b
    JOIN public.household_members hm ON hm.household_id = b.household_id
    WHERE b.id = bid
      AND hm.user_id = auth.uid()
  );
$$;

CREATE POLICY budget_items_select ON public.budget_items
  FOR SELECT TO authenticated
  USING (public.budget_item_household_check(budget_id));

CREATE POLICY budget_items_insert ON public.budget_items
  FOR INSERT TO authenticated
  WITH CHECK (public.budget_item_household_check(budget_id));

CREATE POLICY budget_items_update ON public.budget_items
  FOR UPDATE TO authenticated
  USING (public.budget_item_household_check(budget_id))
  WITH CHECK (public.budget_item_household_check(budget_id));

CREATE POLICY budget_items_delete ON public.budget_items
  FOR DELETE TO authenticated
  USING (public.budget_item_household_check(budget_id));

-- =============================================================================
-- STREAKS
-- Members can view their household streak.
-- Updates go through service_role API routes (cron evaluation).
-- =============================================================================

CREATE POLICY streaks_select ON public.streaks
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- =============================================================================
-- NOTIFICATIONS
-- Members can view notifications for their household
-- (both targeted user_id notifications and broadcast user_id = NULL ones).
-- Members can update (mark as read) any notification in their household.
-- Inserts go through service_role API routes.
-- =============================================================================

CREATE POLICY notif_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_household_member(household_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY notif_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
