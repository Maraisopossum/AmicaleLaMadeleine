-- Remplace l'invitation/réinitialisation par email (limitée par le quota horaire
-- du SMTP intégré de Supabase) par un mot de passe temporaire attribué par le
-- bureau : le membre doit le changer à sa première connexion.
--
-- 1) Colonne doit_changer_mdp : true tant que le membre n'a pas changé le mot
--    de passe temporaire qui lui a été attribué.
-- 2) La colonne rejoint la liste verrouillée par le trigger de
--    20240110000000_membres_self_update.sql : un membre ne peut pas l'écrire
--    directement, seul le bureau (via l'edge function, clé service_role) le
--    passe à true.
-- 3) RPC clear_doit_changer_mdp() : SECURITY DEFINER, appelée par le membre
--    connecté juste après un changement de mot de passe réussi
--    (supabase.auth.updateUser) pour lever le flag sur sa propre ligne.

ALTER TABLE membres ADD COLUMN doit_changer_mdp boolean NOT NULL DEFAULT false;

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
    NEW.doit_changer_mdp := OLD.doit_changer_mdp;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION clear_doit_changer_mdp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE membres
  SET doit_changer_mdp = false
  WHERE email = auth.jwt()->>'email';
END;
$$;

GRANT EXECUTE ON FUNCTION clear_doit_changer_mdp() TO authenticated;
