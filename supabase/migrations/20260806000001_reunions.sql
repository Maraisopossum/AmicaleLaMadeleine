-- Module Réunions : compte-rendu (CR) de réunions/AG, indépendant du
-- Calendrier (pas de lien à evenements). Le bureau rédige en 'brouillon',
-- publie quand relu ; une fois publié, tout membre authentifié peut le lire
-- (même principe de transparence que le module votes). Sections fixes
-- (ordre du jour, décisions, prochaines échéances) + sections libres en JSON
-- pour rester flexible sans devoir migrer le schéma à chaque besoin.
-- La dictée vocale (Web Speech API) et la mise en forme se font entièrement
-- côté client — aucune donnée audio n'est stockée ni envoyée à un service
-- tiers, seul le texte transcrit est enregistré dans les colonnes ci-dessous.

CREATE TABLE reunions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  date_reunion DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie')),
  ordre_du_jour TEXT,
  decisions TEXT,
  prochaines_echeances TEXT,
  sections_libres JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Présences importées depuis la liste des membres actifs : un membre par
-- ligne, statut par défaut 'absent' côté application (le secrétaire coche
-- présent/excusé pendant la réunion).
CREATE TABLE reunion_presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'absent' CHECK (statut IN ('present', 'excuse', 'absent')),
  UNIQUE (reunion_id, membre_id)
);

CREATE INDEX ON reunion_presences (reunion_id);

ALTER TABLE reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunion_presences ENABLE ROW LEVEL SECURITY;

-- reunions : le bureau voit tout (y compris les brouillons) ; les autres
-- membres ne voient que les CR publiés.
CREATE POLICY "reunions_select" ON reunions
  FOR SELECT TO authenticated USING (
    statut = 'publie' OR is_bureau(auth.jwt() ->> 'email')
  );

CREATE POLICY "reunions_insert" ON reunions
  FOR INSERT TO authenticated WITH CHECK (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "reunions_update" ON reunions
  FOR UPDATE TO authenticated USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "reunions_delete" ON reunions
  FOR DELETE TO authenticated USING (is_bureau(auth.jwt() ->> 'email'));

-- reunion_presences suit la même visibilité que la réunion parente.
CREATE POLICY "reunion_presences_select" ON reunion_presences
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM reunions r
      WHERE r.id = reunion_id AND (r.statut = 'publie' OR is_bureau(auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "reunion_presences_write_bureau" ON reunion_presences
  FOR ALL TO authenticated USING (is_bureau(auth.jwt() ->> 'email'));
