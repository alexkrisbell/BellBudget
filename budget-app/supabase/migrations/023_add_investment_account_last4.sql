-- Schwab's account "type" (e.g. "IRA") isn't unique per household — two Roth
-- IRAs both show as "IRA" with nothing to tell them apart (Plaid accounts
-- don't have this problem since Plaid returns a human-readable account name
-- directly). Schwab's own account number IS available via
-- /accounts/accountNumbers (not just the encrypted hashValue used for API
-- calls), so store just the last 4 digits for display.

ALTER TABLE public.investment_accounts
  ADD COLUMN last4 text;
