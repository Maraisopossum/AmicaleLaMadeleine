-- Suivi de l'existence d'un compte de connexion (Supabase Auth) par membre.
-- Mis à jour par l'Edge Function create-membre-access après création du compte ;
-- la clé anon (RLS) ne peut pas lister auth.users pour le déduire elle-même.

ALTER TABLE membres ADD COLUMN a_un_compte BOOLEAN NOT NULL DEFAULT false;
