-- Permet à un événement (typiquement une journée portes ouvertes) d'avoir sa
-- propre page dédiée, composée de sections activables parmi une liste de
-- types prédéfinis. v1 : "programme" (liste d'horaires) et "infos_pratiques"
-- (texte libre). D'autres types (stands, bénévoles...) pourront être ajoutés
-- plus tard sans changer la structure.

ALTER TABLE evenements ADD COLUMN page_dediee BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE evenement_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('programme', 'infos_pratiques')),
  ordre INTEGER NOT NULL DEFAULT 0,
  contenu JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (evenement_id, type)
);

ALTER TABLE evenement_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evenement_sections_select_authenticated" ON evenement_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "evenement_sections_write_bureau" ON evenement_sections
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));
