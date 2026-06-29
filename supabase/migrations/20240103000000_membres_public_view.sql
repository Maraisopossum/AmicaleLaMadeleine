-- RLS est row-level, pas column-level : pour exposer publiquement le nom/role
-- d'un membre sur la page d'accueil sans exposer son email, on passe par une
-- vue qui ne projette que les colonnes non sensibles.

CREATE VIEW membres_public AS
SELECT id, prenom, nom, role, statut, date_nomination
FROM membres;

GRANT SELECT ON membres_public TO anon, authenticated;
