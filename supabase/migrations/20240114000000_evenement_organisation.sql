-- Module "Organisation" pour les événements à page dédiée (type JPO) :
-- stands tenus par des bénévoles, deadlines de préparation, planning horaire
-- d'affectation. Un membre peut être désigné "gestionnaire" d'un stand
-- (stands.responsable_id) : il peut alors modifier ce stand et gérer ses
-- deadlines/affectations sans être du bureau. Le bureau garde la main sur
-- tout (création/suppression de stands, deadlines globales).

CREATE TABLE evenement_organisation (
  evenement_id UUID PRIMARY KEY REFERENCES evenements(id) ON DELETE CASCADE,
  heure_debut TIME NOT NULL DEFAULT '09:00',
  heure_fin TIME NOT NULL DEFAULT '18:00',
  duree_creneau_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  responsable_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id UUID NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  stand_id UUID REFERENCES stands(id) ON DELETE CASCADE,
  libelle TEXT NOT NULL,
  date_echeance DATE NOT NULL,
  fait BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Une ligne = une personne affectée à un créneau d'un stand. La grille
-- (heures de début/fin, durée du créneau) est définie une fois par
-- evenement_organisation ; chaque créneau de la grille peut accueillir
-- plusieurs affectations (binôme sur un même stand).
CREATE TABLE affectations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  membre_id UUID REFERENCES membres(id) ON DELETE CASCADE,
  nom_libre TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (membre_id IS NOT NULL OR nom_libre IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.is_stand_manager(p_email text, p_stand_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM stands s
    JOIN membres m ON m.id = s.responsable_id
    WHERE s.id = p_stand_id AND m.email = p_email
  );
$$;

ALTER TABLE evenement_organisation ENABLE ROW LEVEL SECURITY;
ALTER TABLE stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE affectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evenement_organisation_select" ON evenement_organisation
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "evenement_organisation_write_bureau" ON evenement_organisation
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

CREATE POLICY "stands_select" ON stands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stands_insert_bureau" ON stands
  FOR INSERT TO authenticated WITH CHECK (is_bureau(auth.jwt()->>'email'));
CREATE POLICY "stands_delete_bureau" ON stands
  FOR DELETE TO authenticated USING (is_bureau(auth.jwt()->>'email'));
CREATE POLICY "stands_update_bureau_ou_responsable" ON stands
  FOR UPDATE TO authenticated USING (
    is_bureau(auth.jwt()->>'email') OR is_stand_manager(auth.jwt()->>'email', id)
  );

CREATE POLICY "deadlines_select" ON deadlines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "deadlines_write_bureau_ou_responsable" ON deadlines
  FOR ALL TO authenticated USING (
    is_bureau(auth.jwt()->>'email')
    OR (stand_id IS NOT NULL AND is_stand_manager(auth.jwt()->>'email', stand_id))
  );

CREATE POLICY "affectations_select" ON affectations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "affectations_write_bureau_ou_responsable" ON affectations
  FOR ALL TO authenticated USING (
    is_bureau(auth.jwt()->>'email') OR is_stand_manager(auth.jwt()->>'email', stand_id)
  );
