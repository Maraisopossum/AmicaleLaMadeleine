-- Élargit la gestion des membres (modifier rôle/statut, supprimer, attribuer
-- ou réinitialiser un accès, désigner barmans/accès candidatures) à tout le
-- bureau, au lieu du seul président + compte admin fixe. is_membre_manager()
-- reste l'unique source de vérité (policies RLS, trigger de verrouillage,
-- edge function create-membre-access) : un seul changement ici suffit.
CREATE OR REPLACE FUNCTION is_membre_manager(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT is_bureau(p_email)
$$;
