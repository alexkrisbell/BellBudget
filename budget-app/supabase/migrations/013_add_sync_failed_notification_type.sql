-- Add 'sync_failed' as a valid notification type, for surfacing a full
-- Plaid transactionsSync failure (distinct from 'item_error', which means
-- the connection needs to be re-authenticated by the user).

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
    'sync_failed'
  ));
