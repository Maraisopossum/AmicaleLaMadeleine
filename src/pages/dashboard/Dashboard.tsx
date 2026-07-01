import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, Evenement } from '../../lib/supabase'
import ModuleHeader from '../../components/Layout/ModuleHeader'


export default function Dashboard() {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [prochainsEvenements, setProchainsEvenements] = useState<Evenement[]>([])
  const [votesEnCours, setVotesEnCours] = useState(0)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!user) return
    supabase
      .from('evenements')
      .select('*')
      .gte('date_debut', new Date().toISOString())
      .order('date_debut', { ascending: true })
      .limit(5)
      .then(({ data }) => setProchainsEvenements(data || []))
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'ouvert')
      .then(({ count }) => setVotesEnCours(count || 0))
  }, [user])

  if (loading) {
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
        eyebrowCode="§00"
        eyebrowLabel="Tableau de bord"
        title={isAdmin ? 'Espace administration' : 'Espace membres'}
        rightSlot={
          <button
            onClick={() => supabase.auth.signOut()}
            className="border border-brand-sky/60 text-brand-parchment uppercase text-xs tracking-[0.15em] font-semibold px-md py-xs hover:bg-brand-sky hover:text-brand-ink transition-colors"
          >
            Déconnexion
          </button>
        }
      />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        {prochainsEvenements.length > 0 && (
          <div className="mb-xl space-y-sm">
            <p className="eyebrow">À venir</p>
            {prochainsEvenements.map((event) => (
              <Link
                key={event.id}
                to={`/calendrier?focus=${event.date_debut.slice(0, 10)}`}
                className="flex items-center gap-md bg-brand-ink text-brand-parchment px-md py-sm hover:bg-brand-petrol transition-colors"
              >
                <span className="font-display font-bold text-brand-sky whitespace-nowrap">
                  {formatDateCourte(event.date_debut)}
                </span>
                <span className="font-medium truncate">{event.titre}</span>
                <span className="ml-auto text-xs uppercase tracking-[0.1em] text-brand-parchment/60 whitespace-nowrap">
                  {getTypeLabel(event.type)} →
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
          <Link to="/organigramme" className="signature-card block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-petrol" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Organigramme</h3>
            <p className="text-sm text-brand-ink/70">Bureau et membres de l'amicale</p>
          </Link>

          <Link to="/membres" className="signature-card signature-coral block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-sky" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Membres</h3>
            <p className="text-sm opacity-90">
              {isAdmin ? 'Ajouter, modifier, supprimer des membres' : 'Liste des membres de l\'amicale'}
            </p>
          </Link>

          <Link to="/documents" className="signature-card block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-brick" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Documents</h3>
            <p className="text-sm text-brand-ink/70">Statuts, règlement, archives</p>
          </Link>

          <Link to="/cotisations" className="signature-card signature-coral block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-sky" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Cotisations</h3>
            <p className="text-sm opacity-90">Suivi annuel des paiements</p>
          </Link>

          <Link to="/calendrier" className="signature-card block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-brick" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Calendrier</h3>
            <p className="text-sm text-brand-ink/70">Événements et AG</p>
          </Link>

          <Link to="/mon-compte" className="signature-card signature-coral block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-sky" />
            <h3 className="font-display font-bold uppercase text-xl mt-sm mb-xs">Mon compte</h3>
            <p className="text-sm opacity-90">Changer mon mot de passe</p>
          </Link>

          <Link to="/votes" className="signature-card block">
            <span className="absolute top-0 left-0 h-1 w-12 bg-brand-brick" />
            <div className="flex items-start justify-between mt-sm mb-xs">
              <h3 className="font-display font-bold uppercase text-xl">Votes</h3>
              {votesEnCours > 0 && (
                <span className="bg-brand-brick text-brand-parchment text-xs font-bold px-sm py-xxs leading-none">
                  {votesEnCours} en cours
                </span>
              )}
            </div>
            <p className="text-sm text-brand-ink/70">Scrutins et votes associatifs</p>
          </Link>
        </div>
      </main>
    </div>
  )
}

const formatDateCourte = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    ag: 'AG',
    reunion: 'Réunion',
    activite: 'Activité',
    formation: 'Formation',
  }
  return labels[type] || type
}
