-- Remplace l'organigramme à hiérarchie libre (parent_id + drag&drop) par une
-- structure fixe à 3 branches, chacune avec un titulaire et un adjoint dédié :
--   Président      / Adjoint au Président
--   Secrétaire     / Adjoint au Secrétaire
--   Trésorier      / Adjoint au Trésorier
-- Le rôle générique "adjoint" ne permettait pas de savoir de quelle branche
-- il dépendait ; on le scinde en 3 valeurs distinctes.

-- 1) On retire d'abord l'ancienne contrainte (qui n'autorise que 'adjoint')
--    pour pouvoir migrer les données existantes sans qu'elle ne bloque.
ALTER TABLE membres DROP CONSTRAINT IF EXISTS membres_role_check;

-- 2) Migration des données existantes : les "adjoint" actuels sont rattachés
--    par défaut à la branche Président — à réassigner manuellement ensuite
--    depuis Membres ou Organigramme si besoin.
UPDATE membres SET role = 'adjoint_president' WHERE role = 'adjoint';

-- 3) Nouvelle contrainte CHECK, une fois les données conformes.
ALTER TABLE membres ADD CONSTRAINT membres_role_check CHECK (
  role IN (
    'president', 'secretaire', 'tresorier',
    'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier',
    'membre_actif', 'membre_passif', 'membre_honoraire'
  )
);

-- 4) is_bureau() doit reconnaître les 3 nouveaux rôles d'adjoint.
CREATE OR REPLACE FUNCTION public.is_bureau(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM membres m
    WHERE m.email = p_email
    AND m.role IN ('president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier')
  );
$$;

-- 5) Chacun des 6 postes nommés ne peut être occupé que par un seul membre à
--    la fois (l'appli démet l'ancien titulaire avant de promouvoir le nouveau,
--    mais l'index protège aussi contre une écriture concurrente/directe).
CREATE UNIQUE INDEX membres_poste_unique ON membres(role) WHERE role IN (
  'president', 'secretaire', 'tresorier',
  'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier'
);

-- 6) parent_id/ordre ne servent plus (hiérarchie désormais fixe) ; on les
--    retire pour ne pas garder un état mort.
ALTER TABLE membres DROP COLUMN IF EXISTS parent_id;
ALTER TABLE membres DROP COLUMN IF EXISTS ordre;
