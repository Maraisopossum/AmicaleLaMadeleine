-- Une "réunion de bureau" ne concerne que les 6 rôles élus, pas l'ensemble
-- des membres actifs : la checklist de présence doit pouvoir se limiter à ce
-- périmètre pour éviter une longue liste d'absents hors-sujet (membres actifs
-- qui n'ont jamais vocation à assister à une réunion de bureau).

ALTER TABLE reunions ADD COLUMN bureau_uniquement BOOLEAN NOT NULL DEFAULT false;
