-- Crée le bucket Storage "documents" (public en lecture, pour les PDF/statuts)
-- et autorise le bureau à y déposer/supprimer des fichiers. Sans policy
-- explicite sur storage.objects, RLS bloque toute écriture même si le bucket
-- est marqué public (le flag "public" ne couvre que la lecture).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_bucket_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');

CREATE POLICY "documents_bucket_write_bureau" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents' AND is_bureau(auth.jwt()->>'email')
  );

CREATE POLICY "documents_bucket_update_bureau" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'documents' AND is_bureau(auth.jwt()->>'email')
  );

CREATE POLICY "documents_bucket_delete_bureau" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'documents' AND is_bureau(auth.jwt()->>'email')
  );
