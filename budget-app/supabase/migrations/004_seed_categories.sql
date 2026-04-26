-- =============================================================================
-- Migration 004: Seed System Categories
-- Run AFTER migration 003.
-- These are shared across all households (household_id IS NULL, is_system TRUE).
-- =============================================================================

INSERT INTO public.categories
  (id, household_id, name, color, icon, is_income, is_system, sort_order)
VALUES

-- ─── Expense categories ───────────────────────────────────────────────────────

  (gen_random_uuid(), NULL, 'Rent / Mortgage',  '#3B82F6', '🏠',  false, true,  1),
  (gen_random_uuid(), NULL, 'Groceries',         '#10B981', '🛒',  false, true,  2),
  (gen_random_uuid(), NULL, 'Utilities',          '#F59E0B', '⚡',  false, true,  3),
  (gen_random_uuid(), NULL, 'Transportation',     '#8B5CF6', '🚗',  false, true,  4),
  (gen_random_uuid(), NULL, 'Dining Out',         '#EF4444', '🍽️', false, true,  5),
  (gen_random_uuid(), NULL, 'Entertainment',      '#EC4899', '🎬',  false, true,  6),
  (gen_random_uuid(), NULL, 'Shopping',           '#F97316', '🛍️', false, true,  7),
  (gen_random_uuid(), NULL, 'Health',             '#14B8A6', '❤️', false, true,  8),
  (gen_random_uuid(), NULL, 'Insurance',          '#6366F1', '🛡️', false, true,  9),
  (gen_random_uuid(), NULL, 'Subscriptions',      '#0EA5E9', '📱',  false, true, 10),
  (gen_random_uuid(), NULL, 'Travel',             '#84CC16', '✈️', false, true, 11),
  (gen_random_uuid(), NULL, 'Education',          '#A855F7', '📚',  false, true, 12),
  (gen_random_uuid(), NULL, 'Pets',               '#D97706', '🐾',  false, true, 13),
  (gen_random_uuid(), NULL, 'Personal Care',      '#DB2777', '💆',  false, true, 14),
  (gen_random_uuid(), NULL, 'Gifts',              '#F43F5E', '🎁',  false, true, 15),
  (gen_random_uuid(), NULL, 'Investments',        '#059669', '📈',  false, true, 16),
  (gen_random_uuid(), NULL, 'Other',              '#6B7280', '📦',  false, true, 17),

-- ─── Income categories ────────────────────────────────────────────────────────

  (gen_random_uuid(), NULL, 'Paycheck',           '#10B981', '💰',  true,  true, 18),
  (gen_random_uuid(), NULL, 'Freelance',          '#3B82F6', '💻',  true,  true, 19),
  (gen_random_uuid(), NULL, 'Transfer',           '#6366F1', '🔄',  true,  true, 20),
  (gen_random_uuid(), NULL, 'Other Income',       '#6B7280', '💵',  true,  true, 21)

ON CONFLICT DO NOTHING;

-- =============================================================================
-- Plaid category mapping
-- Maps Plaid's personal_finance_category primary values to our system categories.
-- Used by the categorization engine as the second priority (after rule matching).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plaid_category_map (
  plaid_primary   text PRIMARY KEY,
  category_name   text NOT NULL
);

INSERT INTO public.plaid_category_map (plaid_primary, category_name) VALUES
  ('FOOD_AND_DRINK',            'Dining Out'),
  ('GROCERIES',                 'Groceries'),
  ('HOME_IMPROVEMENT',          'Other'),
  ('MEDICAL',                   'Health'),
  ('PERSONAL_CARE',             'Personal Care'),
  ('GENERAL_MERCHANDISE',       'Shopping'),
  ('APPAREL_AND_ACCESSORIES',   'Shopping'),
  ('ENTERTAINMENT',             'Entertainment'),
  ('SPORTING_GOODS',            'Entertainment'),
  ('TRAVEL',                    'Travel'),
  ('TRANSPORTATION',            'Transportation'),
  ('RENT_AND_UTILITIES',        'Utilities'),
  ('GOVERNMENT_AND_NON_PROFIT', 'Other'),
  ('INCOME',                    'Paycheck'),
  ('TRANSFER_IN',               'Transfer'),
  ('TRANSFER_OUT',              'Transfer'),
  ('LOAN_PAYMENTS',             'Other'),
  ('BANK_FEES',                 'Other'),
  ('ENTERTAINMENT',             'Entertainment'),
  ('GENERAL_SERVICES',          'Other'),
  ('EDUCATION',                 'Education'),
  ('INSURANCE',                 'Insurance')
ON CONFLICT (plaid_primary) DO NOTHING;

-- Grant read access on plaid_category_map to authenticated users
ALTER TABLE public.plaid_category_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY plaid_map_select ON public.plaid_category_map
  FOR SELECT TO authenticated
  USING (true);
