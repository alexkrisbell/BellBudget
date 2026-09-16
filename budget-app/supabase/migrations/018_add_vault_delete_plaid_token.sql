-- Add a way to actually clean up a Plaid access token from Vault once an
-- Item is removed. Previously tokens were only ever created/read/updated —
-- disconnecting an account (or deleting a household) left the encrypted
-- secret orphaned in vault.secrets forever.

CREATE OR REPLACE FUNCTION public.vault_delete_plaid_token(p_secret_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_delete_plaid_token(uuid) FROM PUBLIC;
