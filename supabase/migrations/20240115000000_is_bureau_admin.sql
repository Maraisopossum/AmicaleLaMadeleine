-- is_bureau() ne reconnaissait que les rôles élus du bureau (membres.role),
-- pas le compte admin fixe (déjà géré séparément par is_membre_manager(), cf.
-- 20240111000000_membres_gestionnaire.sql). Conséquence : connecté via le
-- raccourci "admin" de l'écran de connexion, on perdait tous les droits
-- d'écriture posés sur is_bureau() (événements, stands, documents...) si ce
-- compte n'a pas de ligne membres avec un rôle de bureau.

CREATE OR REPLACE FUNCTION public.is_bureau(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p_email = 'benoit.degove@sdis59.fr'
    OR EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = p_email
      AND m.role IN ('president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier')
    )
$$;
