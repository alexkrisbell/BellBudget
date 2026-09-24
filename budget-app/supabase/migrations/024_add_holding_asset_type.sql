-- Distinguishes option contracts from equities/ETFs so the UI can label
-- units correctly ("contracts" vs "sh") and show short positions clearly
-- instead of a bare negative quantity, which reads like a bug.

ALTER TABLE public.investment_holdings
  ADD COLUMN asset_type text;
