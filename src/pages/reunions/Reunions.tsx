import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, Reunion } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

export default function Reunions() {
  const [reunions, setReunions] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [titre, setTitre] = useState('')
  const [dateReunion, setDateReunion] = useState(new Date().toISOString().slice(0, 10))
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    const { data } = await supabase.from('reunions').select('*').order('date_reunion', { ascending: false })
    setReunions(data || [])
    setLoading(false)
  }

  const handleCreer = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!titre.trim()) { setFormError('Le titre est obligatoire.'); return }

    setCreating(true)
    const { data, error } = await supabase
      .from('reunions')
      .insert({ titre: titre.trim(), date_reunion: dateReunion })
      .select()
      .single()
    setCreating(false)

    if (error || !data) { setFormError(error?.message || 'Erreur de création.'); return }
    navigate(`/reunions/${data.id}`)
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
        title="Réunions"
        subtitle="Comptes-rendus des réunions et assemblées générales"
      />
      <div className="chevron-band" />

      <main className="max-w-4xl mx-auto p-xl">
        {isAdmin && (
          <div className="mb-xl">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Nouvelle réunion
            </button>
          </div>
        )}

        {reunions.length === 0 && (
          <p className="text-center py-xxl text-brand-ink/40">Aucune réunion enregistrée.</p>
        )}

        <div className="space-y-md">
          {reunions.map(reunion => (
            <Link key={reunion.id} to={`/reunions/${reunion.id}`} className="signature-card block">
              <div className="flex items-start justify-between gap-md flex-wrap">
                <div>
                  <div className="flex items-center gap-sm mb-xs">
                    <span className={`tag ${reunion.statut === 'publie' ? 'border-brand-petrol text-brand-petrol' : 'border-brand-hairline text-brand-ink/50'}`}>
                      {reunion.statut === 'publie' ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <h3 className="font-display font-bold uppercase text-lg leading-tight">{reunion.titre}</h3>
                </div>
                <p className="text-sm text-brand-ink/50">
                  {new Date(reunion.date_reunion).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={() => setShowForm(false)}>
          <div className="signature-card max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">Nouvelle réunion</h2>
            <form onSubmit={handleCreer}>
              {formError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{formError}</div>
              )}
              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre *</label>
                <input
                  required value={titre} onChange={e => setTitre(e.target.value)}
                  placeholder="Ex : Réunion de bureau, Assemblée générale…"
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>
              <div className="mb-lg">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Date *</label>
                <input
                  type="date" required value={dateReunion} onChange={e => setDateReunion(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>
              <div className="flex gap-sm">
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Création…' : 'Créer et rédiger'}
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
