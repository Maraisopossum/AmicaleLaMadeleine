-- Permet de choisir un emoji pour identifier visuellement chaque stand dans
-- la liste des stands et la grille du planning horaire (cf. maquette de
-- référence jpo-lamadeleine.netlify.app).
ALTER TABLE stands ADD COLUMN icone TEXT NOT NULL DEFAULT '📍';
