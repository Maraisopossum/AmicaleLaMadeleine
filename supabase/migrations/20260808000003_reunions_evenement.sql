-- Lien optionnel entre une réunion (CR) et l'événement de Calendrier dont
-- elle est issue (type 'ag'/'reunion'). Un événement n'a au plus un CR lié
-- (contrainte unique) ; une réunion reste utilisable sans événement (créée
-- depuis /reunions directement), donc la colonne reste nullable.

ALTER TABLE reunions ADD COLUMN evenement_id UUID REFERENCES evenements(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX reunions_evenement_id_unique ON reunions(evenement_id) WHERE evenement_id IS NOT NULL;
