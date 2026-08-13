-- Audit 2026-08-13 : candidatures_insert_public avait WITH CHECK(true), donc
-- un appel API direct (hors formulaire /recrutement) pouvait poser
-- traite=true à l'insertion et se soustraire au suivi du bureau. `traite`
-- n'a de sens qu'une fois le candidat recontacté par un gestionnaire — un
-- candidat public ne doit jamais pouvoir le positionner lui-même.

DROP POLICY "candidatures_insert_public" ON candidatures;

CREATE POLICY "candidatures_insert_public" ON candidatures
  FOR INSERT TO anon, authenticated WITH CHECK (traite = false);
