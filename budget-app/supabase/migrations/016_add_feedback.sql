-- In-app feedback/support channel — a simple way for people who aren't
-- family to report a bug or ask a question (CLAUDE.md Phase 1).
--
-- Writes are service-role only (same trust model as `transactions`): no
-- policies beyond RLS being enabled, since nobody needs to read or edit
-- their own submissions in-app. The founder reads these directly in
-- Supabase.

CREATE TABLE IF NOT EXISTS public.feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        REFERENCES public.households(id) ON DELETE SET NULL,
  user_id      uuid        REFERENCES public.users(id)      ON DELETE SET NULL,
  message      text        NOT NULL,
  page_path    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
