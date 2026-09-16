-- Prevent a household from creating the same custom category twice (e.g. a
-- double-submit, or just forgetting they already made one). Postgres treats
-- each NULL as distinct in a UNIQUE constraint, so this only constrains
-- per-household custom categories (household_id IS NOT NULL) — system
-- categories (household_id IS NULL) are unaffected.

ALTER TABLE public.categories
  ADD CONSTRAINT categories_household_name_unique UNIQUE (household_id, name);
