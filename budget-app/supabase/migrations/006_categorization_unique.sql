-- Unique constraint so we can upsert rules by (household, keyword)
ALTER TABLE public.categorization_rules
  ADD CONSTRAINT categorization_rules_household_keyword_unique
  UNIQUE (household_id, merchant_keyword);
