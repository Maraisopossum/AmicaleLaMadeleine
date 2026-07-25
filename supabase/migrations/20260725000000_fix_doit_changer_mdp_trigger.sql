CREATE OR REPLACE FUNCTION lock_sensitive_membre_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_bureau(auth.jwt()->>'email') THEN
    NEW.role := OLD.role;
    NEW.statut := OLD.statut;
    NEW.email := OLD.email;
    NEW.a_un_compte := OLD.a_un_compte;
    NEW.auth_user_id := OLD.auth_user_id;
    IF NEW.doit_changer_mdp = true THEN
      NEW.doit_changer_mdp := OLD.doit_changer_mdp;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
