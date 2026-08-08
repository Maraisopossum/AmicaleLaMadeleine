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
  doit_changer_mdp: boolean
  photo_url: string | null
  acces_candidatures: boolean
  notif_reunions: boolean
  notif_idees: boolean
  notif_votes: boolean
  notif_documents: boolean
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
  max_choix: number | null
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

export type ReponsesQuizRecrutement = {
  age?: 'under16' | 'jsp' | 'ok' | 'over55'
  residence?: 'oui' | 'non'
  dispo?: 'oui' | 'peut_etre' | 'non'
  droits_civiques?: 'oui' | 'non' | 'pas_sur'
  casier?: 'oui' | 'non' | 'pas_sur'
}

export type Candidature = {
  id: string
  prenom: string
  nom: string
  telephone: string | null
  email: string | null
  reponses: ReponsesQuizRecrutement
  statut_eligibilite: 'eligible' | 'a_verifier' | 'pas_encore'
  traite: boolean
  created_at: string
}

export type Idee = {
  id: string
  numero_suivi: number
  titre: string
  description: string | null
  membre_id: string
  statut: 'nouvelle' | 'en_cours' | 'acceptee' | 'refusee' | 'realisee'
  reponse: string | null
  created_at: string
  updated_at: string
}

export type SectionLibre = { titre: string; contenu: string }

export type Reunion = {
  id: string
  titre: string
  date_reunion: string
  statut: 'brouillon' | 'publie'
  bureau_uniquement: boolean
  evenement_id: string | null
  ordre_du_jour: string | null
  decisions: string | null
  prochaines_echeances: string | null
  sections_libres: SectionLibre[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ReunionPresence = {
  id: string
  reunion_id: string
  membre_id: string
  statut: 'present' | 'excuse' | 'absent'
}

export type Tache = {
  id: string
  titre: string
  description: string | null
  statut: 'a_faire' | 'en_cours' | 'fait' | 'annulee'
  responsable_id: string | null
  responsable_nom_libre: string | null
  realisateur_id: string | null
  realisateur_nom_libre: string | null
  deadline: string | null
  date_realisation: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}