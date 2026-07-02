-- Ajoute un nombre maximum de choix pour les questions de type choix_multiple.
-- NULL = pas de limite.
ALTER TABLE vote_questions ADD COLUMN max_choix INTEGER CHECK (max_choix IS NULL OR max_choix >= 1);
