-- Module To-do list du bureau : suivi des tâches hors événements
-- ("lancer les cotisations", "écrire un mail"...). Le responsable (qui gère)
-- et le réalisateur (qui a effectivement fait) peuvent chacun être un membre
-- existant ou un nom libre, sur le même principe que les affectations de
-- créneaux du module Organisation d'événement.
-- Réservé au bureau (lecture, création, mise à jour, suppression) : la
-- to-do list n'est pas un module visible des membres simples.

CREATE TABLE taches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'fait', 'annulee')),
  responsable_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  responsable_nom_libre TEXT,
  realisateur_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  realisateur_nom_libre TEXT,
  deadline DATE,
  date_realisation DATE,
  created_by UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (responsable_id IS NULL OR responsable_nom_libre IS NULL),
  CHECK (realisateur_id IS NULL OR realisateur_nom_libre IS NULL)
);

CREATE INDEX ON taches (statut);

ALTER TABLE taches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taches_select" ON taches
  FOR SELECT TO authenticated USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "taches_insert" ON taches
  FOR INSERT TO authenticated
  WITH CHECK (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "taches_update" ON taches
  FOR UPDATE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));

CREATE POLICY "taches_delete" ON taches
  FOR DELETE TO authenticated
  USING (is_bureau(auth.jwt() ->> 'email'));
