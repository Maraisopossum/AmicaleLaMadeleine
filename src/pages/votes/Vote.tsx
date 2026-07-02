import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, Vote, VoteQuestion, VoteOption, VoteReponse } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

type QuestionAvecOptions = VoteQuestion & { options: VoteOption[] }
type ReponseLocale = { valeur_oui_non?: boolean; option_ids?: string[] }

export default function VotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin, membre, loading: authLoading } = useAuth()

  const [vote, setVote] = useState<Vote | null>(null)
  const [questions, setQuestions] = useState<QuestionAvecOptions[]>([])
  const [mesReponses, setMesReponses] = useState<VoteReponse[]>([])
  const [toutesReponses, setToutesReponses] = useState<VoteReponse[]>([])
  const [loading, setLoading] = useState(true)
  const [reponses, setReponses] = useState<Record<string, ReponseLocale>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user && id) fetchVote()
  }, [user, id])

  const fetchVote = async () => {
    const { data: voteData } = await supabase.from('votes').select('*').eq('id', id).single()
    if (!voteData) { navigate('/votes'); return }
    setVote(voteData)

    const { data: questionsData } = await supabase
      .from('vote_questions').select('*').eq('vote_id', id).order('ordre')
    const { data: optionsData } = await supabase
      .from('vote_options').select('*')
      .in('question_id', (questionsData || []).map(q => q.id)).order('ordre')

    const qAvecOptions = (questionsData || []).map(q => ({
      ...q,
      options: (optionsData || []).filter(o => o.question_id === q.id),
    }))
    setQuestions(qAvecOptions)

    if (membre) {
      const { data: mesRep } = await supabase
        .from('vote_reponses').select('*').eq('vote_id', id).eq('membre_id', membre.id)
      setMesReponses(mesRep || [])
      if ((mesRep || []).length > 0) setSubmitted(true)
    }

    if (voteData.statut === 'archive' || isAdmin) {
      const { data: toutesRep } = await supabase
        .from('vote_reponses').select('*').eq('vote_id', id)
      setToutesReponses(toutesRep || [])
    }

    setLoading(false)
  }

  const handleReponse = (questionId: string, patch: ReponseLocale) =>
    setReponses(prev => ({ ...prev, [questionId]: patch }))

  const handleToggleOption = (questionId: string, optionId: string, multiple: boolean, maxChoix: number | null) => {
    const current = reponses[questionId]?.option_ids || []
    if (multiple) {
      if (current.includes(optionId)) {
        handleReponse(questionId, { option_ids: current.filter(id => id !== optionId) })
      } else if (maxChoix === null || current.length < maxChoix) {
        handleReponse(questionId, { option_ids: [...current, optionId] })
      }
    } else {
      handleReponse(questionId, { option_ids: [optionId] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!membre || !vote) return
    setSubmitError('')

    for (const q of questions) {
      const r = reponses[q.id]
      if (q.type === 'oui_non' && r?.valeur_oui_non === undefined) {
        setSubmitError(`Question "${q.libelle}" : répondez Oui ou Non.`); return
      }
      if (q.type !== 'oui_non' && (!r?.option_ids || r.option_ids.length === 0)) {
        setSubmitError(`Question "${q.libelle}" : sélectionnez au moins une option.`); return
      }
    }

    setSubmitting(true)
    for (const q of questions) {
      const r = reponses[q.id]
      const { error } = await supabase.from('vote_reponses').insert({
        vote_id: vote.id,
        question_id: q.id,
        membre_id: membre.id,
        valeur_oui_non: q.type === 'oui_non' ? r?.valeur_oui_non ?? null : null,
        option_ids: q.type !== 'oui_non' ? r?.option_ids ?? null : null,
      })
      if (error) { setSubmitError(error.message); setSubmitting(false); return }
    }

    setSubmitting(false)
    setSubmitted(true)
    fetchVote()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!user || !vote) return null

  const eligible = membre ? vote.statuts_eligibles.includes(membre.statut) : false
  const peutVoter = vote.statut === 'ouvert' && eligible && !submitted
  const afficherResultats = vote.statut === 'archive'

  // Calcule les résultats pour une question
  const getResultats = (q: QuestionAvecOptions) => {
    const reponsesQ = toutesReponses.filter(r => r.question_id === q.id)
    const totalVotants = new Set(toutesReponses.map(r => r.membre_id)).size

    if (q.type === 'oui_non') {
      const oui = reponsesQ.filter(r => r.valeur_oui_non === true).length
      const non = reponsesQ.filter(r => r.valeur_oui_non === false).length
      return { type: 'oui_non' as const, oui, non, total: reponsesQ.length, totalVotants, reponsesQ }
    }
    const counts: Record<string, number> = {}
    for (const r of reponsesQ) {
      for (const oid of r.option_ids || []) {
        counts[oid] = (counts[oid] || 0) + 1
      }
    }
    return { type: 'options' as const, counts, total: reponsesQ.length, totalVotants, reponsesQ }
  }

  // Nombre total d'éligibles ayant voté (pour le taux de participation)
  const votantsDistincts = new Set(toutesReponses.map(r => r.membre_id)).size

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel={vote.statut === 'archive' ? 'Résultats' : vote.statut === 'brouillon' ? 'Brouillon' : 'Vote en cours'}
        title={vote.titre}
        subtitle={vote.description || undefined}
      />
      <div className="chevron-band" />

      <main className="max-w-3xl mx-auto p-xl">
        {/* Infos vote */}
        <div className="flex gap-sm mb-xl flex-wrap">
          <StatutBadge statut={vote.statut} />
          {vote.anonyme && <span className="tag border-brand-hairline text-brand-ink/50">Anonyme</span>}
          <span className="tag border-brand-hairline text-brand-ink/50">Éligibles : {vote.statuts_eligibles.join(', ')}</span>
          {vote.date_fin && (
            <span className="tag border-brand-hairline text-brand-ink/50">
              Clôture : {new Date(vote.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Résultats (après clôture) */}
        {afficherResultats && (
          <div className="mb-xl">
            <div className="mb-lg flex items-center gap-md">
              <h2 className="font-display font-bold uppercase text-2xl">Résultats</h2>
              <span className="text-sm text-brand-ink/50">{votantsDistincts} participant{votantsDistincts > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-xl">
              {questions.map(q => {
                const res = getResultats(q)
                return (
                  <div key={q.id} className="border border-brand-hairline bg-brand-paper p-lg">
                    <p className="font-semibold mb-md">{q.libelle}</p>
                    {res.type === 'oui_non' ? (
                      <div className="space-y-sm">
                        <BarreResultat label="Oui" count={res.oui} total={res.total} />
                        <BarreResultat label="Non" count={res.non} total={res.total} />
                        {!vote.anonyme && res.reponsesQ.length > 0 && isAdmin && (
                          <DetailNonAnonyme reponses={res.reponsesQ} toutesReponses={toutesReponses} type="oui_non" />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-sm">
                        {q.options.map(o => (
                          <BarreResultat
                            key={o.id}
                            label={o.libelle}
                            count={res.counts[o.id] || 0}
                            total={res.total}
                          />
                        ))}
                        {!vote.anonyme && res.reponsesQ.length > 0 && isAdmin && (
                          <DetailNonAnonyme reponses={res.reponsesQ} toutesReponses={toutesReponses} type="options" options={q.options} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Formulaire de vote */}
        {vote.statut === 'ouvert' && (
          <div>
            {submitted ? (
              <div className="signature-card text-center py-xl">
                <p className="font-display font-bold uppercase text-xl text-brand-petrol mb-sm">✓ Vote enregistré</p>
                <p className="text-sm text-brand-ink/60">Merci pour votre participation.</p>
              </div>
            ) : !eligible ? (
              <div className="signature-card text-center py-xl">
                <p className="text-brand-ink/50">Vous n'êtes pas éligible à ce vote.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="font-display font-bold uppercase text-2xl mb-lg">Votre vote</h2>
                {submitError && (
                  <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{submitError}</div>
                )}
                <div className="space-y-xl">
                  {questions.map((q, qi) => (
                    <div key={q.id} className="border border-brand-hairline bg-brand-paper p-lg">
                      <p className="font-semibold mb-md">
                        <span className="text-brand-petrol mr-sm">{qi + 1}.</span>{q.libelle}
                      </p>
                      {q.type === 'oui_non' && (
                        <div className="flex gap-md">
                          {[true, false].map(val => (
                            <label key={String(val)} className={`flex items-center gap-sm cursor-pointer border px-lg py-sm flex-1 justify-center transition-colors ${reponses[q.id]?.valeur_oui_non === val ? 'border-brand-petrol bg-brand-petrol/10 text-brand-petrol font-semibold' : 'border-brand-hairline hover:border-brand-petrol/50'}`}>
                              <input
                                type="radio" name={q.id} className="sr-only"
                                checked={reponses[q.id]?.valeur_oui_non === val}
                                onChange={() => handleReponse(q.id, { valeur_oui_non: val })}
                              />
                              {val ? 'Oui' : 'Non'}
                            </label>
                          ))}
                        </div>
                      )}
                      {q.type !== 'oui_non' && (
                        <div className="space-y-sm">
                          {q.type === 'choix_multiple' && q.max_choix && (
                            <p className="text-xs text-brand-ink/50">
                              {(reponses[q.id]?.option_ids || []).length} / {q.max_choix} choix sélectionné{q.max_choix > 1 ? 's' : ''}
                            </p>
                          )}
                          {q.options.map(o => {
                            const selected = (reponses[q.id]?.option_ids || []).includes(o.id)
                            const atMax = q.type === 'choix_multiple' && q.max_choix !== null && (reponses[q.id]?.option_ids || []).length >= q.max_choix && !selected
                            return (
                              <label key={o.id} className={`flex items-center gap-sm border px-md py-sm transition-colors ${atMax ? 'cursor-not-allowed opacity-40 border-brand-hairline' : 'cursor-pointer'} ${selected ? 'border-brand-petrol bg-brand-petrol/10 text-brand-petrol font-semibold' : !atMax ? 'border-brand-hairline hover:border-brand-petrol/50' : ''}`}>
                                <input
                                  type={q.type === 'choix_multiple' ? 'checkbox' : 'radio'}
                                  name={q.id} className="sr-only"
                                  checked={selected}
                                  disabled={atMax}
                                  onChange={() => handleToggleOption(q.id, o.id, q.type === 'choix_multiple', q.max_choix)}
                                />
                                {o.libelle}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-xl">
                  <button type="submit" disabled={submitting} className="btn-primary w-full">
                    {submitting ? 'Envoi…' : 'Soumettre mon vote'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Brouillon — aperçu pour le bureau */}
        {vote.statut === 'brouillon' && isAdmin && (
          <div className="space-y-lg">
            <div className="border border-brand-hairline bg-brand-paper p-lg">
              <p className="eyebrow mb-md">Aperçu des questions</p>
              {questions.map((q, qi) => (
                <div key={q.id} className="mb-md last:mb-0">
                  <p className="font-semibold"><span className="text-brand-petrol mr-sm">{qi + 1}.</span>{q.libelle}</p>
                  <p className="text-xs text-brand-ink/50 mt-xxs">{q.type === 'oui_non' ? 'Oui / Non' : q.type === 'choix_unique' ? 'Choix unique' : 'Choix multiple'}</p>
                  {q.options.length > 0 && (
                    <ul className="mt-xs ml-md list-disc text-sm text-brand-ink/70">
                      {q.options.map(o => <li key={o.id}>{o.libelle}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === 'ouvert') return <span className="tag border-brand-petrol text-brand-petrol">En cours</span>
  if (statut === 'brouillon') return <span className="tag border-brand-hairline text-brand-ink/50">Brouillon</span>
  return <span className="tag border-brand-hairline text-brand-ink/40">Archivé</span>
}

function BarreResultat({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-xxs">
        <span>{label}</span>
        <span className="font-semibold">{count} <span className="text-brand-ink/40 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-brand-hairline">
        <div className="h-2 bg-brand-petrol transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DetailNonAnonyme({ reponses, toutesReponses, type, options }: {
  reponses: any[]
  toutesReponses: any[]
  type: 'oui_non' | 'options'
  options?: VoteOption[]
}) {
  return (
    <details className="mt-md text-xs text-brand-ink/60">
      <summary className="cursor-pointer hover:text-brand-ink font-semibold uppercase tracking-[0.1em]">Détail par membre</summary>
      <ul className="mt-sm space-y-xxs pl-md">
        {reponses.map(r => (
          <li key={r.id}>
            <span className="font-medium text-brand-ink">{r.membre_id}</span>
            {' → '}
            {type === 'oui_non'
              ? (r.valeur_oui_non ? 'Oui' : 'Non')
              : (options || []).filter(o => (r.option_ids || []).includes(o.id)).map(o => o.libelle).join(', ')
            }
          </li>
        ))}
      </ul>
    </details>
  )
}
