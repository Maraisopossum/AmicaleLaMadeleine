-- Module Bar : gestion des stocks, consommations (self-service ou saisies par
-- un barman) et ardoises des membres, avec paiement possible par CB via un
-- terminal PayPal Zettle (intégration réelle branchée séparément une fois les
-- identifiants développeur Zettle créés — voir supabase/functions/bar-zettle-payment).
--
-- Modèle de permission : nouveau flag membres.est_barman (comme
-- acces_candidatures), combiné au bureau existant via is_bar_manager(). Un
-- barman peut gérer le catalogue/stock, saisir des consommations pour
-- d'autres membres, et enregistrer des règlements d'ardoise — sans être élu
-- au bureau.

ALTER TABLE membres ADD COLUMN est_barman BOOLEAN NOT NULL DEFAULT false;

-- Étend le verrouillage des champs sensibles au nouveau flag : seul
-- canManageMembres (président/admin) peut désigner qui est barman, ni le
-- membre lui-même ni le reste du bureau (même périmètre qu'acces_candidatures,
-- cf. 20260808000000_candidatures.sql).
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
    NEW.est_barman := OLD.est_barman;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_bar_manager(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    is_bureau(p_email)
    OR EXISTS (SELECT 1 FROM membres m WHERE m.email = p_email AND m.est_barman = true)
$$;

-- Table : bar_produits (catalogue + stock)
CREATE TABLE bar_produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT '🍺',
  categorie TEXT NOT NULL,
  prix NUMERIC(10,2) NOT NULL CHECK (prix >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table : bar_consommations (une ligne = un produit x quantité, à un instant T)
-- mode_paiement 'ardoise' : ajoutée à la dette du membre (membre_id obligatoire).
-- mode_paiement 'cb'      : payée immédiatement via Zettle, hors ardoise ;
--                           membre_id et/ou nom_libre optionnels (vente à un
--                           invité, cf. affectations.nom_libre du module JPO).
-- enregistre_par NULL     : self-service (saisie par le membre lui-même).
CREATE TABLE bar_consommations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES bar_produits(id) ON DELETE RESTRICT,
  membre_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  nom_libre TEXT,
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire NUMERIC(10,2) NOT NULL,
  montant_total NUMERIC(10,2) NOT NULL,
  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('ardoise', 'cb')),
  zettle_statut TEXT NOT NULL DEFAULT 'non_applicable'
    CHECK (zettle_statut IN ('non_applicable', 'en_attente', 'reussi', 'echoue')),
  zettle_reference TEXT,
  enregistre_par UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (mode_paiement <> 'ardoise' OR membre_id IS NOT NULL)
);

-- Table : bar_paiements (règlements d'ardoise — soldent une dette ou
-- créditent le compte du membre pour ses prochaines consommations, cf.
-- solde signé unique porté par la vue bar_soldes ci-dessous).
CREATE TABLE bar_paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  montant NUMERIC(10,2) NOT NULL CHECK (montant > 0),
  mode TEXT NOT NULL CHECK (mode IN ('cb', 'especes')),
  zettle_statut TEXT NOT NULL DEFAULT 'non_applicable'
    CHECK (zettle_statut IN ('non_applicable', 'en_attente', 'reussi', 'echoue')),
  zettle_reference TEXT,
  enregistre_par UUID NOT NULL REFERENCES membres(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vue : solde signé par membre (positif = crédit disponible, négatif = dû).
-- = somme des règlements - somme des consommations à l'ardoise.
CREATE VIEW bar_soldes AS
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
  WHERE mode_paiement = 'ardoise'
  GROUP BY membre_id
) c ON c.membre_id = m.id;

ALTER TABLE bar_produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_consommations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_paiements ENABLE ROW LEVEL SECURITY;

-- bar_produits : catalogue visible de tout membre connecté (pour le
-- self-service), géré (créer/modifier/désactiver/stock) par les barmans+bureau.
CREATE POLICY "bar_produits_select_authenticated" ON bar_produits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bar_produits_insert_manager" ON bar_produits
  FOR INSERT TO authenticated WITH CHECK (is_bar_manager(auth.jwt()->>'email'));

CREATE POLICY "bar_produits_update_manager" ON bar_produits
  FOR UPDATE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

CREATE POLICY "bar_produits_delete_manager" ON bar_produits
  FOR DELETE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

-- bar_consommations : un membre voit ses propres lignes, les barmans/bureau
-- voient tout. Écriture : self-service (le membre crée sa propre ligne, à
-- l'ardoise sur lui-même, sans barman) ou barman/bureau (pour n'importe qui,
-- y compris ventes CB anonymes/invités). Correction d'erreur réservée aux
-- barmans/bureau.
CREATE POLICY "bar_consommations_select" ON bar_consommations
  FOR SELECT TO authenticated USING (
    is_bar_manager(auth.jwt()->>'email')
    OR membre_id IN (SELECT id FROM membres WHERE email = auth.jwt()->>'email')
  );

CREATE POLICY "bar_consommations_insert" ON bar_consommations
  FOR INSERT TO authenticated WITH CHECK (
    is_bar_manager(auth.jwt()->>'email')
    OR (
      enregistre_par IS NULL
      AND mode_paiement = 'ardoise'
      AND membre_id IN (SELECT id FROM membres WHERE email = auth.jwt()->>'email')
    )
  );

CREATE POLICY "bar_consommations_update_manager" ON bar_consommations
  FOR UPDATE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

CREATE POLICY "bar_consommations_delete_manager" ON bar_consommations
  FOR DELETE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

-- bar_paiements : un membre voit ses propres règlements, les barmans/bureau
-- voient tout. Seuls les barmans/bureau enregistrent un règlement (jamais en
-- self-service, cf. décision produit : encaissement toujours supervisé).
CREATE POLICY "bar_paiements_select" ON bar_paiements
  FOR SELECT TO authenticated USING (
    is_bar_manager(auth.jwt()->>'email')
    OR membre_id IN (SELECT id FROM membres WHERE email = auth.jwt()->>'email')
  );

CREATE POLICY "bar_paiements_insert_manager" ON bar_paiements
  FOR INSERT TO authenticated WITH CHECK (is_bar_manager(auth.jwt()->>'email'));

CREATE POLICY "bar_paiements_update_manager" ON bar_paiements
  FOR UPDATE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

CREATE POLICY "bar_paiements_delete_manager" ON bar_paiements
  FOR DELETE TO authenticated USING (is_bar_manager(auth.jwt()->>'email'));

-- La vue bar_soldes hérite de la sécurité de ses tables sources via
-- security_invoker : chaque membre n'y voit que les soldes que les policies
-- ci-dessus l'autorisent déjà à calculer (les siens, ou tous s'il est barman/bureau).
ALTER VIEW bar_soldes SET (security_invoker = true);
