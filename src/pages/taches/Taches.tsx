import { useState, useEffect } from 'react'
import { supabase, Tache, Membre } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import BoutonImprimer, { EnteteImpression } from '../../components/Layout/BoutonImprimer'

const STATUT_LABELS: Record<Tache['statut'], string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  fait: 'Fait',
  annulee: 'Annulée',
}

const STATUT_CLASSES: Record<Tache['statut'], string> = {
  a_faire: 'border-brand-hairline text-brand-ink/60',
  en_cours: 'border-brand-sky text-brand-sky',
  fait: 'border-brand-petrol text-brand-petrol',
  annulee: 'border-brand-ink/30 text-brand-ink/30',
}

type TacheForm = {
  titre: string
  description: string
  responsableId: string
  responsableNomLibre: string
  realisateurId: string
  realisateurNomLibre: string
  statut: Tache['statut']
  deadline: string
  dateRealisation: string
}

const FORM_VIDE: TacheForm = {
  titre: '', description: '',
  responsableId: '', responsableNomLibre: '',
  realisateurId: '', realisateurNomLibre: '',
  statut: 'a_faire', deadline: '', dateRealisation: '',
}

export default function Taches() {
  const [taches, setTaches] = useState<Tache[]>([])
  const [membresOptions, setMembresOptions] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Tache | null>(null)
  const [form, setForm] = useState<TacheForm>({ ...FORM_VIDE })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { user, membre, isAdmin, loading: authLoading } = useAuth()

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('taches').select('*').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('membres').select('*').order('nom', { ascending: true }),
    ])
    setTaches(t || [])
    setMembresOptions(m || [])
    setLoading(false)
  }

  const nomDe = (id: string | null) => {
    const m = membresOptions.find(mb => mb.id === id)
    return m ? `${m.prenom} ${m.nom}` : null
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...FORM_VIDE })
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (tache: Tache) => {
    setEditing(tache)
    setForm({
      titre: tache.titre,
      description: tache.description || '',
      responsableId: tache.responsable_id || '',
      responsableNomLibre: tache.responsable_nom_libre || '',
      realisateurId: tache.realisateur_id || '',
      realisateurNomLibre: tache.realisateur_nom_libre || '',
      statut: tache.statut,
      deadline: tache.deadline || '',
      dateRealisation: tache.date_realisation || '',
    })
    setFormError('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.titre.trim()) { setFormError('Le titre est obligatoire.'); return }

    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      statut: form.statut,
      responsable_id: form.responsableId || null,
      responsable_nom_libre: form.responsableId ? null : (form.responsableNomLibre.trim() || null),
      realisateur_id: form.realisateurId || null,
      realisateur_nom_libre: form.realisateurId ? null : (form.realisateurNomLibre.trim() || null),
      deadline: form.deadline || null,
      date_realisation: form.dateRealisation || null,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const { error } = editing
      ? await supabase.from('taches').update(payload).eq('id', editing.id)
      : await supabase.from('taches').insert({ ...payload, created_by: membre?.id ?? null })
    setSaving(false)

    if (error) { setFormError(error.message); return }
    setShowForm(false)
    fetchData()
  }

  const handleDelete = async (tache: Tache) => {
    if (!window.confirm(`Supprimer la tâche "${tache.titre}" ? Cette action est définitive.`)) return
    await supabase.from('taches').delete().eq('id', tache.id)
    fetchData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
        <ModuleHeader eyebrowCode="" eyebrowLabel="Vie associative" title="Tâches du bureau" />
        <div className="chevron-band" />
        <main className="max-w-4xl mx-auto p-xl">
          <p className="text-center py-xxl text-brand-ink/40">Ce module est réservé aux membres du bureau.</p>
        </main>
      </div>
    )
  }

  const enCours = taches.filter(t => t.statut === 'a_faire' || t.statut === 'en_cours')
  const terminees = taches.filter(t => t.statut === 'fait' || t.statut === 'annulee')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel="Vie associative"
        title="Tâches du bureau"
        subtitle="Suivi des tâches hors événements"
      />
      <div className="chevron-band" />

      <main className="max-w-4xl mx-auto p-xl">
        <div className="flex items-center justify-between mb-xl gap-md flex-wrap print:hidden">
          <button className="btn-primary" onClick={openCreate}>
            + Nouvelle tâche
          </button>
          <BoutonImprimer targetId="impression-taches" titre="Tâches du bureau" orientation="landscape" />
        </div>

        <div id="impression-taches">
        <EnteteImpression titre="Tâches du bureau" />

        <section className="mb-xl">
          <h2 className="font-display font-bold uppercase text-2xl mb-lg">En cours</h2>
          {enCours.length === 0 && <p className="text-brand-ink/40">Aucune tâche en cours.</p>}
          <div className="space-y-md">
            {enCours.map(tache => (
              <TacheCard
                key={tache.id}
                tache={tache}
                enRetard={!!tache.deadline && tache.deadline < today}
                responsableNom={tache.responsable_id ? nomDe(tache.responsable_id) : tache.responsable_nom_libre}
                onEdit={() => openEdit(tache)}
                onDelete={() => handleDelete(tache)}
              />
            ))}
          </div>
        </section>

        {terminees.length > 0 && (
          <section>
            <h2 className="font-display font-bold uppercase text-2xl mb-lg">Terminées / annulées</h2>
            <div className="space-y-md">
              {terminees.map(tache => (
                <TacheCard
                  key={tache.id}
                  tache={tache}
                  enRetard={false}
                  responsableNom={tache.responsable_id ? nomDe(tache.responsable_id) : tache.responsable_nom_libre}
                  onEdit={() => openEdit(tache)}
                  onDelete={() => handleDelete(tache)}
                />
              ))}
            </div>
          </section>
        )}
        </div>
      </main>

      {/* Modal création / édition */}
      {showForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-start justify-center p-xl z-50 overflow-y-auto">
          <div className="signature-card w-full max-w-lg my-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">
              {editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </h2>
            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{formError}</div>
              )}

              <div className="mb-md">
                <label htmlFor="tache-titre" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre *</label>
                <input
                  id="tache-titre"
                  required value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <div className="mb-md">
                <label htmlFor="tache-description" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Description</label>
                <textarea
                  id="tache-description"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
                <div>
                  <label htmlFor="tache-responsable" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Responsable</label>
                  <select
                    id="tache-responsable"
                    value={form.responsableId}
                    onChange={e => setForm(f => ({ ...f, responsableId: e.target.value }))}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm mb-xs focus:outline-none focus:border-brand-petrol"
                  >
                    <option value="">— Nom libre —</option>
                    {membresOptions.map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                    ))}
                  </select>
                  {!form.responsableId && (
                    <input
                      aria-label="Nom libre du responsable"
                      placeholder="Nom libre" value={form.responsableNomLibre}
                      onChange={e => setForm(f => ({ ...f, responsableNomLibre: e.target.value }))}
                      className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="tache-deadline" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Deadline</label>
                  <input
                    id="tache-deadline"
                    type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
                <div>
                  <label htmlFor="tache-statut" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Statut</label>
                  <select
                    id="tache-statut"
                    value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Tache['statut'] }))}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  >
                    {Object.entries(STATUT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tache-date-realisation" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Date de réalisation</label>
                  <input
                    id="tache-date-realisation"
                    type="date" value={form.dateRealisation} onChange={e => setForm(f => ({ ...f, dateRealisation: e.target.value }))}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
              </div>

              <div className="mb-lg">
                <label htmlFor="tache-realisateur" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Réalisée par</label>
                <select
                  id="tache-realisateur"
                  value={form.realisateurId}
                  onChange={e => setForm(f => ({ ...f, realisateurId: e.target.value }))}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm mb-xs focus:outline-none focus:border-brand-petrol"
                >
                  <option value="">— Nom libre —</option>
                  {membresOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                  ))}
                </select>
                {!form.realisateurId && (
                  <input
                    aria-label="Nom libre du réalisateur"
                    placeholder="Nom libre" value={form.realisateurNomLibre}
                    onChange={e => setForm(f => ({ ...f, realisateurNomLibre: e.target.value }))}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                )}
              </div>

              <div className="flex gap-sm">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>
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

function TacheCard({ tache, enRetard, responsableNom, onEdit, onDelete }: {
  tache: Tache
  enRetard: boolean
  responsableNom: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`signature-card ${enRetard ? 'border-brand-brick' : ''}`}>
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs flex-wrap">
            <span className={`tag ${STATUT_CLASSES[tache.statut]}`}>{STATUT_LABELS[tache.statut]}</span>
            {enRetard && <span className="tag border-brand-brick text-brand-brick">Deadline dépassée</span>}
          </div>
          <h3 className="font-display font-bold uppercase text-lg leading-tight">{tache.titre}</h3>
          {tache.description && <p className="text-sm text-brand-ink/60 mt-xs">{tache.description}</p>}
          <div className="flex gap-md mt-xs text-xs text-brand-ink/40 flex-wrap">
            {responsableNom && <span>Responsable : {responsableNom}</span>}
            {tache.deadline && (
              <span className={enRetard ? 'text-brand-brick font-semibold' : ''}>
                Deadline : {new Date(tache.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            {tache.date_realisation && (
              <span>Réalisée le {new Date(tache.date_realisation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-md flex-wrap print:hidden">
          <button onClick={onEdit} className="text-sm text-brand-petrol hover:underline font-semibold">
            Modifier
          </button>
          <button onClick={onDelete} className="text-sm text-brand-brick hover:underline font-semibold">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
