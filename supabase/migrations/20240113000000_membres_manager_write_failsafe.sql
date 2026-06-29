-- Bug : la policy "membres_update_bureau" ne s'appuyait que sur is_bureau(),
-- qui dépend du rôle ACTUEL du membre dans la table. Si le compte admin
-- (ou le président) n'a plus, à un instant donné, un rôle de bureau valide
-- (ex: démotion accidentelle pendant une réorganisation), il perd alors le
-- droit d'écrire sur la table membres — y compris pour SE corriger lui-même.
-- Résultat observé : clic sans aucun effet, sans erreur (RLS filtre la ligne
-- silencieusement, 0 ligne affectée, pas d'erreur Postgres).
--
-- Le gestionnaire (is_membre_manager : président OU le compte admin fixe) doit
-- pouvoir écrire en toutes circonstances, même si son propre rôle est cassé.

DROP POLICY IF EXISTS "membres_insert_bureau" ON membres;
DROP POLICY IF EXISTS "membres_update_bureau" ON membres;

CREATE POLICY "membres_insert_bureau" ON membres
  FOR INSERT TO authenticated WITH CHECK (
    is_bureau(auth.jwt()->>'email') OR is_membre_manager(auth.jwt()->>'email')
  );

CREATE POLICY "membres_update_bureau" ON membres
  FOR UPDATE TO authenticated USING (
    is_bureau(auth.jwt()->>'email') OR is_membre_manager(auth.jwt()->>'email')
  );
