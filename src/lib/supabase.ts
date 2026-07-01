import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types exportés depuis Supabase
export type Membre = {
  id: string
  prenom: string
  nom: string
  email: string
  role:
    | 'president' | 'secretaire' | 'tresorier'
    | 'adjoint_president' | 'adjoint_secretaire' | 'adjoint_tresorier'
    | 'membre_actif' | 'membre_passif' | 'membre_honoraire'
  statut: string
  date_nomination: string | null
  notifications_active: boolean
  a_un_compte: boolean
  created_at: string
  updated_at: string
}

// Vue publique de membres_public (pas d'email, lisible sans auth)
export type MembrePublic = {
  id: string
  prenom: string
  nom: string
  role: Membre['role']
  statut: string
  date_nomination: string | null
}

export type Document = {
  id: string
  titre: string
  description: string | null
  fichier_url: string
  type: 'statut' | 'reglement' | 'proces_verbal' | 'compte_rendu' | 'autre'
  archive: boolean
  date_document: string | null
  created_at: string
  created_by: string | null
}

export type Cotisation = {
  id: string
  membre_id: string
  annee: number
  paye: boolean
  date_paiement: string | null
  montant: number
  created_at: string
}

export type Evenement = {
  id: string
  titre: string
  description: string | null
  date_debut: string
  date_fin: string | null
  lieu: string | null
  type: 'ag' | 'reunion' | 'activite' | 'formation'
  lien_google: string | null
  page_dediee: boolean
  created_by: string | null
  created_at: string
}

export type ProgrammeItem = { heure: string; titre: string; description?: string }

export type EvenementSection = {
  id: string
  evenement_id: string
  type: 'programme' | 'infos_pratiques'
  ordre: number
  contenu: { items?: ProgrammeItem[]; texte?: string }
  created_at: string
  updated_at: string
}

export type EvenementOrganisation = {
  evenement_id: string
  heure_debut: string
  heure_fin: string
  duree_creneau_minutes: number
  created_at: string
  updated_at: string
}

export type Stand = {
  id: string
  evenement_id: string
  titre: string
  description: string | null
  icone: string
  responsable_id: string | null
  created_at: string
  updated_at: string
}

export type Deadline = {
  id: string
  evenement_id: string
  stand_id: string | null
  libelle: string
  date_echeance: string
  fait: boolean
  created_at: string
}

export type Affectation = {
  id: string
  stand_id: string
  heure_debut: string
  heure_fin: string
  membre_id: string | null
  nom_libre: string | null
  created_at: string
}

export type Vote = {
  id: string
  titre: string
  description: string | null
  anonyme: boolean
  statuts_eligibles: string[]
  statut: 'brouillon' | 'ouvert' | 'archive'
  date_fin: string | null
  cree_par: string | null
  created_at: string
  updated_at: string
}

export type VoteQuestion = {
  id: string
  vote_id: string
  libelle: string
  type: 'oui_non' | 'choix_unique' | 'choix_multiple'
  ordre: number
  created_at: string
}

export type VoteOption = {
  id: string
  question_id: string
  libelle: string
  ordre: number
}

export type VoteReponse = {
  id: string
  vote_id: string
  question_id: string
  membre_id: string
  valeur_oui_non: boolean | null
  option_ids: string[] | null
  created_at: string
}