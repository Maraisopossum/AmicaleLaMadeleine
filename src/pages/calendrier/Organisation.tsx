import { useState, useEffect, useMemo } from 'react'
import {
  supabase,
  Evenement as EvenementType,
  EvenementOrganisation,
  Stand,
  Deadline,
  Affectation,
  Membre,
} from '../../lib/supabase'

type MembreOption = Pick<Membre, 'id' | 'prenom' | 'nom'>

type Props = {
  evenement: EvenementType
  isAdmin: boolean
  membreId: string | null
}

type SousOnglet = 'stands' | 'deadlines' | 'planning'

export default function Organisation({ evenement, isAdmin, membreId }: Props) {
  const [loading, setLoading] = useState(true)
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('stands')
  const [organisation, setOrganisation] = useState<EvenementOrganisation | null>(null)
  const [stands, setStands] = useState<Stand[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [membresOptions, setMembresOptions] = useState<MembreOption[]>([])

  useEffect(() => {
    fetchAll()
  }, [evenement.id])

  const fetchAll = async () => {
    const [{ data: org }, { data: standsData }, { data: deadlinesData }, { data: membresData }] = await Promise.all([
      supabase.from('evenement_organisation').select('*').eq('evenement_id', evenement.id).maybeSingle(),
      supabase.from('stands').select('*').eq('evenement_id', evenement.id).order('created_at'),
      supabase.from('deadlines').select('*').eq('evenement_id', evenement.id).order('date_echeance'),
      supabase.from('membres').select('id, prenom, nom').order('nom'),
    ])
    setOrganisation(org || null)
    setStands(standsData || [])
    setDeadlines(deadlinesData || [])
    setMembresOptions(membresData || [])

    const standIds = (standsData || []).map((s) => s.id)
    if (standIds.length) {
      const { data: affectationsData } = await supabase
        .from('affectations')
        .select('*')
        .in('stand_id', standIds)
      setAffectations(affectationsData || [])
    } else {
      setAffectations([])
    }
    setLoading(false)
  }

  const peutGererStand = (stand: Stand) => isAdmin || (!!membreId && stand.responsable_id === membreId)

  const joursRestants = useMemo(() => {
    const aujourdHui = new Date()
    aujourdHui.setHours(0, 0, 0, 0)
    const debut = new Date(evenement.date_debut)
    debut.setHours(0, 0, 0, 0)
    return Math.round((debut.getTime() - aujourdHui.getTime()) / (1000 * 60 * 60 * 24))
  }, [evenement.date_debut])

  const creneaux = useMemo(() => buildCreneaux(organisation), [organisation])

  const creneauxNonCouverts = useMemo(() => {
    const total = stands.length * creneaux.length
    const couverts = new Set(affectations.map((a) => `${a.stand_id}|${a.heure_debut}`)).size
    return Math.max(0, total - couverts)
  }, [stands, creneaux, affectations])

  const deadlinesProches = useMemo(() => {
    const dans7Jours = new Date()
    dans7Jours.setDate(dans7Jours.getDate() + 7)
    return deadlines.filter((d) => !d.fait && new Date(d.date_echeance) <= dans7Jours).length
  }, [deadlines])

  if (loading) {
    return <p className="eyebrow">Chargement de l'organisation…</p>
  }

  return (
    <section className="signature-card">
      <p className="eyebrow mb-md">Organisation</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-lg">
        <Metrique label="Jours restants" valeur={joursRestants >= 0 ? String(joursRestants) : '—'} />
        <Metrique label="Stands" valeur={String(stands.length)} />
        <Metrique label="Créneaux non couverts" valeur={String(creneauxNonCouverts)} />
        <Metrique label="Deadlines proches" valeur={String(deadlinesProches)} />
      </div>

      <div className="flex gap-sm mb-lg border-b border-brand-hairline">
        {([
          { id: 'stands', label: 'Stands' },
          { id: 'deadlines', label: 'Deadlines' },
          { id: 'planning', label: 'Planning horaire' },
        ] as { id: SousOnglet; label: string }[]).map((onglet) => (
          <button
            key={onglet.id}
            onClick={() => setSousOnglet(onglet.id)}
            className={`px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border-b-2 -mb-px ${
              sousOnglet === onglet.id ? 'border-brand-petrol text-brand-petrol' : 'border-transparent text-brand-ink/50'
            }`}
          >
            {onglet.label}
          </button>
        ))}
      </div>

      {sousOnglet === 'stands' && (
        <StandsPanel
          evenementId={evenement.id}
          stands={stands}
          membresOptions={membresOptions}
          isAdmin={isAdmin}
          peutGererStand={peutGererStand}
          onSaved={fetchAll}
        />
      )}

      {sousOnglet === 'deadlines' && (
        <DeadlinesPanel
          evenementId={evenement.id}
          stands={stands}
          deadlines={deadlines}
          isAdmin={isAdmin}
          peutGererStand={peutGererStand}
          onSaved={fetchAll}
        />
      )}

      {sousOnglet === 'planning' && (
        <PlanningPanel
          evenementId={evenement.id}
          organisation={organisation}
          stands={stands}
          affectations={affectations}
          membresOptions={membresOptions}
          isAdmin={isAdmin}
          peutGererStand={peutGererStand}
          onSaved={fetchAll}
        />
      )}
    </section>
  )
}

function Metrique({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="border border-brand-hairline p-md text-center">
      <p className="font-display font-bold text-2xl text-brand-petrol">{valeur}</p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-brand-ink/50">{label}</p>
    </div>
  )
}

// --- Stands ---------------------------------------------------------------

function StandsPanel({
  evenementId,
  stands,
  membresOptions,
  isAdmin,
  peutGererStand,
  onSaved,
}: {
  evenementId: string
  stands: Stand[]
  membresOptions: MembreOption[]
  isAdmin: boolean
  peutGererStand: (stand: Stand) => boolean
  onSaved: () => void
}) {
  const [nouveauTitre, setNouveauTitre] = useState('')
  const [creating, setCreating] = useState(false)

  const creerStand = async () => {
    if (!nouveauTitre.trim()) return
    setCreating(true)
    await supabase.from('stands').insert({ evenement_id: evenementId, titre: nouveauTitre.trim(), icone: '📍' })
    setNouveauTitre('')
    setCreating(false)
    onSaved()
  }

  const supprimerStand = async (stand: Stand) => {
    if (!window.confirm(`Supprimer le stand "${stand.titre}" ? Ses deadlines et affectations seront aussi supprimées.`)) return
    await supabase.from('stands').delete().eq('id', stand.id)
    onSaved()
  }

  return (
    <div className="space-y-md">
      {stands.map((stand) => (
        <StandCard
          key={stand.id}
          stand={stand}
          membresOptions={membresOptions}
          peutGerer={peutGererStand(stand)}
          peutSupprimer={isAdmin}
          onSupprimer={() => supprimerStand(stand)}
          onSaved={onSaved}
        />
      ))}
      {!stands.length && <p className="text-sm text-brand-ink/50">Aucun stand pour le moment.</p>}

      {isAdmin && (
        <div className="flex gap-sm pt-md border-t border-brand-hairline">
          <input
            value={nouveauTitre}
            onChange={(e) => setNouveauTitre(e.target.value)}
            placeholder="Nom du nouveau stand (ex: Visite des camions)"
            className="flex-1 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          />
          <button onClick={creerStand} disabled={creating} className="btn-primary text-xs">
            + Ajouter
          </button>
        </div>
      )}
    </div>
  )
}

function StandCard({
  stand,
  membresOptions,
  peutGerer,
  peutSupprimer,
  onSupprimer,
  onSaved,
}: {
  stand: Stand
  membresOptions: MembreOption[]
  peutGerer: boolean
  peutSupprimer: boolean
  onSupprimer: () => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [titre, setTitre] = useState(stand.titre)
  const [icone, setIcone] = useState(stand.icone)
  const [description, setDescription] = useState(stand.description || '')
  const [responsableId, setResponsableId] = useState(stand.responsable_id || '')
  const [saving, setSaving] = useState(false)

  const responsable = membresOptions.find((m) => m.id === stand.responsable_id)

  const save = async () => {
    setSaving(true)
    await supabase
      .from('stands')
      .update({ titre: titre.trim(), icone: icone.trim() || '📍', description: description.trim() || null, responsable_id: responsableId || null })
      .eq('id', stand.id)
    setSaving(false)
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <div className="border border-brand-hairline p-md space-y-sm">
        <div className="flex gap-sm">
          <input
            value={icone}
            onChange={(e) => setIcone(e.target.value)}
            maxLength={2}
            placeholder="🚒"
            className="w-16 text-center border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          />
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            className="flex-1 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Description (visible sur la page publique)"
          className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
        />
        <select
          value={responsableId}
          onChange={(e) => setResponsableId(e.target.value)}
          className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
        >
          <option value="">— Aucun gestionnaire —</option>
          {membresOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
          ))}
        </select>
        <div className="flex gap-sm">
          <button onClick={save} disabled={saving} className="btn-primary text-xs flex-1">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="btn-secondary text-xs flex-1">Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-brand-hairline p-md flex items-start justify-between gap-md">
      <div>
        <p className="font-display font-bold uppercase">{stand.icone} {stand.titre}</p>
        {stand.description && <p className="text-sm text-brand-ink/60">{stand.description}</p>}
        <p className="text-xs text-brand-ink/50 mt-xs">
          Gestionnaire : {responsable ? `${responsable.prenom} ${responsable.nom}` : 'aucun'}
        </p>
      </div>
      {peutGerer && (
        <div className="flex gap-md whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-xs text-brand-petrol hover:underline font-semibold">Modifier</button>
          {peutSupprimer && (
            <button onClick={onSupprimer} className="text-xs text-brand-brick hover:underline font-semibold">Supprimer</button>
          )}
        </div>
      )}
    </div>
  )
}

// --- Deadlines --------------------------------------------------------------

function DeadlinesPanel({
  evenementId,
  stands,
  deadlines,
  isAdmin,
  peutGererStand,
  onSaved,
}: {
  evenementId: string
  stands: Stand[]
  deadlines: Deadline[]
  isAdmin: boolean
  peutGererStand: (stand: Stand) => boolean
  onSaved: () => void
}) {
  const [libelle, setLibelle] = useState('')
  const [dateEcheance, setDateEcheance] = useState('')
  const [standId, setStandId] = useState('')
  const [creating, setCreating] = useState(false)

  const standsGerables = stands.filter(peutGererStand)
  const peutCreerGlobale = isAdmin

  const creer = async () => {
    if (!libelle.trim() || !dateEcheance) return
    setCreating(true)
    await supabase.from('deadlines').insert({
      evenement_id: evenementId,
      stand_id: standId || null,
      libelle: libelle.trim(),
      date_echeance: dateEcheance,
    })
    setLibelle('')
    setDateEcheance('')
    setStandId('')
    setCreating(false)
    onSaved()
  }

  const toggleFait = async (deadline: Deadline) => {
    await supabase.from('deadlines').update({ fait: !deadline.fait }).eq('id', deadline.id)
    onSaved()
  }

  const supprimer = async (deadline: Deadline) => {
    await supabase.from('deadlines').delete().eq('id', deadline.id)
    onSaved()
  }

  const peutEcrire = (deadline: Deadline) => {
    if (isAdmin) return true
    if (!deadline.stand_id) return false
    const stand = stands.find((s) => s.id === deadline.stand_id)
    return !!stand && peutGererStand(stand)
  }

  return (
    <div className="space-y-md">
      {deadlines.map((deadline) => {
        const stand = stands.find((s) => s.id === deadline.stand_id)
        return (
          <div key={deadline.id} className="flex items-center gap-md border border-brand-hairline p-md">
            <input type="checkbox" checked={deadline.fait} disabled={!peutEcrire(deadline)} onChange={() => toggleFait(deadline)} />
            <div className="flex-1">
              <p className={deadline.fait ? 'line-through text-brand-ink/40' : ''}>{deadline.libelle}</p>
              <p className="text-xs text-brand-ink/50">
                {formatDateCourte(deadline.date_echeance)} {stand ? `— ${stand.titre}` : '— Global'}
              </p>
            </div>
            {peutEcrire(deadline) && (
              <button onClick={() => supprimer(deadline)} className="text-brand-brick text-sm">✕</button>
            )}
          </div>
        )
      })}
      {!deadlines.length && <p className="text-sm text-brand-ink/50">Aucune deadline pour le moment.</p>}

      {(peutCreerGlobale || standsGerables.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_160px_auto] gap-sm pt-md border-t border-brand-hairline items-start">
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Tâche à faire"
            className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          />
          <input
            type="date"
            value={dateEcheance}
            onChange={(e) => setDateEcheance(e.target.value)}
            className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          />
          <select
            value={standId}
            onChange={(e) => setStandId(e.target.value)}
            className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm focus:outline-none focus:border-brand-petrol"
          >
            {peutCreerGlobale && <option value="">Globale</option>}
            {standsGerables.map((s) => <option key={s.id} value={s.id}>{s.titre}</option>)}
          </select>
          <button onClick={creer} disabled={creating} className="btn-primary text-xs">+ Ajouter</button>
        </div>
      )}
    </div>
  )
}

// --- Planning horaire --------------------------------------------------------

function PlanningPanel({
  evenementId,
  organisation,
  stands,
  affectations,
  membresOptions,
  isAdmin,
  peutGererStand,
  onSaved,
}: {
  evenementId: string
  organisation: EvenementOrganisation | null
  stands: Stand[]
  affectations: Affectation[]
  membresOptions: MembreOption[]
  isAdmin: boolean
  peutGererStand: (stand: Stand) => boolean
  onSaved: () => void
}) {
  const [heureDebut, setHeureDebut] = useState(organisation?.heure_debut?.slice(0, 5) || '09:00')
  const [heureFin, setHeureFin] = useState(organisation?.heure_fin?.slice(0, 5) || '18:00')
  const [duree, setDuree] = useState(organisation?.duree_creneau_minutes || 60)
  const [savingConfig, setSavingConfig] = useState(false)
  const [celluleOuverte, setCelluleOuverte] = useState<{ standId: string; debut: string; fin: string } | null>(null)

  const creneaux = useMemo(() => buildCreneaux(organisation), [organisation])

  const sauverConfig = async () => {
    setSavingConfig(true)
    await supabase
      .from('evenement_organisation')
      .upsert({ evenement_id: evenementId, heure_debut: heureDebut, heure_fin: heureFin, duree_creneau_minutes: duree })
    setSavingConfig(false)
    onSaved()
  }

  const supprimerPlanning = async () => {
    if (!window.confirm("Supprimer le planning horaire ? Toutes les affectations de créneaux seront perdues.")) return
    const standIds = stands.map((s) => s.id)
    if (standIds.length) {
      await supabase.from('affectations').delete().in('stand_id', standIds)
    }
    await supabase.from('evenement_organisation').delete().eq('evenement_id', evenementId)
    onSaved()
  }

  if (!organisation) {
    if (!isAdmin) {
      return <p className="text-sm text-brand-ink/50">Le planning n'a pas encore été configuré par le bureau.</p>
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md max-w-md">
        <div>
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Début</label>
          <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Fin</label>
          <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Créneau (min)</label>
          <input type="number" min={15} step={15} value={duree} onChange={(e) => setDuree(Number(e.target.value))} className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        </div>
        <button onClick={sauverConfig} disabled={savingConfig} className="btn-primary text-xs col-span-3">
          Configurer le planning
        </button>
      </div>
    )
  }

  if (!stands.length) {
    return <p className="text-sm text-brand-ink/50">Ajoutez d'abord des stands pour pouvoir planifier des créneaux.</p>
  }

  const affectationsPour = (standId: string, debut: string) =>
    affectations.filter((a) => a.stand_id === standId && a.heure_debut.slice(0, 5) === debut)

  const supprimerLigne = async (stand: Stand) => {
    if (!window.confirm(`Vider le planning du stand "${stand.titre}" ? Toutes les affectations de cette ligne seront perdues.`)) return
    await supabase.from('affectations').delete().eq('stand_id', stand.id)
    onSaved()
  }

  return (
    <div className="space-y-md">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #planning-impression, #planning-impression * { visibility: visible; }
          #planning-impression { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-md flex-wrap print:hidden">
        <p className="text-xs text-brand-ink/50">
          Cliquez sur une cellule pour affecter du personnel · 1 cellule = {formatDuree(organisation.duree_creneau_minutes)}
        </p>

        <div className="flex items-end gap-sm">
          {isAdmin ? (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.1em] text-brand-ink/50 mb-xxs">Début</label>
                <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="w-24 border border-brand-hairline bg-brand-parchment px-sm py-xxs text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.1em] text-brand-ink/50 mb-xxs">Fin</label>
                <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className="w-24 border border-brand-hairline bg-brand-parchment px-sm py-xxs text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.1em] text-brand-ink/50 mb-xxs">Créneau (min)</label>
                <input type="number" min={15} step={15} value={duree} onChange={(e) => setDuree(Number(e.target.value))} className="w-20 border border-brand-hairline bg-brand-parchment px-sm py-xxs text-sm" />
              </div>
              <button onClick={sauverConfig} disabled={savingConfig} title="Appliquer" className="btn-secondary text-xs px-sm py-xxs">
                ↻
              </button>
            </>
          ) : (
            <p className="text-xs text-brand-ink/50">{heureDebut} – {heureFin}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-sm print:hidden">
        <button onClick={() => window.print()} className="btn-secondary text-xs">
          Imprimer (A4 paysage)
        </button>
        {isAdmin && (
          <button onClick={supprimerPlanning} className="text-xs text-brand-brick hover:underline font-semibold">
            Supprimer le planning
          </button>
        )}
      </div>

      <div id="planning-impression" className="border border-brand-hairline rounded-xs overflow-x-auto">
        <table className="w-full table-fixed text-[11px] print:text-sm border-collapse">
          <thead>
            <tr>
              <th className="w-[140px] border-b border-r border-brand-hairline p-xs print:p-sm bg-brand-parchment text-brand-ink/60 font-medium text-left">Stand</th>
              {creneaux.map((c) => (
                <th key={c.debut} className="border-b border-r border-brand-hairline p-xxs print:p-sm bg-brand-parchment text-brand-ink/60 font-medium whitespace-nowrap text-center">
                  {formatPlageHeure(c.debut, c.fin)}
                </th>
              ))}
              <th className="w-6 border-b border-brand-hairline p-xxs print:hidden bg-brand-parchment"></th>
            </tr>
          </thead>
          <tbody>
            {stands.map((stand) => (
              <tr key={stand.id} className="bg-brand-paper">
                <td className="border-b border-r border-brand-hairline p-xs print:p-sm font-medium truncate">
                  {stand.icone} {stand.titre}
                </td>
                {creneaux.map((c) => {
                  const occupants = affectationsPour(stand.id, c.debut)
                  const gerable = peutGererStand(stand)
                  return (
                    <td
                      key={c.debut}
                      onClick={() => gerable && setCelluleOuverte({ standId: stand.id, debut: c.debut, fin: c.fin })}
                      className={`border-b border-r border-brand-hairline p-xxs print:p-sm align-middle text-center ${
                        gerable ? 'cursor-pointer hover:bg-brand-sky/10' : ''
                      }`}
                    >
                      {occupants.length ? (
                        <div className="flex flex-wrap gap-xxs justify-center">
                          {occupants.map((a) => {
                            const m = membresOptions.find((mb) => mb.id === a.membre_id)
                            return (
                              <span key={a.id} className="bg-brand-sky/15 text-brand-petrol text-[9px] px-xs py-[1px] rounded-pill truncate max-w-full">
                                {m ? `${m.prenom} ${m.nom}` : a.nom_libre}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-brand-ink/20 print:hidden">{gerable ? '+' : ''}</span>
                      )}
                    </td>
                  )
                })}
                <td className="border-b border-brand-hairline p-xxs print:hidden text-center">
                  {peutGererStand(stand) && (
                    <button onClick={() => supprimerLigne(stand)} className="text-brand-brick text-xs" title="Vider cette ligne">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {celluleOuverte && (
        <CelluleEditor
          standId={celluleOuverte.standId}
          standTitre={(() => {
            const s = stands.find((s) => s.id === celluleOuverte.standId)
            return s ? `${s.icone} ${s.titre}` : ''
          })()}
          debut={celluleOuverte.debut}
          fin={celluleOuverte.fin}
          occupants={affectationsPour(celluleOuverte.standId, celluleOuverte.debut)}
          membresOptions={membresOptions}
          onClose={() => setCelluleOuverte(null)}
          onSaved={() => { onSaved(); setCelluleOuverte(null) }}
        />
      )}
    </div>
  )
}

function CelluleEditor({
  standId,
  standTitre,
  debut,
  fin,
  occupants,
  membresOptions,
  onClose,
  onSaved,
}: {
  standId: string
  standTitre: string
  debut: string
  fin: string
  occupants: Affectation[]
  membresOptions: MembreOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [membreId, setMembreId] = useState('')
  const [nomLibre, setNomLibre] = useState('')
  const [saving, setSaving] = useState(false)

  const ajouter = async () => {
    if (!membreId && !nomLibre.trim()) return
    setSaving(true)
    await supabase.from('affectations').insert({
      stand_id: standId,
      heure_debut: debut,
      heure_fin: fin,
      membre_id: membreId || null,
      nom_libre: membreId ? null : nomLibre.trim(),
    })
    setMembreId('')
    setNomLibre('')
    setSaving(false)
    onSaved()
  }

  const retirer = async (affectation: Affectation) => {
    await supabase.from('affectations').delete().eq('id', affectation.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={onClose}>
      <div className="signature-card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold uppercase mb-sm">{standTitre} — {debut}-{fin}</h3>

        <div className="space-y-xs mb-md">
          {occupants.map((a) => {
            const m = membresOptions.find((mb) => mb.id === a.membre_id)
            return (
              <div key={a.id} className="flex items-center justify-between border border-brand-hairline px-sm py-xs text-sm">
                <span>{m ? `${m.prenom} ${m.nom}` : a.nom_libre}</span>
                <button onClick={() => retirer(a)} className="text-brand-brick text-xs">Retirer</button>
              </div>
            )
          })}
          {!occupants.length && <p className="text-sm text-brand-ink/50">Personne affecté pour l'instant.</p>}
        </div>

        <div className="space-y-sm mb-md">
          <select
            value={membreId}
            onChange={(e) => { setMembreId(e.target.value); setNomLibre('') }}
            className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm"
          >
            <option value="">— Choisir un membre —</option>
            {membresOptions.map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
          </select>
          <p className="text-center text-xs text-brand-ink/40">ou</p>
          <input
            value={nomLibre}
            onChange={(e) => { setNomLibre(e.target.value); setMembreId('') }}
            placeholder="Nom d'un bénévole externe"
            className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm"
          />
        </div>

        <div className="flex gap-sm">
          <button onClick={ajouter} disabled={saving} className="btn-primary text-xs flex-1">Affecter</button>
          <button onClick={onClose} className="btn-secondary text-xs flex-1">Fermer</button>
        </div>
      </div>
    </div>
  )
}

// --- Utils -------------------------------------------------------------------

function buildCreneaux(organisation: EvenementOrganisation | null): { debut: string; fin: string }[] {
  if (!organisation) return []
  const [hDebut, mDebut] = organisation.heure_debut.slice(0, 5).split(':').map(Number)
  const [hFin, mFin] = organisation.heure_fin.slice(0, 5).split(':').map(Number)
  const debutMinutes = hDebut * 60 + mDebut
  const finMinutes = hFin * 60 + mFin
  const pas = organisation.duree_creneau_minutes

  const creneaux: { debut: string; fin: string }[] = []
  for (let t = debutMinutes; t + pas <= finMinutes; t += pas) {
    creneaux.push({ debut: minutesToHHMM(t), fin: minutesToHHMM(t + pas) })
  }
  return creneaux
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatHeureCourte(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function formatPlageHeure(debut: string, fin: string): string {
  return `${formatHeureCourte(debut)}–${formatHeureCourte(fin)}`
}

function formatDuree(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`
  if (minutes < 60) return `${minutes}min`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

function formatDateCourte(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
