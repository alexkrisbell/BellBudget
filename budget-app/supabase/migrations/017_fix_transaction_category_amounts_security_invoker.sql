-- Fix: transaction_category_amounts was created without security_invoker,
-- so it defaulted to running with the view OWNER's privileges rather than
-- the querying user's. That means RLS on the underlying transactions/
-- transaction_splits tables was never actually enforced by the view itself
-- — only by the app always adding a `.eq('household_id', ...)` filter in
-- lib/categoryActuals.ts. Anyone querying this view directly (e.g. via the
-- Supabase REST API with just a valid session, bypassing the app) could see
-- every household's data, not just their own.
--
-- security_invoker makes the view check RLS as the querying role for every
-- underlying table it reads, which is what should have been set from the
-- start — RLS is meant to be a backstop that doesn't depend on application
-- code always adding the right filter.

ALTER VIEW public.transaction_category_amounts SET (security_invoker = true);
