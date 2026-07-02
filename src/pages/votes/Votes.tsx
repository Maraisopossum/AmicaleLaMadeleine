import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, Vote, VoteQuestion, VoteOption } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

const STATUTS_MEMBRES = ['actif', 'passif', 'honoraire']

type NouvelleQuestion = {
  libelle: string
  type: 'oui_non' | 'choix_unique' | 'choix_multiple'
  options: string[]
  max_choix: number | null
}

const QUESTION_VIDE: NouvelleQuestion = { libelle: '', type: 'oui_non', options: [], max_choix: null }

export default function Votes() {
  const [votes, setVotes] = useState<Vote[]>([])
  const [reponsesCount, setReponsesCount] = useState<Record<string, Set<string>>>({})
  const [membreStatut, setMembreStatut] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { user, isAdmin, membre, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Formulaire de création
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [anonyme, setAnonyme] = useState(false)
  const [statutsEligibles, setStatutsEligibles] = useState<string[]>(['actif'])
  const [dateFin, setDateFin] = useState('')
  const [questions, setQuestions] = useState<NouvelleQuestion[]>([{ ...QUESTION_VIDE }])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  useEffect(() => {
    if (membre) setMembreStatut(membre.statut)
  }, [membre])

  const fetchData = async () => {
    const { data } = await supabase.from('votes').select('*').order('created_at', { ascending: false })
    const votesList = data || []
    setVotes(votesList)

    // Pour chaque vote ouvert, récupérer les membres distincts ayant voté
    const ouverts = votesList.filter(v => v.statut === 'ouvert')
    if (ouverts.length) {
      const { data: reponses } = await supabase
        .from('vote_reponses')
        .select('vote_id, membre_id')
        .in('vote_id', ouverts.map(v => v.id))
      const counts: Record<string, Set<string>> = {}
      for (const r of reponses || []) {
        if (!counts[r.vote_id]) counts[r.vote_id] = new Set()
        counts[r.vote_id].add(r.membre_id)
      }
      setReponsesCount(counts)
    }
    setLoading(false)
  }

  const ajouterQuestion = () => setQuestions(qs => [...qs, { ...QUESTION_VIDE }])

  const supprimerQuestion = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i))

  const updateQuestion = (i: number, patch: Partial<NouvelleQuestion>) =>
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q))

  const ajouterOption = (qi: number) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, options: [...q.options, ''] } : q))

  const updateOption = (qi: number, oi: number, val: string) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi
      ? { ...q, options: q.options.map((o, oidx) => oidx === oi ? val : o) }
      : q))

  const supprimerOption = (qi: number, oi: number) =>
    setQuestions(qs => qs.map((q, idx) => idx === qi
      ? { ...q, options: q.options.filter((_, oidx) => oidx !== oi) }
      : q))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!titre.trim()) { setFormError('Le titre est obligatoire.'); return }
    if (!statutsEligibles.length) { setFormError('Sélectionnez au moins un statut éligible.'); return }
    for (const [i, q] of questions.entries()) {
      if (!q.libelle.trim()) { setFormError(`Question ${i + 1} : le libellé est obligatoire.`); return }
      if (q.type !== 'oui_non' && q.options.length < 2) { setFormError(`Question ${i + 1} : au moins 2 options requises.`); return }
      if (q.type !== 'oui_non' && q.options.some(o => !o.trim())) { setFormError(`Question ${i + 1} : toutes les options doivent être renseignées.`); return }
    }

    setSaving(true)
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert({
        titre: titre.trim(),
        description: description.trim() || null,
        anonyme,
        statuts_eligibles: statutsEligibles,
        date_fin: dateFin ? new Date(dateFin).toISOString() : null,
        cree_par: membre?.id ?? null,
      })
      .select()
      .single()

    if (voteError || !vote) { setFormError(voteError?.message || 'Erreur création vote.'); setSaving(false); return }

    for (const [i, q] of questions.entries()) {
      const { data: question, error: qError } = await supabase
        .from('vote_questions')
        .insert({ vote_id: vote.id, libelle: q.libelle.trim(), type: q.type, ordre: i, max_choix: q.type === 'choix_multiple' ? q.max_choix : null })
        .select()
        .single()
      if (qError || !question) { setFormError(qError?.message || 'Erreur création question.'); setSaving(false); return }

      if (q.type !== 'oui_non') {
        const { error: oError } = await supabase.from('vote_options').insert(
          q.options.map((o, oi) => ({ question_id: question.id, libelle: o.trim(), ordre: oi }))
        )
        if (oError) { setFormError(oError.message); setSaving(false); return }
      }
    }

    setSaving(false)
    setShowForm(false)
    resetForm()
    fetchData()
  }

  const resetForm = () => {
    setTitre(''); setDescription(''); setAnonyme(false)
    setStatutsEligibles(['actif']); setDateFin('')
    setQuestions([{ ...QUESTION_VIDE }]); setFormError('')
  }

  const handleDeleteVote = async (vote: Vote) => {
    if (!window.confirm(`Supprimer le vote "${vote.titre}" ? Cette action est définitive.`)) return
    await supabase.from('votes').delete().eq('id', vote.id)
    fetchData()
  }

  const handleOuvrir = async (vote: Vote) => {
    await supabase.from('votes').update({ statut: 'ouvert', updated_at: new Date().toISOString() }).eq('id', vote.id)
    fetchData()
  }

  const handleArchiver = async (vote: Vote) => {
    if (!window.confirm(`Clôturer le vote "${vote.titre}" ? Cette action est définitive.`)) return
    await supabase.from('votes').update({ statut: 'archive', updated_at: new Date().toISOString() }).eq('id', vote.id)
    fetchData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!user) return null

  const votesOuverts = votes.filter(v => v.statut === 'ouvert')
  const votesBrouillon = votes.filter(v => v.statut === 'brouillon')
  const votesArchives = votes.filter(v => v.statut === 'archive')

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel="Vie associative"
        title="Votes"
        subtitle="Votes et scrutins de l'amicale"
      />
      <div className="chevron-band" />

      <main className="max-w-4xl mx-auto p-xl">
        {isAdmin && (
          <div className="mb-xl">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Créer un vote
            </button>
          </div>
        )}

        {/* Votes ouverts */}
        {votesOuverts.length > 0 && (
          <section className="mb-xl">
            <h2 className="font-display font-bold uppercase text-2xl mb-lg">Votes en cours</h2>
            <div className="space-y-md">
              {votesOuverts.map(vote => {
                const eligible = membreStatut ? vote.statuts_eligibles.includes(membreStatut) : false
                const nbVotants = reponsesCount[vote.id]?.size ?? 0
                return (
                  <VoteCard
                    key={vote.id}
                    vote={vote}
                    badge={<span className="tag border-brand-petrol text-brand-petrol">En cours</span>}
                    meta={`${nbVotants} participant${nbVotants > 1 ? 's' : ''}`}
                    isAdmin={isAdmin}
                    actions={
                      <>
                        {eligible && (
                          <Link to={`/votes/${vote.id}`} className="text-sm text-brand-petrol hover:underline font-semibold">
                            Voter →
                          </Link>
                        )}
                        {!eligible && (
                          <span className="text-sm text-brand-ink/40">Non éligible</span>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleArchiver(vote)} className="text-sm text-brand-brick hover:underline font-semibold">
                            Clôturer
                          </button>
                        )}
                      </>
                    }
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* Brouillons — bureau uniquement */}
        {isAdmin && votesBrouillon.length > 0 && (
          <section className="mb-xl">
            <h2 className="font-display font-bold uppercase text-2xl mb-lg">Brouillons</h2>
            <div className="space-y-md">
              {votesBrouillon.map(vote => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  badge={<span className="tag border-brand-hairline text-brand-ink/50">Brouillon</span>}
                  isAdmin={isAdmin}
                  actions={
                    <>
                      <Link to={`/votes/${vote.id}`} className="text-sm text-brand-petrol hover:underline font-semibold">
                        Modifier
                      </Link>
                      <button onClick={() => handleOuvrir(vote)} className="text-sm text-brand-petrol hover:underline font-semibold">
                        Ouvrir le vote
                      </button>
                      <button onClick={() => handleDeleteVote(vote)} className="text-sm text-brand-brick hover:underline font-semibold">
                        Supprimer
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Archives */}
        {votesArchives.length > 0 && (
          <section className="mb-xl">
            <h2 className="font-display font-bold uppercase text-2xl mb-lg">Archives</h2>
            <div className="space-y-md">
              {votesArchives.map(vote => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  badge={<span className="tag border-brand-hairline text-brand-ink/40">Archivé</span>}
                  isAdmin={isAdmin}
                  actions={
                    <>
                      <Link to={`/votes/${vote.id}`} className="text-sm text-brand-petrol hover:underline font-semibold">
                        Voir les résultats →
                      </Link>
                      {isAdmin && (
                        <button onClick={() => handleDeleteVote(vote)} className="text-sm text-brand-brick hover:underline font-semibold">
                          Supprimer
                        </button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {votes.length === 0 && (
          <p className="text-center py-xxl text-brand-ink/40">Aucun vote enregistré.</p>
        )}
      </main>

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-start justify-center p-xl z-50 overflow-y-auto">
          <div className="signature-card w-full max-w-2xl my-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">Créer un vote</h2>
            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{formError}</div>
              )}

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre *</label>
                <input
                  required value={titre} onChange={e => setTitre(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Description</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)} rows={2}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
                <div>
                  <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Date de clôture</label>
                  <input
                    type="datetime-local" value={dateFin} onChange={e => setDateFin(e.target.value)}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
                <div className="flex flex-col justify-end pb-sm">
                  <label className="flex items-center gap-sm cursor-pointer">
                    <input type="checkbox" checked={anonyme} onChange={e => setAnonyme(e.target.checked)} className="w-4 h-4 accent-brand-petrol" />
                    <span className="text-sm font-semibold">Vote anonyme</span>
                  </label>
                </div>
              </div>

              <div className="mb-lg">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Statuts éligibles *</label>
                <div className="flex gap-md">
                  {STATUTS_MEMBRES.map(s => (
                    <label key={s} className="flex items-center gap-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statutsEligibles.includes(s)}
                        onChange={e => setStatutsEligibles(prev =>
                          e.target.checked ? [...prev, s] : prev.filter(x => x !== s)
                        )}
                        className="w-4 h-4 accent-brand-petrol"
                      />
                      <span className="text-sm capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Questions */}
              <div className="mb-lg">
                <div className="flex items-center justify-between mb-md">
                  <h3 className="font-display font-bold uppercase text-base">Questions</h3>
                  <button type="button" onClick={ajouterQuestion} className="btn-secondary text-xs">
                    + Ajouter une question
                  </button>
                </div>
                <div className="space-y-lg">
                  {questions.map((q, qi) => (
                    <div key={qi} className="border border-brand-hairline bg-brand-parchment p-md">
                      <div className="flex items-start justify-between gap-md mb-sm">
                        <span className="eyebrow text-xs">Question {qi + 1}</span>
                        {questions.length > 1 && (
                          <button type="button" onClick={() => supprimerQuestion(qi)} className="text-xs text-brand-brick hover:underline">
                            Supprimer
                          </button>
                        )}
                      </div>
                      <input
                        placeholder="Libellé de la question"
                        value={q.libelle}
                        onChange={e => updateQuestion(qi, { libelle: e.target.value })}
                        className="w-full border border-brand-hairline bg-brand-paper px-md py-sm mb-sm focus:outline-none focus:border-brand-petrol"
                      />
                      <div className="flex items-center gap-md flex-wrap mb-sm">
                        <select
                          value={q.type}
                          onChange={e => updateQuestion(qi, { type: e.target.value as NouvelleQuestion['type'], options: [], max_choix: null })}
                          className="border border-brand-hairline bg-brand-paper px-md py-sm focus:outline-none focus:border-brand-petrol"
                        >
                          <option value="oui_non">Oui / Non</option>
                          <option value="choix_unique">Choix unique</option>
                          <option value="choix_multiple">Choix multiple</option>
                        </select>
                        {q.type === 'choix_multiple' && (
                          <label className="flex items-center gap-sm text-sm">
                            <span className="text-brand-ink/60">Max. choix :</span>
                            <input
                              type="number" min={1} max={q.options.length || undefined}
                              placeholder="Illimité"
                              value={q.max_choix ?? ''}
                              onChange={e => updateQuestion(qi, { max_choix: e.target.value ? Number(e.target.value) : null })}
                              className="w-20 border border-brand-hairline bg-brand-paper px-sm py-xs focus:outline-none focus:border-brand-petrol"
                            />
                          </label>
                        )}
                      </div>

                      {q.type !== 'oui_non' && (
                        <div className="mt-sm space-y-xs">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="flex gap-xs">
                              <input
                                placeholder={`Option ${oi + 1}`}
                                value={o}
                                onChange={e => updateOption(qi, oi, e.target.value)}
                                className="flex-1 border border-brand-hairline bg-brand-paper px-md py-xs focus:outline-none focus:border-brand-petrol"
                              />
                              <button type="button" onClick={() => supprimerOption(qi, oi)} className="text-xs text-brand-brick px-sm">✕</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => ajouterOption(qi)} className="text-xs text-brand-petrol hover:underline font-semibold">
                            + Option
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-sm">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement…' : 'Enregistrer en brouillon'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowForm(false); resetForm() }}>
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

function VoteCard({ vote, badge, meta, actions, isAdmin }: {
  vote: Vote
  badge: React.ReactNode
  meta?: string
  actions: React.ReactNode
  isAdmin: boolean
}) {
  return (
    <div className="signature-card">
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs flex-wrap">
            {badge}
            {vote.anonyme && <span className="tag border-brand-hairline text-brand-ink/50">Anonyme</span>}
          </div>
          <h3 className="font-display font-bold uppercase text-lg leading-tight">{vote.titre}</h3>
          {vote.description && <p className="text-sm text-brand-ink/60 mt-xs">{vote.description}</p>}
          <div className="flex gap-md mt-xs text-xs text-brand-ink/40 flex-wrap">
            {meta && <span>{meta}</span>}
            {vote.date_fin && (
              <span>Clôture : {new Date(vote.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <span>Éligibles : {vote.statuts_eligibles.join(', ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-md flex-wrap">
          {actions}
        </div>
      </div>
    </div>
  )
}
