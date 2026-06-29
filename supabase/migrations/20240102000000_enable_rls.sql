-- Active RLS sur toutes les tables et pose des policies de base.
-- Sans RLS, la clé anon publique (embarquée dans le bundle JS) donne un accès
-- total en lecture/écriture à toutes les tables via l'API REST de Supabase.

ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE organigramme ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametres_notifications ENABLE ROW LEVEL SECURITY;

-- membres : lecture réservée aux membres connectés (pas d'accès anonyme aux
-- emails) ; écriture réservée au bureau.
CREATE POLICY "membres_select_authenticated" ON membres
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "membres_write_bureau" ON membres
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );

-- organigramme : public en lecture (page d'accueil sans auth), écriture bureau.
CREATE POLICY "organigramme_select_public" ON organigramme
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "organigramme_write_bureau" ON organigramme
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );

-- documents : lecture réservée aux membres connectés, écriture bureau.
CREATE POLICY "documents_select_authenticated" ON documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "documents_write_bureau" ON documents
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );

-- cotisations : données financières, réservées aux membres connectés en
-- lecture, écriture bureau uniquement.
CREATE POLICY "cotisations_select_authenticated" ON cotisations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cotisations_write_bureau" ON cotisations
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );

-- evenements : lecture réservée aux membres connectés, écriture bureau.
CREATE POLICY "evenements_select_authenticated" ON evenements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "evenements_write_bureau" ON evenements
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );

-- parametres_notifications : configuration interne, bureau uniquement.
CREATE POLICY "parametres_notifications_bureau" ON parametres_notifications
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM membres m
      WHERE m.email = auth.jwt()->>'email'
      AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
    )
  );
