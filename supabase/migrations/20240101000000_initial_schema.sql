-- Table: membres
CREATE TABLE membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('president', 'tresorier', 'secretaire', 'adjoint', 'membre_actif', 'membre_passif', 'membre_honoraire')),
  statut TEXT DEFAULT 'actif',
  date_nomination DATE,
  notifications_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: organigramme (bureau actuel)
CREATE TABLE organigramme (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID REFERENCES membres(id) ON DELETE CASCADE,
  poste TEXT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,
  type_poste TEXT CHECK (type_poste IN ('bureau', 'membre')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  fichier_url TEXT NOT NULL,
  type TEXT CHECK (type IN ('statut', 'reglement', 'proces_verbal', 'compte_rendu', 'autre')),
  archive BOOLEAN DEFAULT false,
  date_document DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES membres(id)
);

-- Table: cotisations
CREATE TABLE cotisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID REFERENCES membres(id) ON DELETE CASCADE,
  annee INTEGER NOT NULL,
  paye BOOLEAN DEFAULT false,
  date_paiement DATE,
  montant NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(membre_id, annee)
);

-- Table: evenements
CREATE TABLE evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  date_debut TIMESTAMP WITH TIME ZONE NOT NULL,
  date_fin TIMESTAMP WITH TIME ZONE,
  lieu TEXT,
  type TEXT CHECK (type IN ('ag', 'reunion', 'activite', 'formation')),
  lien_google TEXT,
  created_by UUID REFERENCES membres(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: parametres_notifications
CREATE TABLE parametres_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('cotisation', 'evenement')),
  jours_avance INTEGER DEFAULT 15,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX idx_membres_role ON membres(role);
CREATE INDEX idx_membres_statut ON membres(statut);
CREATE INDEX idx_cotisations_annee ON cotisations(annee);
CREATE INDEX idx_evenements_date ON evenements(date_debut);