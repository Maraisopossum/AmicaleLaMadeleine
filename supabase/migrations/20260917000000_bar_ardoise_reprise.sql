-- Reprise du module Bar : annulation tracée des consommations (au lieu
-- d'une suppression définitive), stock minimum configurable par produit
-- (remplace le seuil fixe côté front), et configuration des rappels
-- d'ardoise (deux paliers + fréquence). Le panier avec validation côté
-- self-service/caisse ne touche pas au schéma (assemblage côté client avant
-- écriture en base), donc rien ici pour ce volet.

-- 1) Annulation tracée d'une consommation (ardoise ou CB) par un barman/le
--    bureau : la ligne reste en base, exclue du solde et du CA, avec qui a
--    annulé, quand, et un motif libre optionnel. Le stock est restitué côté
--    application (pas de trigger : la restitution dépend de la quantité de
--    la ligne annulée, plus simple à faire dans le même appel côté client
--    que dans un trigger qui devrait rejouer la même logique).
ALTER TABLE bar_consommations ADD COLUMN statut TEXT NOT NULL DEFAULT 'validee'
  CHECK (statut IN ('validee', 'annulee'));
ALTER TABLE bar_consommations ADD COLUMN annule_par UUID REFERENCES membres(id) ON DELETE SET NULL;
ALTER TABLE bar_consommations ADD COLUMN annule_le TIMESTAMP WITH TIME ZONE;
ALTER TABLE bar_consommations ADD COLUMN motif_annulation TEXT;

-- Le solde ne doit plus compter une ligne annulée.
CREATE OR REPLACE VIEW bar_soldes AS
SELECT
  m.id AS membre_id,
  COALESCE(p.total_paiements, 0) - COALESCE(c.total_ardoise, 0) AS solde
FROM membres m
LEFT JOIN (
  SELECT membre_id, SUM(montant) AS total_paiements
  FROM bar_paiements
  GROUP BY membre_id
) p ON p.membre_id = m.id
LEFT JOIN (
  SELECT membre_id, SUM(montant_total) AS total_ardoise
  FROM bar_consommations
  WHERE mode_paiement = 'ardoise' AND statut = 'validee'
  GROUP BY membre_id
) c ON c.membre_id = m.id;

ALTER VIEW bar_soldes SET (security_invoker = true);

-- 2) Stock minimum par produit, réservé au bureau (contrairement au reste du
--    catalogue, géré par barmans+bureau) : ce seuil pilote à la fois le
--    repère "stock faible" côté UI et l'alerte push temps réel (cf. plus bas).
ALTER TABLE bar_produits ADD COLUMN stock_minimum INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimum >= 0);

CREATE OR REPLACE FUNCTION lock_bar_produits_bureau_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_bureau(auth.jwt()->>'email') THEN
    NEW.stock_minimum := OLD.stock_minimum;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_bar_produits_bureau_fields
  BEFORE UPDATE ON bar_produits
  FOR EACH ROW EXECUTE FUNCTION lock_bar_produits_bureau_fields();

-- Alerte stock temps réel : réutilise le trigger générique déjà en place pour
-- les autres notifications (public.trigger_send_notification(), créé hors
-- migration car son corps embarque WEBHOOK_SECRET — voir
-- supabase/functions/send-notification/README.md). Cette ligne-ci ne fait que
-- le référencer par son nom, rien de secret n'est versionné ici. La
-- déduction "on vient de franchir le seuil vers le bas" se fait côté
-- send-notification (compare record.stock/record.stock_minimum à
-- old_record.stock), pas ici.
CREATE TRIGGER send_notification_bar_produits
  AFTER UPDATE ON bar_produits
  FOR EACH ROW EXECUTE FUNCTION public.trigger_send_notification();

-- 3) Rappels d'ardoise : configuration à une seule ligne (deux paliers +
--    fréquence en jours), modifiable par le bureau uniquement. Le job
--    périodique (edge function bar-rappels-ardoises, appelée par un cron
--    GitHub Actions comme keep-alive.yml) lit dernier_envoi pour savoir si la
--    fréquence configurée est écoulée, plutôt que de dépendre de la
--    fréquence exacte du cron — un changement de fréquence dans l'appli
--    prend donc effet sans toucher au cron.
CREATE TABLE bar_configuration_rappels (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  seuil_avertissement NUMERIC(10,2) NOT NULL DEFAULT -20,
  seuil_urgent NUMERIC(10,2) NOT NULL DEFAULT -50,
  frequence_jours INTEGER NOT NULL DEFAULT 7 CHECK (frequence_jours > 0),
  dernier_envoi TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (seuil_urgent <= seuil_avertissement)
);

INSERT INTO bar_configuration_rappels (id) VALUES (true);

ALTER TABLE bar_configuration_rappels ENABLE ROW LEVEL SECURITY;

-- Lisible par tout membre connecté (transparence : "à partir de quel solde
-- suis-je relancé ?"), modifiable par le bureau seul (politique de
-- recouvrement associative, pas une tâche opérationnelle de barman).
CREATE POLICY "bar_configuration_rappels_select" ON bar_configuration_rappels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bar_configuration_rappels_update_bureau" ON bar_configuration_rappels
  FOR UPDATE TO authenticated USING (is_bureau(auth.jwt()->>'email'));

-- 4) Préférences de notification (même pattern que notif_reunions/idees/
--    votes/documents : opt-in personnel, modifiable par le membre lui-même
--    via Mon compte, pas verrouillé par lock_sensitive_membre_fields).
ALTER TABLE membres ADD COLUMN notif_bar_stock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE membres ADD COLUMN notif_bar_ardoise BOOLEAN NOT NULL DEFAULT true;
