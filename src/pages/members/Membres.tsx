import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Membre } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

const ROLES = [
  'president', 'secretaire', 'tresorier',
  'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier',
  'membre_actif', 'membre_passif', 'membre_honoraire',
]
const POSTES_UNIQUES = ['president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']
const STATUTS = ['actif', 'passif', 'honoraire']

type NouveauMembre = {
  prenom: string
  nom: string
  email: string
  role: string
  statut: string
}

const MEMBRE_VIDE: NouveauMembre = { prenom: '', nom: '', email: '', role: 'membre_actif', statut: 'actif' }

export default function Membres() {
  const [membres, setMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isAdmin, canManageMembres, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [sortBy, setSortBy] = useState<'nom' | 'prenom' | 'role' | 'statut' | 'notifications_active'>('nom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: typeof sortBy) => {
    if (col === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<NouveauMembre>(MEMBRE_VIDE)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [creatingAccessId, setCreatingAccessId] = useState<string | null>(null)
  const [accessModal, setAccessModal] = useState<{ email: string } | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user) {
      fetchMembres()
    }
  }, [user])

  const fetchMembres = async () => {
    const { data } = await supabase
      .from('membres')
      .select('*')
      .order('nom')

    setMembres(data || [])
    setLoading(false)
  }

  const handleAddMembre = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')

    const { error } = await supabase.from('membres').insert({
      prenom: addForm.prenom.trim(),
      nom: addForm.nom.trim(),
      email: addForm.email.trim().toLowerCase(),
      role: addForm.role,
      statut: addForm.statut,
    })

    if (error) {
      setAddError(error.message)
    } else {
      setShowAddForm(false)
      setAddForm(MEMBRE_VIDE)
      fetchMembres()
    }
    setAdding(false)
  }

  const handleCsvFile = async (file: File) => {
    setCsvErrors([])
    const text = await file.text()
    const result = parseMembresCsv(text, membres)

    if (result.errors.length) {
      setCsvErrors(result.errors)
      return
    }

    setCsvImporting(true)
    const { error } = await supabase.from('membres').insert(result.rows)
    setCsvImporting(false)

    if (error) {
      setCsvErrors([error.message])
    } else {
      fetchMembres()
    }
  }

  const handleChangeRole = async (membre: Membre, role: string) => {
    // Les 6 postes nommés (président/secrétaire/trésorier + leurs adjoints) ne
    // peuvent être occupés que par une seule personne : on démet l'ancien
    // titulaire avant de promouvoir le nouveau (sinon l'index unique en base rejette l'écriture).
    if (POSTES_UNIQUES.includes(role)) {
      const ancien = membres.find((m) => m.role === role && m.id !== membre.id)
      if (ancien) {
        const { error } = await supabase.from('membres').update({ role: 'membre_actif', date_nomination: null }).eq('id', ancien.id)
        if (error) { window.alert(`Erreur : ${error.message}`); return }
      }
      const { error } = await supabase.from('membres').update({ role, date_nomination: new Date().toISOString().slice(0, 10) }).eq('id', membre.id)
      if (error) { window.alert(`Erreur : ${error.message}`); return }
    } else {
      const { error } = await supabase.from('membres').update({ role }).eq('id', membre.id)
      if (error) { window.alert(`Erreur : ${error.message}`); return }
    }
    fetchMembres()
  }

  const handleChangeStatut = async (membre: Membre, statut: string) => {
    const { error } = await supabase.from('membres').update({ statut }).eq('id', membre.id)
    if (error) { window.alert(`Erreur : ${error.message}`); return }
    fetchMembres()
  }

  const handleDeleteMembre = async (membre: Membre) => {
    if (!window.confirm(`Supprimer ${membre.prenom} ${membre.nom} ? Cette action est définitive.`)) return
    const { error } = await supabase.from('membres').delete().eq('id', membre.id)
    if (error) { window.alert(`Erreur : ${error.message}`); return }
    fetchMembres()
  }

  const handleCreateAccess = async (membre: Membre) => {
    setCreatingAccessId(membre.id)
    setAccessError(null)

    const { data, error } = await supabase.functions.invoke('create-membre-access', {
      body: { membreId: membre.id, redirectTo: `${window.location.origin}/mon-compte` },
    })

    setCreatingAccessId(null)

    if (error) {
      // supabase.functions.invoke masque le corps JSON renvoyé par la fonction
      // derrière un message générique quand le statut est non-2xx ; on va le
      // chercher dans error.context (la Response brute) pour afficher le vrai message.
      let message = error.message
      const context = (error as { context?: Response }).context
      if (context) {
        try {
          const body = await context.json()
          if (body?.error) message = body.error
        } catch {
          // corps non-JSON, on garde le message générique
        }
      }
      setAccessError(message)
    } else if (data?.error) {
      setAccessError(data.error)
    } else {
      setAccessModal({ email: data.email })
      fetchMembres()
    }
  }

  const downloadCsvTemplate = () => {
    const rows = [
      'prenom,nom,email,role,statut',
      'Marie,Dupont,marie.dupont@example.com,membre_actif,actif',
      'Jean,Martin,jean.martin@example.com,membre_passif,passif',
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele_membres.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode="§02"
        eyebrowLabel="Effectifs"
        title="Membres de l'amicale"
        subtitle={`${membres.filter(m => m.statut === 'actif').length} actifs • ${membres.filter(m => m.statut === 'passif').length} passifs • ${membres.filter(m => m.statut === 'honoraire').length} honoraires`}
      />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        {isAdmin && (
          <div className="flex gap-md mb-xl flex-wrap">
            <button className="btn-primary" onClick={() => setShowAddForm(true)}>
              + Ajouter un membre
            </button>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Importer un CSV
            </button>
            <button className="btn-secondary" onClick={downloadCsvTemplate}>
              Télécharger le modèle CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCsvFile(file)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {csvImporting && <p className="eyebrow mb-md">Import en cours…</p>}

        {csvErrors.length > 0 && (
          <div className="signature-card border-brand-brick mb-xl">
            <p className="font-display font-bold uppercase text-brand-brick mb-sm">
              Import annulé — {csvErrors.length} erreur{csvErrors.length > 1 ? 's' : ''}
            </p>
            <ul className="text-sm text-brand-ink/80 list-disc pl-md space-y-xxs">
              {csvErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
            <button
              className="btn-secondary text-xs mt-md"
              onClick={() => setCsvErrors([])}
            >
              Fermer
            </button>
          </div>
        )}

        <div className="border border-brand-hairline bg-brand-paper overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-brand-ink text-brand-parchment">
                {(['nom', 'prenom', 'role', 'statut', 'notifications_active'] as const).map((col) => {
                  const labels: Record<string, string> = { nom: 'Nom', prenom: 'Prénom', role: 'Rôle', statut: 'Statut', notifications_active: 'Notifications' }
                  return (
                    <th key={col} className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">
                      <button onClick={() => handleSort(col)} className={`hover:text-brand-sky transition-colors ${sortBy === col ? 'text-brand-sky' : ''}`}>
                        {labels[col]} {sortBy === col && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                  )
                })}
                {isAdmin && (
                  <th className="text-left py-sm px-md font-semibold text-xs tracking-[0.15em]">Accès</th>
                )}
                {canManageMembres && (
                  <th className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {[...membres].sort((a, b) => {
                const va = String(a[sortBy] ?? '')
                const vb = String(b[sortBy] ?? '')
                const cmp = va.localeCompare(vb, 'fr', { sensitivity: 'base' })
                return sortDir === 'asc' ? cmp : -cmp
              }).map((membre, i) => (
                <tr
                  key={membre.id}
                  className={`border-t border-brand-hairline ${i % 2 === 1 ? 'bg-brand-parchment/50' : ''} hover:bg-brand-sky/10`}
                >
                  <td className="py-sm px-md font-medium">{membre.nom}</td>
                  <td className="py-sm px-md">{membre.prenom}</td>
                  <td className="py-sm px-md">
                    {canManageMembres ? (
                      <select
                        value={membre.role}
                        onChange={(e) => handleChangeRole(membre, e.target.value)}
                        className={`tag bg-brand-paper ${getRoleClass(membre.role)}`}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                      </select>
                    ) : (
                      <span className={`tag ${getRoleClass(membre.role)}`}>
                        {getRoleLabel(membre.role)}
                      </span>
                    )}
                  </td>
                  <td className="py-sm px-md">
                    {canManageMembres ? (
                      <select
                        value={membre.statut}
                        onChange={(e) => handleChangeStatut(membre, e.target.value)}
                        className={`tag bg-brand-paper ${getStatutClass(membre.statut)}`}
                      >
                        {STATUTS.map((s) => <option key={s} value={s}>{getStatutLabel(s)}</option>)}
                      </select>
                    ) : (
                      <span className={`tag ${getStatutClass(membre.statut)}`}>
                        {getStatutLabel(membre.statut)}
                      </span>
                    )}
                  </td>
                  <td className="py-sm px-md">
                    <span className={`text-xs ${membre.notifications_active ? 'text-success' : 'text-brand-ink/40'}`}>
                      {membre.notifications_active ? 'Actives' : 'Désactivées'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-sm px-md">
                      <div className="flex flex-col items-start gap-xxs">
                        {membre.a_un_compte && (
                          <span className="text-xs text-success font-semibold">✓ Accès actif</span>
                        )}
                        <button
                          onClick={() => handleCreateAccess(membre)}
                          disabled={creatingAccessId === membre.id}
                          className="text-xs text-brand-petrol hover:underline font-semibold disabled:opacity-50"
                        >
                          {creatingAccessId === membre.id
                            ? (membre.a_un_compte ? 'Envoi en cours…' : 'Envoi en cours…')
                            : (membre.a_un_compte ? 'Envoyer lien de réinitialisation' : 'Envoyer invitation')}
                        </button>
                      </div>
                    </td>
                  )}
                  {canManageMembres && (
                    <td className="py-sm px-md">
                      <button
                        onClick={() => handleDeleteMembre(membre)}
                        className="text-xs text-brand-brick hover:underline font-semibold"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showAddForm && (
        <Modal onClose={() => setShowAddForm(false)}>
          <h2 className="font-display font-bold uppercase text-xl mb-lg">Ajouter un membre</h2>
          <form onSubmit={handleAddMembre}>
            {addError && (
              <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{addError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
              <Field label="Prénom">
                <input
                  required
                  value={addForm.prenom}
                  onChange={(e) => setAddForm({ ...addForm, prenom: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </Field>
              <Field label="Nom">
                <input
                  required
                  value={addForm.nom}
                  onChange={(e) => setAddForm({ ...addForm, nom: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </Field>
            </div>
            <Field label="Email" className="mb-md">
              <input
                type="email"
                required
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-lg">
              <Field label="Rôle">
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </Field>
              <Field label="Statut">
                <select
                  value={addForm.statut}
                  onChange={(e) => setAddForm({ ...addForm, statut: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                >
                  {STATUTS.map((s) => <option key={s} value={s}>{getStatutLabel(s)}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-sm">
              <button type="submit" disabled={adding} className="btn-primary flex-1">
                {adding ? 'Ajout…' : 'Ajouter'}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowAddForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {accessModal && (
        <Modal onClose={() => setAccessModal(null)}>
          <h2 className="font-display font-bold uppercase text-xl mb-sm">Email envoyé</h2>
          <p className="text-sm text-brand-ink/70 mb-lg">
            Un lien a été envoyé à l'adresse ci-dessous. Le membre pourra choisir son mot de passe en cliquant dessus.
          </p>
          <div className="border border-brand-hairline bg-brand-parchment p-md mb-lg">
            <p className="text-xs uppercase tracking-[0.1em] text-brand-petrol font-semibold mb-xxs">Email</p>
            <p className="font-medium">{accessModal.email}</p>
          </div>
          <button className="btn-primary w-full" onClick={() => setAccessModal(null)}>
            Fermer
          </button>
        </Modal>
      )}

      {accessError && (
        <Modal onClose={() => setAccessError(null)}>
          <p className="text-sm text-brand-brick">{accessError}</p>
          <button className="btn-secondary w-full mt-lg" onClick={() => setAccessError(null)}>
            Fermer
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={onClose}>
      <div className="signature-card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">{label}</label>
      {children}
    </div>
  )
}

function parseMembresCsv(text: string, membresExistants: Membre[]): { rows: NouveauMembre[]; errors: string[] } {
  const emailsExistants = new Set(membresExistants.map((m) => m.email.toLowerCase()))
  const lignes = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)

  if (!lignes.length) {
    return { rows: [], errors: ['Le fichier est vide.'] }
  }

  const premiereLigne = lignes[0].split(',').map((c) => c.trim().toLowerCase())
  const aUnEntete = premiereLigne.join(',') === 'prenom,nom,email,role,statut'
  const donnees = aUnEntete ? lignes.slice(1) : lignes

  const errors: string[] = []
  const rows: NouveauMembre[] = []
  const emailsVus = new Set<string>()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  donnees.forEach((ligne, index) => {
    const numero = index + (aUnEntete ? 2 : 1)
    const cols = ligne.split(',').map((c) => c.trim())

    if (cols.length !== 5) {
      errors.push(`Ligne ${numero} : 5 colonnes attendues (prenom,nom,email,role,statut), ${cols.length} trouvée(s).`)
      return
    }

    const [prenom, nom, emailRaw, role, statut] = cols
    const email = emailRaw.toLowerCase()

    if (!prenom || !nom) {
      errors.push(`Ligne ${numero} : prénom et nom obligatoires.`)
    }
    if (!emailRegex.test(email)) {
      errors.push(`Ligne ${numero} : email "${emailRaw}" invalide.`)
    } else if (emailsExistants.has(email)) {
      errors.push(`Ligne ${numero} : email "${emailRaw}" déjà utilisé par un membre existant.`)
    } else if (emailsVus.has(email)) {
      errors.push(`Ligne ${numero} : email "${emailRaw}" en double dans le fichier.`)
    }
    if (!ROLES.includes(role)) {
      errors.push(`Ligne ${numero} : rôle "${role}" invalide (attendu : ${ROLES.join(', ')}).`)
    }
    if (!STATUTS.includes(statut)) {
      errors.push(`Ligne ${numero} : statut "${statut}" invalide (attendu : ${STATUTS.join(', ')}).`)
    }

    emailsVus.add(email)
    rows.push({ prenom, nom, email, role, statut })
  })

  return { rows: errors.length ? [] : rows, errors }
}

// Labels et classes
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    president: 'Président',
    tresorier: 'Trésorier',
    secretaire: 'Secrétaire',
    adjoint_president: 'Adjoint au Président',
    adjoint_secretaire: 'Adjoint au Secrétaire',
    adjoint_tresorier: 'Adjoint au Trésorier',
    membre_actif: 'Membre actif',
    membre_passif: 'Membre passif',
    membre_honoraire: 'Membre honoraire',
  }
  return labels[role] || role
}

const getRoleClass = (role: string) => {
  if (POSTES_UNIQUES.includes(role)) {
    return 'border-brand-brick text-brand-brick'
  }
  return 'border-brand-hairline text-brand-ink/50'
}

const getStatutLabel = (statut: string) => {
  const labels: Record<string, string> = {
    actif: 'Actif',
    passif: 'Passif',
    honoraire: 'Honoraire',
  }
  return labels[statut] || statut
}

const getStatutClass = (statut: string) => {
  const classes: Record<string, string> = {
    actif: 'border-brand-petrol text-brand-petrol',
    passif: 'border-brand-hairline text-brand-ink/50',
    honoraire: 'border-brand-brick text-brand-brick',
  }
  return classes[statut] || ''
}
