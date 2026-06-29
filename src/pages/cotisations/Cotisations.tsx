import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Membre, Cotisation } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

export default function Cotisations() {
  const [membres, setMembres] = useState<Membre[]>([])
  const [cotisations, setCotisations] = useState<Cotisation[]>([])
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, annee])

  const fetchData = async () => {
    const [{ data: membresData }, { data: cotData }] = await Promise.all([
      supabase.from('membres').select('*').order('nom'),
      supabase.from('cotisations').select('*').eq('annee', annee),
    ])

    setMembres(membresData || [])
    setCotisations(cotData || [])
    setLoading(false)
  }

  const validerPaiement = async (membreId: string) => {
    if (!isAdmin) return

    // Volontairement irréversible : une fois payée, une cotisation ne doit
    // plus pouvoir être repassée à "non payée" depuis l'interface.
    const { error } = await supabase.from('cotisations').upsert({
      membre_id: membreId,
      annee,
      paye: true,
      date_paiement: new Date().toISOString(),
    })

    if (!error) {
      fetchData()
    }
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
        eyebrowCode="§04"
        eyebrowLabel="Trésorerie"
        title="Cotisations annuelles"
        subtitle={`Suivi des cotisations - Année ${annee}`}
      />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        <div className="flex items-center gap-md mb-xl">
          <label className="uppercase text-xs tracking-[0.1em] font-semibold text-brand-petrol">Année :</label>
          <select
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            className="border border-brand-hairline bg-brand-paper px-md py-sm focus:outline-none focus:border-brand-petrol"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <span className="text-sm text-brand-ink/50">
            {cotisations.filter(c => c.paye).length} / {membres.length} cotisations payées
          </span>
        </div>

        <div className="border border-brand-hairline bg-brand-paper">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-brand-ink text-brand-parchment">
                <th className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">Nom</th>
                <th className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">Statut</th>
                <th className="text-center py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">Cotisation</th>
                {isAdmin && (
                  <th className="text-center py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {membres.map((membre, i) => {
                const cotisation = cotisations.find(c => c.membre_id === membre.id)
                return (
                  <tr
                    key={membre.id}
                    className={`border-t border-brand-hairline ${i % 2 === 1 ? 'bg-brand-parchment/50' : ''} hover:bg-brand-sky/10`}
                  >
                    <td className="py-sm px-md font-medium">
                      {membre.prenom} {membre.nom}
                    </td>
                    <td className="py-sm px-md">
                      <span className={`tag ${getStatutClass(membre.statut)}`}>
                        {getStatutLabel(membre.statut)}
                      </span>
                    </td>
                    <td className="py-sm px-md text-center">
                      {cotisation?.paye ? (
                        <span className="text-success font-semibold">✓ Payé</span>
                      ) : (
                        <span className="text-brand-ink/40">En attente</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-sm px-md text-center">
                        {!cotisation?.paye && (
                          <button
                            onClick={() => validerPaiement(membre.id)}
                            className="text-sm text-brand-petrol hover:underline font-semibold"
                          >
                            Valider paiement
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!membres.length && (
          <div className="text-center py-xxl text-brand-ink/50">
            Aucun membre enregistré.
          </div>
        )}
      </main>
    </div>
  )
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
