-- Le paiement CB du module Bar reste une confirmation manuelle par le
-- barman, pas une intégration API réelle avec le terminal PayPal Zettle.
--
-- Vérification faite dans la doc officielle Zettle (repo iZettle/api-documentation
-- + developer.zettle.com) : le déclenchement à distance d'un paiement sur un
-- lecteur physique ("Reader Connect") est réservé aux partenaires sous accord
-- avec PayPal, pas accessible à un compte développeur standard. La clé API
-- obtenue (scopes READ:PRODUCT, WRITE:PRODUCT, READ:PURCHASE, READ:FINANCE,
-- READ:USERINFO) ne permet d'ailleurs aucune écriture sur les paiements —
-- seulement la consultation de l'historique déjà encaissé sur le lecteur.
--
-- zettle_statut/zettle_reference sont donc conservées telles quelles (pas de
-- renommage pour éviter de casser le code déjà écrit) mais changent de sens :
-- le barman fait passer la carte sur le lecteur Zettle en dehors de l'appli,
-- puis marque la vente/le règlement comme réglé une fois le paiement confirmé
-- sur le lecteur — zettle_reference sert à noter une référence à la main si
-- besoin (ex: numéro de reçu), zettle_statut passe directement à 'reussi'
-- (ou 'echoue' si le barman annule après un refus de carte), sans état
-- 'en_attente' intermédiaire puisqu'il n'y a plus d'appel asynchrone.

COMMENT ON COLUMN bar_consommations.zettle_statut IS
  'Statut du paiement CB, confirmé manuellement par le barman après passage sur le lecteur Zettle physique (pas d''appel API — voir 20260916000000_bar_cb_manuel.sql).';
COMMENT ON COLUMN bar_consommations.zettle_reference IS
  'Référence optionnelle notée manuellement par le barman (ex: numéro de reçu du lecteur), pas un identifiant retourné par une API.';
COMMENT ON COLUMN bar_paiements.zettle_statut IS
  'Statut du paiement CB, confirmé manuellement par le barman après passage sur le lecteur Zettle physique (pas d''appel API — voir 20260916000000_bar_cb_manuel.sql).';
COMMENT ON COLUMN bar_paiements.zettle_reference IS
  'Référence optionnelle notée manuellement par le barman (ex: numéro de reçu du lecteur), pas un identifiant retourné par une API.';
