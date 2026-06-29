-- Corrige une récursion infinie RLS sur `membres` : les policies "_write_bureau"
-- (FOR ALL, donc évaluées même pour un simple SELECT) interrogent la table
-- `membres` depuis une policy posée sur `membres` elle-même, ce qui provoque
-- l'erreur Postgres 42P17 "infinite recursion detected in policy for
-- relation membres" sur toute requête authentifiée.
--
-- Fix standard Supabase : déporter la vérification de rôle dans une fonction
-- SECURITY DEFINER. Exécutée avec les droits du propriétaire de la table
-- (postgres), elle contourne le RLS pour cette seule vérification interne,
-- au lieu de re-déclencher les policies de `membres`.

CREATE OR REPLACE FUNCTION public.is_bureau(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM membres m
    WHERE m.email = p_email
    AND m.role IN ('president', 'tresorier', 'secretaire', 'adjoint')
  );
$$;

DROP POLICY IF EXISTS "membres_write_bureau" ON membres;
CREATE POLICY "membres_write_bureau" ON membres
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "organigramme_write_bureau" ON organigramme;
CREATE POLICY "organigramme_write_bureau" ON organigramme
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "documents_write_bureau" ON documents;
CREATE POLICY "documents_write_bureau" ON documents
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "cotisations_write_bureau" ON cotisations;
CREATE POLICY "cotisations_write_bureau" ON cotisations
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "evenements_write_bureau" ON evenements;
CREATE POLICY "evenements_write_bureau" ON evenements
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "parametres_notifications_bureau" ON parametres_notifications;
CREATE POLICY "parametres_notifications_bureau" ON parametres_notifications
  FOR ALL TO authenticated USING (is_bureau(auth.jwt()->>'email'));
