-- Introduit un niveau de permission plus restreint que "bureau" : seul le
-- président et le compte admin (toujours le même, indépendant du rôle élu de
-- président) peuvent modifier le rôle/statut d'un membre ou en supprimer un.
-- Le reste du bureau (trésorier/secrétaire/adjoint) garde ses permissions
-- actuelles (ajouter des membres, gérer documents/cotisations/événements...).
--
-- L'email admin est en dur ici : c'est le même compte que celui derrière le
-- raccourci "admin" de l'écran de connexion (VITE_ADMIN_EMAIL côté client).
-- Il n'y a qu'un seul admin, fixe, indépendant de la composition du bureau.

CREATE OR REPLACE FUNCTION is_membre_manager(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p_email = 'benoit.degove@sdis59.fr'
    OR EXISTS (SELECT 1 FROM membres m WHERE m.email = p_email AND m.role = 'president')
$$;

-- La policy "membres_write_bureau" (FOR ALL) couvrait aussi le DELETE pour
-- tout le bureau ; on la remplace par des policies plus fines.
DROP POLICY IF EXISTS "membres_write_bureau" ON membres;

CREATE POLICY "membres_insert_bureau" ON membres
  FOR INSERT TO authenticated WITH CHECK (is_bureau(auth.jwt()->>'email'));

CREATE POLICY "membres_update_bureau" ON membres
  FOR UPDATE TO authenticated USING (is_bureau(auth.jwt()->>'email'));

CREATE POLICY "membres_delete_manager" ON membres
  FOR DELETE TO authenticated USING (is_membre_manager(auth.jwt()->>'email'));

-- Le trigger de verrouillage des champs sensibles (posé pour l'auto-édition)
-- protège aussi désormais role/statut contre une écriture par un membre du
-- bureau qui ne serait ni président ni admin.
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
    NEW.parent_id := OLD.parent_id;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
