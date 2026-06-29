-- 1) Hiérarchie du bureau : rattachement libre (qui dépend de qui) pour
--    dessiner l'organigramme avec drag & drop. Concerne uniquement les
--    postes du bureau (president/tresorier/secretaire/adjoint) ; les
--    membres simples restent à plat.
ALTER TABLE membres ADD COLUMN parent_id UUID REFERENCES membres(id) ON DELETE SET NULL;
ALTER TABLE membres ADD COLUMN ordre INTEGER NOT NULL DEFAULT 0;

-- 2) L'organigramme n'est plus public : on retire l'accès anonyme à la vue
--    qui servait la page d'accueil publique. Les colonnes sensibles (email)
--    restent de toute façon protégées par la policy "membres_select_authenticated".
REVOKE SELECT ON membres_public FROM anon;
