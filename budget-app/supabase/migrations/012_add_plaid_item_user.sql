-- =============================================================================
-- Migration 012: Track which household member connected each Plaid item
-- =============================================================================

ALTER TABLE public.plaid_items
  ADD COLUMN IF NOT EXISTS connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plaid_items_connected_by ON public.plaid_items(connected_by_user_id);
