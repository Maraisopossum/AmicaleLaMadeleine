import { useState, useEffect } from 'react'
import { supabase, Candidature } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

const STATUT_LABELS: Record<Candidature['statut_eligibilite'], string> = {
  eligible: 'Éligible',
  a_verifier: 'À vérifier',
  pas_encore: 'Pas encore',
}

const STATUT_CLASSES: Record<Candidature['statut_eligibilite'], string> = {
  eligible: 'border-brand-petrol text-brand-petrol',
  a_verifier: 'border-brand-brick text-brand-brick',
  pas_encore: 'border-brand-hairline text-brand-ink/50',
}

const REPONSES_LABELS: Record<string, Record<string, string>> = {
  age: { under16: '< 16 ans', jsp: '16-17 ans', ok: '18-55 ans', over55: '> 55 ans' },
  residence: { oui: 'À proximité de la caserne', non: 'Pas à proximité (à discuter)' },
  dispo: { oui: 'Disponible', peut_etre: 'Disponibilité incertaine', non: 'Pas disponible' },
  droits_civiques: { oui: 'Droits civiques OK', non: 'Droits civiques KO', pas_sur: 'Droits civiques à vérifier' },
  casier: { oui: 'Casier vierge', non: 'Casier non vierge', pas_sur: 'Casier à vérifier' },
}

export default function Candidatures() {
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [loading, setLoading] = useState(true)
  const { user, accesCandidatures, loading: authLoading } = useAuth()

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    const { data } = await supabase.from('candidatures').select('*').order('created_at', { ascending: false })
    setCandidatures(data || [])
    setLoading(false)
  }

  const toggleTraite = async (candidature: Candidature) => {
    await supabase.from('candidatures').update({ traite: !candidature.traite }).eq('id', candidature.id)
    fetchData()
  }

  const handleDelete = async (candidature: Candidature) => {
    if (!window.confirm(`Supprimer la candidature de ${candidature.prenom} ${candidature.nom} ? Cette action est définitive.`)) return
    await supabase.from('candidatures').delete().eq('id', candidature.id)
    fetchData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!accesCandidatures) {
    return (
      <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
        <ModuleHeader eyebrowCode="" eyebrowLabel="Recrutement" title="Candidatures" />
        <div className="chevron-band" />
        <main className="max-w-4xl mx-auto p-xl">
          <p className="text-center py-xxl text-brand-ink/40">Ce module est réservé aux personnes désignées pour le suivi des candidatures.</p>
        </main>
      </div>
    )
  }

  const nonTraitees = candidatures.filter(c => !c.traite)
  const traitees = candidatures.filter(c => c.traite)

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel="Recrutement"
        title="Candidatures"
        subtitle="Contacts laissés via le quiz de recrutement"
      />
      <div className="chevron-band" />

      <main className="max-w-4xl mx-auto p-xl">
        <section className="mb-xl">
          <h2 className="font-display font-bold uppercase text-2xl mb-lg">À traiter ({nonTraitees.length})</h2>
          {nonTraitees.length === 0 && <p className="text-brand-ink/40">Aucune candidature en attente.</p>}
          <div className="space-y-md">
            {nonTraitees.map(c => <CandidatureCard key={c.id} candidature={c} onToggle={() => toggleTraite(c)} onDelete={() => handleDelete(c)} />)}
          </div>
        </section>

        {traitees.length > 0 && (
          <section>
            <h2 className="font-display font-bold uppercase text-2xl mb-lg">Traitées ({traitees.length})</h2>
            <div className="space-y-md">
              {traitees.map(c => <CandidatureCard key={c.id} candidature={c} onToggle={() => toggleTraite(c)} onDelete={() => handleDelete(c)} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function CandidatureCard({ candidature, onToggle, onDelete }: {
  candidature: Candidature
  onToggle: () => void
  onDelete: () => void
}) {
  const c = candidature
  return (
    <div className="signature-card">
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs flex-wrap">
            <span className={`tag ${STATUT_CLASSES[c.statut_eligibilite]}`}>{STATUT_LABELS[c.statut_eligibilite]}</span>
            {c.traite && <span className="tag border-brand-hairline text-brand-ink/40">Traitée</span>}
          </div>
          <h3 className="font-display font-bold uppercase text-lg leading-tight">{c.prenom} {c.nom}</h3>
          <div className="flex gap-md mt-xs text-sm text-brand-ink/70 flex-wrap">
            {c.telephone && <span>📞 {c.telephone}</span>}
            {c.email && <span>✉️ {c.email}</span>}
          </div>
          <div className="flex gap-xs mt-sm flex-wrap">
            {Object.entries(c.reponses || {}).map(([cle, valeur]) => (
              <span key={cle} className="text-xs bg-brand-parchment border border-brand-hairline px-xs py-xxs">
                {REPONSES_LABELS[cle]?.[valeur as string] || `${cle}: ${valeur}`}
              </span>
            ))}
          </div>
          <p className="text-xs text-brand-ink/40 mt-sm">
            {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-md flex-wrap">
          <button onClick={onToggle} className="text-sm text-brand-petrol hover:underline font-semibold">
            {c.traite ? 'Marquer à traiter' : 'Marquer traitée'}
          </button>
          <button onClick={onDelete} className="text-sm text-brand-brick hover:underline font-semibold">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
