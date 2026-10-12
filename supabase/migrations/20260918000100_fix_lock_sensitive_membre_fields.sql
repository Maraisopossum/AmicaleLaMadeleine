-- Bug : lock_sensitive_membre_fields() recopiait NEW.parent_id := OLD.parent_id,
-- or la colonne parent_id n'existe plus sur membres (supprimée avec
-- l'organigramme à hiérarchie libre, 20240112000000). Résultat : tout UPDATE
-- de membres par un non-gestionnaire levait "record new has no field
-- parent_id" — dont clear_doit_changer_mdp(), appelée après le changement du
-- mot de passe temporaire, qui échouait donc silencieusement (le flag
-- doit_changer_mdp restait à true et la page Mon compte semblait figée), et
-- la modification du prénom/nom depuis Mon compte.
--
-- Corrige aussi une régression : doit_changer_mdp avait disparu de la liste
-- verrouillée lors de redéfinitions ultérieures de la fonction, un membre
-- pouvait donc réécrire ce flag directement.
CREATE OR REPLACE FUNCTION lock_sensitive_membre_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_membre_manager(auth.jwt()->>'email') THEN
    NEW.role := OLD.role;
    NEW.statut := OLD.statut;
    NEW.email := OLD.email;
    NEW.a_un_compte := OLD.a_un_compte;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.photo_url := OLD.photo_url;
    NEW.acces_candidatures := OLD.acces_candidatures;
    NEW.est_barman := OLD.est_barman;
    NEW.doit_changer_mdp := OLD.doit_changer_mdp;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Le verrou sur doit_changer_mdp empêchait aussi la RPC de le lever (le
-- trigger ne distingue pas l'appelant "membre" de l'appelant "RPC"). La RPC
-- pose donc un indicateur local à la transaction que le trigger reconnaît ;
-- un client ne peut pas poser cet indicateur lui-même (pas de set_config
-- exposé par PostgREST).
CREATE OR REPLACE FUNCTION lock_sensitive_membre_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_membre_manager(auth.jwt()->>'email') THEN
    NEW.role := OLD.role;
    NEW.statut := OLD.statut;
    NEW.email := OLD.email;
    NEW.a_un_compte := OLD.a_un_compte;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.photo_url := OLD.photo_url;
    NEW.acces_candidatures := OLD.acces_candidatures;
    NEW.est_barman := OLD.est_barman;
    IF COALESCE(current_setting('app.clearing_doit_changer_mdp', true), '') <> 'on' THEN
      NEW.doit_changer_mdp := OLD.doit_changer_mdp;
    END IF;
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
  PERFORM set_config('app.clearing_doit_changer_mdp', 'on', true);
  UPDATE membres
  SET doit_changer_mdp = false
  WHERE email = auth.jwt()->>'email';
END;
$$;
