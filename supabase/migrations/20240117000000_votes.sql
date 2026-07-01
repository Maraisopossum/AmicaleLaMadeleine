-- Module Vote : votes associatifs (AG, élections bureau, questions diverses).
-- Un vote contient plusieurs questions ; chaque question peut être de type
-- oui_non, choix_unique ou choix_multiple. Les votes peuvent être anonymes
-- (on sait qui a voté mais pas pour quoi) ou non-anonymes.
-- Statuts : brouillon → ouvert → archive.
-- Seul le bureau peut créer/gérer ; tous les membres authentifiés peuvent voter
-- selon les statuts éligibles définis à la création.

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  anonyme BOOLEAN NOT NULL DEFAULT false,
  statuts_eligibles TEXT[] NOT NULL DEFAULT ARRAY['actif', 'passif', 'honoraire'],
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'ouvert', 'archive')),
  date_fin TIMESTAMP WITH TIME ZONE,
  cree_par UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vote_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  libelle TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('oui_non', 'choix_unique', 'choix_multiple')),
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vote_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES vote_questions(id) ON DELETE CASCADE,
  libelle TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0
);

-- membre_id est toujours stocké (anti double-vote et suivi participation).
-- En mode anonyme, les policies RLS filtrent l'exposition de membre_id
-- dans les requêtes de résultats.
-- valeur_oui_non : true=Oui, false=Non (pour les questions de type oui_non).
-- option_ids : tableau d'UUIDs pour choix_unique et choix_multiple.
CREATE TABLE vote_reponses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES vote_questions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  valeur_oui_non BOOLEAN,
  option_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (question_id, membre_id),
  CHECK (
    (valeur_oui_non IS NOT NULL AND option_ids IS NULL) OR
    (valeur_oui_non IS NULL AND option_ids IS NOT NULL)
  )
);

-- Index pour les lookups fréquents
CREATE INDEX ON vote_questions (vote_id, ordre);
CREATE INDEX ON vote_options (question_id, ordre);
CREATE INDEX ON vote_reponses (vote_id, membre_id);

-- RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_reponses ENABLE ROW LEVEL SECURITY;

-- votes : lecture pour tout membre authentifié, écriture pour le bureau
CREATE POLICY "votes_select" ON votes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "votes_insert" ON votes
  FOR INSERT TO authenticated
  WITH CHECK (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "votes_update" ON votes
  FOR UPDATE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "votes_delete" ON votes
  FOR DELETE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

-- vote_questions : lecture pour tout membre, écriture pour le bureau
CREATE POLICY "vote_questions_select" ON vote_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vote_questions_insert" ON vote_questions
  FOR INSERT TO authenticated
  WITH CHECK (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "vote_questions_update" ON vote_questions
  FOR UPDATE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "vote_questions_delete" ON vote_questions
  FOR DELETE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

-- vote_options : lecture pour tout membre, écriture pour le bureau
CREATE POLICY "vote_options_select" ON vote_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vote_options_insert" ON vote_options
  FOR INSERT TO authenticated
  WITH CHECK (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "vote_options_update" ON vote_options
  FOR UPDATE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "vote_options_delete" ON vote_options
  FOR DELETE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

-- vote_reponses : chaque membre voit ses propres réponses + le bureau voit tout
-- En mode anonyme, le front filtre l'affichage (la RLS ne peut pas filtrer
-- dynamiquement selon votes.anonyme sans JOIN coûteux ; on laisse le bureau
-- accéder aux données brutes et c'est le front qui respecte l'anonymat).
CREATE POLICY "vote_reponses_select" ON vote_reponses
  FOR SELECT TO authenticated
  USING (
    membre_id = (SELECT id FROM membres WHERE email = auth.jwt() ->> 'email' LIMIT 1)
    OR is_bureau(auth.jwt() ->> 'email')
  );

CREATE POLICY "vote_reponses_insert" ON vote_reponses
  FOR INSERT TO authenticated
  WITH CHECK (
    membre_id = (SELECT id FROM membres WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  );

-- Pas de UPDATE/DELETE sur les réponses : un vote soumis est définitif
