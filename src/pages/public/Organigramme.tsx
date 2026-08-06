import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Membre } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import BoutonImprimer, { EnteteImpression } from '../../components/Layout/BoutonImprimer'
import Avatar from '../../components/Layout/Avatar'

const POSTES_UNIQUES = ['president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']
const STATUTS = ['actif', 'passif', 'honoraire']

const BRANCHES = [
  { titre: 'Président', roleChef: 'president', roleAdjoint: 'adjoint_president' },
  { titre: 'Secrétaire', roleChef: 'secretaire', roleAdjoint: 'adjoint_secretaire' },
  { titre: 'Trésorier', roleChef: 'tresorier', roleAdjoint: 'adjoint_tresorier' },
] as const

export default function Organigramme() {
  const { user, canManageMembres, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tousMembres, setTousMembres] = useState<Membre[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'nom' | 'prenom' | 'statut'>('nom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: 'nom' | 'prenom' | 'statut') => {
    if (col === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

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
    const { data } = await supabase.from('membres').select('*').order('nom')
    setTousMembres(data || [])
    setLoading(false)
  }

  const membresSimples = useMemo(() => {
    const sorted = tousMembres
      .filter((m) => !POSTES_UNIQUES.includes(m.role))
      .sort((a, b) => (a[sortBy] ?? '').localeCompare(b[sortBy] ?? '', 'fr', { sensitivity: 'base' }))
    return sortDir === 'desc' ? sorted.reverse() : sorted
  }, [tousMembres, sortBy, sortDir])

  const handleAssignPoste = async (role: string, membreId: string) => {
    const ancien = tousMembres.find((m) => m.role === role)
    if (ancien && ancien.id === membreId) return

    if (ancien) {
      const { error } = await supabase.from('membres').update({ role: 'membre_actif', date_nomination: null }).eq('id', ancien.id)
      if (error) { window.alert(`Erreur : ${error.message}`); return }
    }
    if (membreId) {
      const { error } = await supabase
        .from('membres')
        .update({ role, date_nomination: new Date().toISOString().slice(0, 10) })
        .eq('id', membreId)
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment font-body">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-brand-petrol border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-brand-ink/70 uppercase text-xs tracking-[0.2em]">Chargement du registre…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode="§01"
        eyebrowLabel="Organigramme"
        title={<>Amicale des<br />Sapeurs-Pompiers<br />de La Madeleine</>}
        subtitle="Organigramme, effectifs et vie associative de la caserne."
      />
      <div className="chevron-band" />

      <div className="max-w-6xl mx-auto px-md md:px-xl pt-lg flex justify-end print:hidden">
        <BoutonImprimer targetId="impression-organigramme" titre="Organigramme" orientation="landscape" />
      </div>

      <div id="impression-organigramme">
      <EnteteImpression titre="Organigramme et registre des membres" />

      {/* BUREAU */}
      <section className="py-section print:py-0 px-md md:px-xl max-w-6xl mx-auto">
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl print:text-xl mb-xs">Le bureau actuel</h2>
        {canManageMembres && (
          <p className="text-sm text-brand-ink/50 mb-xl print:hidden">Choisis le membre qui occupe chaque poste.</p>
        )}

        <div className="grid md:grid-cols-3 print:grid-cols-3 gap-lg print:gap-sm print:mt-sm">
          {BRANCHES.map((branche) => (
            <div key={branche.roleChef} className="space-y-lg print:space-y-xs">
              <PosteCard
                titre={branche.titre}
                role={branche.roleChef}
                titulaire={tousMembres.find((m) => m.role === branche.roleChef)}
                tousMembres={tousMembres}
                canManageMembres={canManageMembres}
                onAssign={handleAssignPoste}
                onDelete={handleDeleteMembre}
              />
              <div className="ml-lg print:ml-sm border-l-2 border-brand-hairline pl-lg print:pl-sm">
                <PosteCard
                  titre={`Adjoint au ${branche.titre}`}
                  role={branche.roleAdjoint}
                  titulaire={tousMembres.find((m) => m.role === branche.roleAdjoint)}
                  tousMembres={tousMembres}
                  canManageMembres={canManageMembres}
                  onAssign={handleAssignPoste}
                  onDelete={handleDeleteMembre}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MEMBRES — registre d'appel */}
      <section className="py-section print:py-0 print:break-before-page px-md md:px-xl max-w-6xl mx-auto">
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl mb-xl">Membres de l'amicale</h2>

        <div className="border border-brand-hairline bg-brand-paper overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-brand-ink text-brand-parchment">
                {(['nom', 'prenom', 'statut'] as const).map(col => (
                  <th key={col} className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em]">
                    <button onClick={() => handleSort(col)} className={`hover:text-brand-sky transition-colors ${sortBy === col ? 'text-brand-sky' : ''}`}>
                      {{ nom: 'Nom', prenom: 'Prénom', statut: 'Statut' }[col]} {sortBy === col && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                ))}
                {canManageMembres && (
                  <th className="text-left py-sm px-md font-semibold uppercase text-xs tracking-[0.15em] print:hidden"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {membresSimples.map((membre, i) => (
                <tr
                  key={membre.id}
                  className={`border-t border-brand-hairline ${i % 2 === 1 ? 'bg-brand-parchment/50' : ''} hover:bg-brand-sky/10`}
                >
                  <td className="py-sm px-md font-medium">
                    <div className="flex items-center gap-sm">
                      <Avatar prenom={membre.prenom} nom={membre.nom} photoUrl={membre.photo_url} size="sm" />
                      {membre.nom}
                    </div>
                  </td>
                  <td className="py-sm px-md">{membre.prenom}</td>
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
                  {canManageMembres && (
                    <td className="py-sm px-md print:hidden">
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
      </section>
      </div>

      <div className="chevron-band print:hidden" />

      <footer className="bg-brand-ink text-brand-parchment py-xl px-xl print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <img src="/Logo.png" alt="" className="h-8 w-auto opacity-90" />
            <span className="font-display uppercase tracking-[0.1em] text-sm">Amicale La Madeleine</span>
          </div>
          <p className="text-xs text-brand-parchment/60">
            © {new Date().getFullYear()} Amicale des Sapeurs-Pompiers de La Madeleine — Depuis 1847
          </p>
        </div>
      </footer>
    </div>
  )
}

function PosteCard({
  titre,
  role,
  titulaire,
  tousMembres,
  canManageMembres,
  onAssign,
  onDelete,
}: {
  titre: string
  role: string
  titulaire: Membre | undefined
  tousMembres: Membre[]
  canManageMembres: boolean
  onAssign: (role: string, membreId: string) => void
  onDelete: (membre: Membre) => void
}) {
  const options = [...tousMembres].sort((a, b) => a.nom.localeCompare(b.nom))

  return (
    <div className="relative bg-brand-paper border border-brand-hairline max-w-md pt-lg pb-lg pl-lg pr-lg print:p-sm print:break-inside-avoid">
      <span className="absolute top-0 left-0 h-1 w-12 bg-brand-petrol print:hidden" />
      <div className="badge-tag absolute -top-3 right-lg bg-brand-brick text-brand-parchment text-[11px] uppercase tracking-[0.1em] font-semibold px-sm py-xs print:static print:bg-transparent print:text-brand-ink print:p-0 print:mb-xs print:block">
        {titre}
      </div>

      {titulaire ? (
        <>
          <div className="mt-md print:mt-xs flex items-center gap-md print:gap-sm">
            <Avatar prenom={titulaire.prenom} nom={titulaire.nom} photoUrl={titulaire.photo_url} />
            <h3 className="font-display font-bold text-2xl md:text-3xl print:text-lg leading-none">
              {titulaire.prenom}
              <br />
              {titulaire.nom.toUpperCase()}
            </h3>
          </div>
          {titulaire.date_nomination && (
            <p className="mt-sm text-brand-petrol text-xs uppercase tracking-[0.12em] print:mt-xxs">
              Nommé(e) le {formatDate(titulaire.date_nomination)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-md text-brand-ink/40 italic">Poste vacant</p>
      )}

      {canManageMembres && (
        <div className="mt-md print:hidden">
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">
            Titulaire
          </label>
          <select
            value={titulaire?.id ?? ''}
            onChange={(e) => onAssign(role, e.target.value)}
            className="w-full border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm"
          >
            <option value="">— Vacant —</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
            ))}
          </select>
        </div>
      )}

      {canManageMembres && titulaire && (
        <button
          onClick={() => onDelete(titulaire)}
          className="text-xs text-brand-brick hover:underline font-semibold mt-sm print:hidden"
        >
          Supprimer ce membre
        </button>
      )}
    </div>
  )
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const getStatutLabel = (statut: string): string => {
  const labels: Record<string, string> = {
    actif: 'Actif',
    passif: 'Passif',
    honoraire: 'Honoraire',
  }
  return labels[statut] || statut
}

const getStatutClass = (statut: string): string => {
  const classes: Record<string, string> = {
    actif: 'border-brand-petrol text-brand-petrol',
    passif: 'border-brand-hairline text-brand-ink/50',
    honoraire: 'border-brand-brick text-brand-brick',
  }
  return classes[statut] || ''
}
