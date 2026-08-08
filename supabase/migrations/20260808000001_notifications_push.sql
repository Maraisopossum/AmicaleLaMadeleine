-- Notifications push (Web Push / VAPID) : brique générique réutilisable.
-- Chaque membre peut enregistrer un ou plusieurs abonnements (un par
-- appareil/navigateur où l'app est installée) et choisir, dans Mon compte,
-- quels types d'événements l'intéressent. L'envoi effectif se fait depuis
-- une edge function (send-notification) déclenchée par des Database
-- Webhooks configurés côté dashboard Supabase (pas en SQL ici : la
-- configuration d'un webhook embarque l'URL + un header d'authentification
-- qui ne doivent pas finir versionnés en clair dans une migration Git).
-- Voir le README de supabase/functions/send-notification pour la procédure.

ALTER TABLE membres ADD COLUMN notif_reunions BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE membres ADD COLUMN notif_idees BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE membres ADD COLUMN notif_votes BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE membres ADD COLUMN notif_documents BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ON push_subscriptions (membre_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Un membre gère ses propres abonnements (un par appareil sur lequel il
-- installe l'app et autorise les notifications). La lecture cross-membres
-- n'est jamais nécessaire côté client : l'edge function d'envoi utilise la
-- clé service_role, qui bypass RLS.
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT TO authenticated USING (
    membre_id = (SELECT id FROM membres WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  );

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (
    membre_id = (SELECT id FROM membres WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  );

CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE TO authenticated USING (
    membre_id = (SELECT id FROM membres WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  );
