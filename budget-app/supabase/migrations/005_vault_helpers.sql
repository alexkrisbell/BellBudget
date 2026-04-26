-- Store a Plaid access token in Vault; returns the secret UUID
CREATE OR REPLACE FUNCTION public.vault_store_plaid_token(p_access_token text, p_item_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_id uuid;
BEGIN
  SELECT vault.create_secret(
    p_access_token,
    'plaid_token_' || p_item_id,
    'Plaid access token for item ' || p_item_id
  ) INTO v_id;
  RETURN v_id;
END;
$$;

-- Retrieve a Plaid access token from Vault by secret UUID
CREATE OR REPLACE FUNCTION public.vault_get_plaid_token(p_secret_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  RETURN v_secret;
END;
$$;

-- Update an existing Plaid access token in Vault (for re-auth flows)
CREATE OR REPLACE FUNCTION public.vault_update_plaid_token(p_secret_id uuid, p_access_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
BEGIN
  UPDATE vault.secrets SET secret = p_access_token WHERE id = p_secret_id;
END;
$$;

-- Only the service_role should be able to call these functions
REVOKE ALL ON FUNCTION public.vault_store_plaid_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_get_plaid_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_update_plaid_token(uuid, text) FROM PUBLIC;
