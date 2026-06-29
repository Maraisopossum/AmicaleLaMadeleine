-- Stocke l'id de l'utilisateur Supabase Auth créé par l'Edge Function
-- create-membre-access, pour pouvoir réinitialiser son mot de passe plus tard
-- (auth.admin.updateUserById nécessite l'id, pas seulement l'email).

ALTER TABLE membres ADD COLUMN auth_user_id UUID;
