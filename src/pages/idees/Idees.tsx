import { useState, useEffect } from 'react'
import { supabase, Idee } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import BoutonImprimer, { EnteteImpression } from '../../components/Layout/BoutonImprimer'

type IdeeAvecMembre = Idee & { membres: { prenom: string; nom: string } | null }

const STATUT_LABELS: Record<Idee['statut'], string> = {
  nouvelle: 'Nouvelle',
  en_cours: 'En cours',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  realisee: 'Réalisée',
}

const STATUT_CLASSES: Record<Idee['statut'], string> = {
  nouvelle: 'border-brand-petrol text-brand-petrol',
  en_cours: 'border-brand-sky text-brand-sky',
  acceptee: 'border-brand-petrol text-brand-petrol',
  refusee: 'border-brand-brick text-brand-brick',
  realisee: 'border-brand-hairline text-brand-ink/50',
}

export default function Idees() {
  const [idees, setIdees] = useState<IdeeAvecMembre[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<IdeeAvecMembre | null>(null)
  const { user, membre, isAdmin, loading: authLoading } = useAuth()

  // Formulaire de soumission
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Formulaire de traitement (bureau)
  const [editStatut, setEditStatut] = useState<Idee['statut']>('nouvelle')
  const [editReponse, setEditReponse] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    const { data } = await supabase
      .from('idees')
      .select('*, membres(prenom, nom)')
      .order('created_at', { ascending: false })
    setIdees((data as IdeeAvecMembre[]) || [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!titre.trim()) { setFormError('Le titre est obligatoire.'); return }
    if (!membre) { setFormError('Profil membre introuvable.'); return }

    setSaving(true)
    const { error } = await supabase.from('idees').insert({
      titre: titre.trim(),
      description: description.trim() || null,
      membre_id: membre.id,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }

    setTitre(''); setDescription(''); setShowForm(false)
    fetchData()
  }

  const openEdit = (idee: IdeeAvecMembre) => {
    setEditing(idee)
    setEditStatut(idee.statut)
    setEditReponse(idee.reponse || '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    await supabase
      .from('idees')
      .update({ statut: editStatut, reponse: editReponse.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
    setEditSaving(false)
    setEditing(null)
    fetchData()
  }

  const handleDelete = async (idee: IdeeAvecMembre) => {
    if (!window.confirm(`Supprimer l'idée "${idee.titre}" ? Cette action est définitive.`)) return
    await supabase.from('idees').delete().eq('id', idee.id)
    fetchData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel="Vie associative"
        title="Boîte à idées"
        subtitle="Proposez une idée, suivez sa réponse grâce à son numéro de suivi"
      />
      <div className="chevron-band" />

      <main className="max-w-4xl mx-auto p-xl">
        <div className="flex items-center justify-between mb-xl gap-md flex-wrap print:hidden">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Proposer une idée
          </button>
          <BoutonImprimer targetId="impression-idees" titre="Boîte à idées" orientation="portrait" />
        </div>

        <div id="impression-idees">
        <EnteteImpression titre="Boîte à idées" />

        {idees.length === 0 && (
          <p className="text-center py-xxl text-brand-ink/40">Aucune idée soumise pour le moment.</p>
        )}

        <div className="space-y-md">
          {idees.map(idee => (
            <div key={idee.id} className="signature-card">
              <div className="flex items-start justify-between gap-md flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-sm mb-xs flex-wrap">
                    <span className="eyebrow text-xs">IDEE-{idee.numero_suivi}</span>
                    <span className={`tag ${STATUT_CLASSES[idee.statut]}`}>{STATUT_LABELS[idee.statut]}</span>
                  </div>
                  <h3 className="font-display font-bold uppercase text-lg leading-tight">{idee.titre}</h3>
                  {idee.description && <p className="text-sm text-brand-ink/60 mt-xs">{idee.description}</p>}
                  <div className="flex gap-md mt-xs text-xs text-brand-ink/40 flex-wrap">
                    <span>Par {idee.membres ? `${idee.membres.prenom} ${idee.membres.nom}` : 'Membre'}</span>
                    <span>{new Date(idee.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  {idee.reponse && (
                    <div className="mt-sm border-l-2 border-brand-petrol pl-md">
                      <p className="text-xs uppercase tracking-[0.1em] font-semibold text-brand-petrol mb-xxs">Réponse du bureau</p>
                      <p className="text-sm text-brand-ink/80">{idee.reponse}</p>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-md flex-wrap print:hidden">
                    <button onClick={() => openEdit(idee)} className="text-sm text-brand-petrol hover:underline font-semibold">
                      Traiter
                    </button>
                    <button onClick={() => handleDelete(idee)} className="text-sm text-brand-brick hover:underline font-semibold">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      </main>

      {/* Modal soumission */}
      {showForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-start justify-center p-xl z-50 overflow-y-auto">
          <div className="signature-card w-full max-w-lg my-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">Proposer une idée</h2>
            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{formError}</div>
              )}
              <div className="mb-md">
                <label htmlFor="idee-titre" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre *</label>
                <input
                  id="idee-titre"
                  required value={titre} onChange={e => setTitre(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>
              <div className="mb-lg">
                <label htmlFor="idee-description" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Description</label>
                <textarea
                  id="idee-description"
                  value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol resize-none"
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Envoi…' : 'Envoyer mon idée'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowForm(false); setFormError('') }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal traitement (bureau) */}
      {editing && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-start justify-center p-xl z-50 overflow-y-auto">
          <div className="signature-card w-full max-w-lg my-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-xs">Traiter IDEE-{editing.numero_suivi}</h2>
            <p className="text-sm text-brand-ink/60 mb-lg">{editing.titre}</p>
            <form onSubmit={handleSaveEdit}>
              <div className="mb-md">
                <label htmlFor="idee-statut" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Statut</label>
                <select
                  id="idee-statut"
                  value={editStatut} onChange={e => setEditStatut(e.target.value as Idee['statut'])}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                >
                  {Object.entries(STATUT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-lg">
                <label htmlFor="idee-reponse" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Réponse</label>
                <textarea
                  id="idee-reponse"
                  value={editReponse} onChange={e => setEditReponse(e.target.value)} rows={4}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol resize-none"
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" disabled={editSaving} className="btn-primary flex-1">
                  {editSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(null)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
