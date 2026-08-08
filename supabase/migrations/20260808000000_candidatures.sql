-- Module Candidatures : lead capture depuis le quiz public de recrutement
-- (/recrutement, accessible par QR code sur les JPO). Écriture ouverte à
-- tous (anon inclus, le candidat n'a pas de compte) ; lecture réservée à
-- l'admin fixe + aux membres explicitement désignés via
-- membres.acces_candidatures (pas tout le bureau : données personnelles de
-- tiers, dont une auto-déclaration sensible casier judiciaire/droits
-- civiques dans `reponses`).

ALTER TABLE membres ADD COLUMN acces_candidatures BOOLEAN NOT NULL DEFAULT false;

-- Étend le verrouillage des champs sensibles (déjà en place pour
-- role/statut/email/photo_url) à ce nouveau flag de permission : seul
-- canManageMembres (président/admin) peut désigner qui a accès aux
-- candidatures, pas le membre lui-même ni le reste du bureau.
CREATE OR REPLACE FUNCTION lock_sensitive_membre_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_membre_manager(auth.jwt()->>'email') THEN
    NEW.role := OLD.role;
    NEW.statut := OLD.statut;
    NEW.email := OLD.email;
    NEW.a_un_compte := OLD.a_un_compte;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.parent_id := OLD.parent_id;
    NEW.photo_url := OLD.photo_url;
    NEW.acces_candidatures := OLD.acces_candidatures;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_candidature_manager(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p_email = 'benoit.degove@sdis59.fr'
    OR EXISTS (SELECT 1 FROM membres m WHERE m.email = p_email AND m.acces_candidatures = true)
$$;

CREATE TABLE candidatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  reponses JSONB NOT NULL DEFAULT '{}',
  statut_eligibilite TEXT NOT NULL CHECK (statut_eligibilite IN ('eligible', 'a_verifier', 'pas_encore')),
  traite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;

-- Le formulaire public (candidat sans compte) doit pouvoir écrire.
CREATE POLICY "candidatures_insert_public" ON candidatures
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "candidatures_select_manager" ON candidatures
  FOR SELECT TO authenticated USING (is_candidature_manager(auth.jwt() ->> 'email'));

CREATE POLICY "candidatures_update_manager" ON candidatures
  FOR UPDATE TO authenticated USING (is_candidature_manager(auth.jwt() ->> 'email'));

CREATE POLICY "candidatures_delete_manager" ON candidatures
  FOR DELETE TO authenticated USING (is_candidature_manager(auth.jwt() ->> 'email'));
