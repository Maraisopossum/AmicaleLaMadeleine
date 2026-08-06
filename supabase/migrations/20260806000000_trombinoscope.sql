-- Trombinoscope : photo de profil optionnelle par membre. Upload réservé à
-- canManageMembres (président + admin fixe), même périmètre que le
-- changement de rôle/statut d'un membre (cf. 20240111000000_membres_gestionnaire.sql).
-- Utilise la même RPC is_membre_manager() que le reste des actions sensibles
-- sur la fiche membre, pour rester alignée avec AuthContext.canManageMembres.

ALTER TABLE membres ADD COLUMN photo_url TEXT;

-- La policy RLS "membres_update_bureau" autorise tout le bureau (is_bureau,
-- plus large) à faire un UPDATE sur la ligne membres. Sans ça, un membre du
-- bureau qui n'est ni président ni admin pourrait écrire n'importe quelle URL
-- dans photo_url malgré la policy Storage restreignant l'upload lui-même à
-- canManageMembres. On étend donc le verrouillage déjà en place pour
-- role/statut/email (cf. 20240111000000_membres_gestionnaire.sql) à photo_url.
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
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos-membres', 'photos-membres', true, 2097152, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "photos_membres_bucket_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'photos-membres');

CREATE POLICY "photos_membres_bucket_write_manager" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos-membres' AND is_membre_manager(auth.jwt()->>'email')
  );

CREATE POLICY "photos_membres_bucket_update_manager" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'photos-membres' AND is_membre_manager(auth.jwt()->>'email')
  );

CREATE POLICY "photos_membres_bucket_delete_manager" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'photos-membres' AND is_membre_manager(auth.jwt()->>'email')
  );
