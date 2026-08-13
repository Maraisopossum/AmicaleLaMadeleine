import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, Reunion, ReunionPresence, Membre, SectionLibre } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import BoutonImprimer, { EnteteImpression } from '../../components/Layout/BoutonImprimer'
import ChampDictee from '../../components/ChampDictee'

const STATUT_PRESENCE_LABELS: Record<ReunionPresence['statut'], string> = {
  present: 'Présent',
  excuse: 'Excusé',
  absent: 'Absent',
}

const ROLES_BUREAU = ['president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']

export default function ReunionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin, loading: authLoading } = useAuth()

  const [reunion, setReunion] = useState<Reunion | null>(null)
  const [membresActifs, setMembresActifs] = useState<Membre[]>([])
  const [presences, setPresences] = useState<Record<string, ReunionPresence['statut']>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Champs éditables
  const [titre, setTitre] = useState('')
  const [dateReunion, setDateReunion] = useState('')
  const [ordreDuJour, setOrdreDuJour] = useState('')
  const [decisions, setDecisions] = useState('')
  const [prochainesEcheances, setProchainesEcheances] = useState('')
  const [sectionsLibres, setSectionsLibres] = useState<SectionLibre[]>([])
  const [bureauUniquement, setBureauUniquement] = useState(false)

  useEffect(() => {
    if (user && id) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  const fetchData = async () => {
    const [{ data: r }, { data: membres }, { data: pres }] = await Promise.all([
      supabase.from('reunions').select('*').eq('id', id).maybeSingle(),
      supabase.from('membres').select('*').eq('statut', 'actif').order('nom'),
      supabase.from('reunion_presences').select('*').eq('reunion_id', id),
    ])

    if (!r) { navigate('/reunions'); return }

    setReunion(r)
    setMembresActifs(membres || [])
    setTitre(r.titre)
    setDateReunion(r.date_reunion)
    setOrdreDuJour(r.ordre_du_jour || '')
    setDecisions(r.decisions || '')
    setProchainesEcheances(r.prochaines_echeances || '')
    setSectionsLibres(r.sections_libres || [])
    setBureauUniquement(r.bureau_uniquement)

    const map: Record<string, ReunionPresence['statut']> = {}
    for (const m of membres || []) map[m.id] = 'absent'
    for (const p of pres || []) map[p.membre_id] = p.statut
    setPresences(map)

    setLoading(false)
  }

  const membresPresence = bureauUniquement
    ? membresActifs.filter(m => ROLES_BUREAU.includes(m.role))
    : membresActifs

  const ajouterSectionLibre = () => setSectionsLibres(s => [...s, { titre: '', contenu: '' }])
  const supprimerSectionLibre = (i: number) => setSectionsLibres(s => s.filter((_, idx) => idx !== i))
  const updateSectionLibre = (i: number, patch: Partial<SectionLibre>) =>
    setSectionsLibres(s => s.map((sec, idx) => idx === i ? { ...sec, ...patch } : sec))

  const handleSave = async (statutOverride?: Reunion['statut']) => {
    if (!reunion) return
    setSaving(true)
    setSaveError('')

    const { error: rErr } = await supabase.from('reunions').update({
      titre: titre.trim(),
      date_reunion: dateReunion,
      ordre_du_jour: ordreDuJour.trim() || null,
      decisions: decisions.trim() || null,
      prochaines_echeances: prochainesEcheances.trim() || null,
      sections_libres: sectionsLibres.filter(s => s.titre.trim() || s.contenu.trim()),
      bureau_uniquement: bureauUniquement,
      ...(statutOverride ? { statut: statutOverride } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', reunion.id)

    if (rErr) { setSaveError(rErr.message); setSaving(false); return }

    const { error: pErr } = await supabase.from('reunion_presences').upsert(
      membresPresence.map(m => ({ reunion_id: reunion.id, membre_id: m.id, statut: presences[m.id] || 'absent' })),
      { onConflict: 'reunion_id,membre_id' }
    )
    if (pErr) { setSaveError(pErr.message); setSaving(false); return }

    setSaving(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!reunion) return
    if (!window.confirm(`Supprimer la réunion "${reunion.titre}" ? Cette action est définitive.`)) return
    await supabase.from('reunions').delete().eq('id', reunion.id)
    navigate('/reunions')
  }

  if (authLoading || loading || !reunion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  const presents = membresPresence.filter(m => presences[m.id] === 'present')
  const excuses = membresPresence.filter(m => presences[m.id] === 'excuse')
  const absents = membresPresence.filter(m => (presences[m.id] || 'absent') === 'absent')

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode=""
        eyebrowLabel={reunion.statut === 'publie' ? 'Compte-rendu publié' : 'Brouillon'}
        title={reunion.titre}
        subtitle={new Date(reunion.date_reunion).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      />
      <div className="chevron-band" />

      <main className="max-w-3xl mx-auto p-xl">
        <div className="flex justify-end mb-md print:hidden">
          <BoutonImprimer targetId="impression-reunion" titre={reunion.titre} orientation="portrait" />
        </div>

        <div id="impression-reunion">
          <EnteteImpression titre={`Compte-rendu — ${reunion.titre}`} />

          {saveError && (
            <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm print:hidden">{saveError}</div>
          )}

          {isAdmin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-lg print:hidden">
              <div>
                <label htmlFor="reuniondetail-titre" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre</label>
                <input
                  id="reuniondetail-titre"
                  value={titre} onChange={e => setTitre(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>
              <div>
                <label htmlFor="reuniondetail-date" className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Date</label>
                <input
                  id="reuniondetail-date"
                  type="date" value={dateReunion} onChange={e => setDateReunion(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>
              <label className="flex items-center gap-sm sm:col-span-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={bureauUniquement}
                  onChange={e => setBureauUniquement(e.target.checked)}
                  className="w-4 h-4 accent-brand-petrol"
                />
                Réunion du bureau (limiter la présence aux 6 membres élus)
              </label>
            </div>
          ) : null}

          {/* Présents / Excusés / Absents */}
          <section className="mb-lg">
            <p className="eyebrow mb-sm print:hidden">Présents / Excusés / Absents</p>
            {isAdmin && (
              <div className="border border-brand-hairline bg-brand-paper overflow-x-auto mb-md print:hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-ink text-brand-parchment">
                      <th className="text-left py-xs px-md font-semibold uppercase text-xs tracking-[0.1em]">Membre</th>
                      {(['present', 'excuse', 'absent'] as const).map(s => (
                        <th key={s} className="py-xs px-sm font-semibold uppercase text-xs tracking-[0.1em]">{STATUT_PRESENCE_LABELS[s]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {membresPresence.map(m => (
                      <tr key={m.id} className="border-t border-brand-hairline">
                        <td className="py-xs px-md">{m.prenom} {m.nom}</td>
                        {(['present', 'excuse', 'absent'] as const).map(s => (
                          <td key={s} className="text-center py-xs">
                            <input
                              type="radio"
                              name={`presence-${m.id}`}
                              checked={(presences[m.id] || 'absent') === s}
                              onChange={() => setPresences(p => ({ ...p, [m.id]: s }))}
                              className="w-4 h-4 accent-brand-petrol"
                              aria-label={`${m.prenom} ${m.nom} — ${STATUT_PRESENCE_LABELS[s]}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-md text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.1em] font-semibold mb-xs">Présents ({presents.length})</p>
                {presents.map(m => <p key={m.id}>{m.prenom} {m.nom}</p>)}
                {!presents.length && <p className="text-brand-ink/50">—</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.1em] font-semibold mb-xs">Excusés ({excuses.length})</p>
                {excuses.map(m => <p key={m.id}>{m.prenom} {m.nom}</p>)}
                {!excuses.length && <p className="text-brand-ink/50">—</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.1em] font-semibold mb-xs">Absents ({absents.length})</p>
                {absents.map(m => <p key={m.id}>{m.prenom} {m.nom}</p>)}
                {!absents.length && <p className="text-brand-ink/50">—</p>}
              </div>
            </div>
          </section>

          {/* Sections fixes */}
          {isAdmin ? (
            <>
              <ChampDictee label="Ordre du jour" value={ordreDuJour} onChange={setOrdreDuJour} />
              <ChampDictee label="Décisions" value={decisions} onChange={setDecisions} />
              <ChampDictee label="Prochaines échéances" value={prochainesEcheances} onChange={setProchainesEcheances} />
            </>
          ) : (
            <>
              <SectionLecture titre="Ordre du jour" contenu={ordreDuJour} />
              <SectionLecture titre="Décisions" contenu={decisions} />
              <SectionLecture titre="Prochaines échéances" contenu={prochainesEcheances} />
            </>
          )}

          {/* Sections libres */}
          {sectionsLibres.map((section, i) => (
            <div key={i} className="mb-md">
              {isAdmin ? (
                <>
                  <div className="flex items-center gap-sm mb-xs print:hidden">
                    <input
                      value={section.titre}
                      onChange={e => updateSectionLibre(i, { titre: e.target.value })}
                      placeholder="Titre de la section"
                      className="flex-1 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm font-semibold focus:outline-none focus:border-brand-petrol"
                    />
                    <button type="button" onClick={() => supprimerSectionLibre(i)} className="text-xs text-brand-brick hover:underline">
                      Supprimer
                    </button>
                  </div>
                  <ChampDictee label="" value={section.contenu} onChange={v => updateSectionLibre(i, { contenu: v })} />
                </>
              ) : (
                <SectionLecture titre={section.titre} contenu={section.contenu} />
              )}
            </div>
          ))}

          {isAdmin && (
            <button type="button" onClick={ajouterSectionLibre} className="btn-secondary text-xs mb-lg print:hidden">
              + Ajouter une section
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex gap-sm flex-wrap print:hidden mt-xl">
            <button onClick={() => handleSave()} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {reunion.statut === 'brouillon' && (
              <button onClick={() => handleSave('publie')} disabled={saving} className="btn-secondary flex-1">
                Publier
              </button>
            )}
            <button onClick={handleDelete} className="text-sm text-brand-brick hover:underline font-semibold px-md">
              Supprimer
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function SectionLecture({ titre, contenu }: { titre: string; contenu: string }) {
  if (!contenu) return null
  return (
    <section className="mb-lg">
      <p className="eyebrow mb-sm">{titre}</p>
      <p className="text-sm text-brand-ink/80 whitespace-pre-wrap">{contenu}</p>
    </section>
  )
}
