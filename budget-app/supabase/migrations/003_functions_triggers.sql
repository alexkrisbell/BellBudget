-- =============================================================================
-- Migration 003: Functions and Triggers
-- Run AFTER migration 002.
-- =============================================================================

-- =============================================================================
-- TRIGGER 1: Sync auth.users → public.users on signup
-- Fires when Supabase Auth creates a new user (email signup, OAuth, magic link).
-- Extracts full_name from user metadata if provided.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        full_name  = CASE
                       WHEN public.users.full_name = '' THEN EXCLUDED.full_name
                       ELSE public.users.full_name
                     END,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger before re-creating (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Also sync email changes (e.g. user updates email via Supabase Auth)
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email      = NEW.email,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_updated();

-- =============================================================================
-- TRIGGER 2: Auto-update updated_at column
-- Applies to every table that has an updated_at column.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to each table with an updated_at column

DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.households;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.plaid_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.plaid_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.categorization_rules;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.transactions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.budgets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.streaks;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TRIGGER 3: Create a streak row when a household is created
-- Ensures every household always has exactly one streak row.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_household_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.streaks (household_id)
  VALUES (NEW.id)
  ON CONFLICT (household_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_household_created ON public.households;

CREATE TRIGGER on_household_created
  AFTER INSERT ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.create_household_streak();

-- =============================================================================
-- FUNCTION: Check and fire budget threshold notifications
-- Called from the application layer (sync engine) after inserting transactions.
-- Exposed as a DB function so it can be called via RPC from server-side code.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_budget_thresholds(
  p_household_id  uuid,
  p_category_id   uuid,
  p_month         int,
  p_year          int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_planned   numeric;
  v_actual    numeric;
  v_pct       numeric;
  v_budget_id uuid;
BEGIN
  -- Get planned amount
  SELECT bi.planned_amount, b.id
  INTO v_planned, v_budget_id
  FROM public.budget_items bi
  JOIN public.budgets b ON b.id = bi.budget_id
  WHERE b.household_id = p_household_id
    AND b.month = p_month
    AND b.year  = p_year
    AND NOT b.is_template
    AND bi.category_id = p_category_id
  LIMIT 1;

  IF v_planned IS NULL OR v_planned = 0 THEN
    RETURN; -- No budget set for this category, nothing to check
  END IF;

  -- Get actual spending
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_actual
  FROM public.transactions t
  WHERE t.household_id = p_household_id
    AND t.category_id  = p_category_id
    AND EXTRACT(MONTH FROM t.date) = p_month
    AND EXTRACT(YEAR  FROM t.date) = p_year
    AND NOT t.is_income
    AND NOT t.excluded
    AND NOT t.pending;

  v_pct := (v_actual / v_planned) * 100;

  -- Fire budget_exceeded notification (only once per category per month)
  IF v_pct >= 100 AND NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE household_id = p_household_id
      AND type = 'budget_exceeded'
      AND (metadata ->> 'category_id') = p_category_id::text
      AND EXTRACT(MONTH FROM created_at) = p_month
      AND EXTRACT(YEAR  FROM created_at) = p_year
  ) THEN
    INSERT INTO public.notifications (household_id, type, title, body, metadata)
    SELECT
      p_household_id,
      'budget_exceeded',
      c.name || ' budget exceeded',
      'You''ve spent ' || ROUND(v_pct) || '% of your ' || c.name || ' budget this month.',
      jsonb_build_object(
        'category_id', p_category_id,
        'pct_used',    ROUND(v_pct),
        'planned',     v_planned,
        'actual',      v_actual
      )
    FROM public.categories c
    WHERE c.id = p_category_id;

  -- Fire budget_warning notification at 80% (only once per category per month)
  ELSIF v_pct >= 80 AND v_pct < 100 AND NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE household_id = p_household_id
      AND type IN ('budget_warning', 'budget_exceeded')
      AND (metadata ->> 'category_id') = p_category_id::text
      AND EXTRACT(MONTH FROM created_at) = p_month
      AND EXTRACT(YEAR  FROM created_at) = p_year
  ) THEN
    INSERT INTO public.notifications (household_id, type, title, body, metadata)
    SELECT
      p_household_id,
      'budget_warning',
      c.name || ' at ' || ROUND(v_pct) || '%',
      'You''ve used ' || ROUND(v_pct) || '% of your ' || c.name || ' budget this month.',
      jsonb_build_object(
        'category_id', p_category_id,
        'pct_used',    ROUND(v_pct),
        'planned',     v_planned,
        'actual',      v_actual
      )
    FROM public.categories c
    WHERE c.id = p_category_id;
  END IF;
END;
$$;

-- =============================================================================
-- FUNCTION: get_dashboard_data
-- Single aggregated query for the dashboard API route.
-- Returns all data needed to render the dashboard in one RPC call.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_data(
  p_household_id  uuid,
  p_month         int,
  p_year          int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result        jsonb;
  v_total_planned numeric;
  v_total_spent   numeric;
  v_income_actual numeric;
  v_income_exp    numeric;
  v_streak        jsonb;
  v_categories    jsonb;
  v_notifications jsonb;
BEGIN
  -- Total budget planned
  SELECT COALESCE(SUM(bi.planned_amount), 0)
  INTO v_total_planned
  FROM public.budget_items bi
  JOIN public.budgets b ON b.id = bi.budget_id
  WHERE b.household_id = p_household_id
    AND b.month         = p_month
    AND b.year          = p_year
    AND NOT b.is_template;

  -- Total actual spending (non-income, non-excluded, non-pending)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_spent
  FROM public.transactions
  WHERE household_id = p_household_id
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR  FROM date) = p_year
    AND NOT is_income
    AND NOT excluded
    AND NOT pending;

  -- Actual income this month
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_income_actual
  FROM public.transactions
  WHERE household_id = p_household_id
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR  FROM date) = p_year
    AND is_income
    AND NOT excluded;

  -- Expected income from budget
  SELECT total_income_expected
  INTO v_income_exp
  FROM public.budgets
  WHERE household_id = p_household_id
    AND month         = p_month
    AND year          = p_year
    AND NOT is_template
  LIMIT 1;

  -- Categories with planned + actual
  SELECT COALESCE(jsonb_agg(cat_data ORDER BY (cat_data ->> 'sort_order')::int), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT jsonb_build_object(
      'id',         c.id,
      'name',       c.name,
      'color',      c.color,
      'icon',       c.icon,
      'sort_order', bi.sort_order,
      'planned',    bi.planned_amount,
      'actual',     COALESCE(tx.actual, 0),
      'pct',        CASE
                      WHEN bi.planned_amount = 0 THEN 0
                      ELSE ROUND((COALESCE(tx.actual, 0) / bi.planned_amount) * 100)
                    END
    ) AS cat_data
    FROM public.budget_items bi
    JOIN public.budgets b     ON b.id = bi.budget_id
    JOIN public.categories c  ON c.id = bi.category_id
    LEFT JOIN (
      SELECT category_id, SUM(amount) AS actual
      FROM public.transactions
      WHERE household_id           = p_household_id
        AND EXTRACT(MONTH FROM date) = p_month
        AND EXTRACT(YEAR  FROM date) = p_year
        AND NOT is_income
        AND NOT excluded
        AND NOT pending
      GROUP BY category_id
    ) tx ON tx.category_id = bi.category_id
    WHERE b.household_id = p_household_id
      AND b.month         = p_month
      AND b.year          = p_year
      AND NOT b.is_template
  ) sub;

  -- Streak
  SELECT jsonb_build_object(
    'current',  current_streak,
    'longest',  longest_streak,
    'on_track', v_total_spent <= v_total_planned AND v_total_planned > 0
  )
  INTO v_streak
  FROM public.streaks
  WHERE household_id = p_household_id;

  -- Unread notifications (latest 5)
  SELECT COALESCE(jsonb_agg(n ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_notifications
  FROM (
    SELECT id, type, title, body, metadata, read_at, created_at
    FROM public.notifications
    WHERE household_id = p_household_id
      AND read_at IS NULL
      AND (user_id IS NULL OR user_id = auth.uid())
    ORDER BY created_at DESC
    LIMIT 5
  ) n;

  v_result := jsonb_build_object(
    'total_budgeted',   v_total_planned,
    'total_spent',      v_total_spent,
    'total_remaining',  v_total_planned - v_total_spent,
    'pct_used',         CASE
                          WHEN v_total_planned = 0 THEN 0
                          ELSE ROUND((v_total_spent / v_total_planned) * 100)
                        END,
    'categories',       COALESCE(v_categories,    '[]'::jsonb),
    'income',           jsonb_build_object(
                          'expected', v_income_exp,
                          'actual',   v_income_actual
                        ),
    'streak',           COALESCE(v_streak, '{"current":0,"longest":0,"on_track":false}'::jsonb),
    'notifications',    COALESCE(v_notifications, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
