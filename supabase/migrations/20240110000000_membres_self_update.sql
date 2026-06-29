-- Permet à un membre connecté de modifier sa propre ligne dans `membres`
-- (pour "Mon compte" → modifier prénom/nom), sans lui donner les moyens de
-- s'auto-promouvoir (role/statut/email/accès/hiérarchie).
--
-- 1) Policy RLS : un membre peut UPDATE sa propre ligne (email = son JWT).
-- 2) Trigger : si l'appelant n'est pas du bureau (et n'est pas le service_role,
--    utilisé par l'Edge Function), on verrouille les colonnes sensibles à leur
--    valeur précédente avant l'écriture, quelle que soit la requête envoyée.

CREATE POLICY "membres_update_self" ON membres
  FOR UPDATE TO authenticated USING (email = auth.jwt()->>'email');

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
    NEW.parent_id := OLD.parent_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_sensitive_membre_fields
  BEFORE UPDATE ON membres
  FOR EACH ROW EXECUTE FUNCTION lock_sensitive_membre_fields();
