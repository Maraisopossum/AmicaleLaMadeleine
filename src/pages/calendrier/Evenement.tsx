import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, Evenement as EvenementType, EvenementSection, ProgrammeItem, Stand } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import Organisation from './Organisation'

export default function Evenement() {
  const { id } = useParams<{ id: string }>()
  const { user, membre, isAdmin, loading: authLoading } = useAuth()

  const [evenement, setEvenement] = useState<EvenementType | null>(null)
  const [sections, setSections] = useState<EvenementSection[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [loading, setLoading] = useState(true)
  const [ongletPrincipal, setOngletPrincipal] = useState<'infos' | 'organisation'>('infos')

  useEffect(() => {
    if (user && id) {
      fetchData()
    }
  }, [user, id])

  const fetchData = async () => {
    const [{ data: ev }, { data: secs }, { data: standsData }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', id).maybeSingle(),
      supabase.from('evenement_sections').select('*').eq('evenement_id', id).order('ordre'),
      supabase.from('stands').select('*').eq('evenement_id', id).order('created_at'),
    ])
    setEvenement(ev || null)
    setSections(secs || [])
    setStands(standsData || [])
    setLoading(false)
  }

  const programme = sections.find((s) => s.type === 'programme')
  const infos = sections.find((s) => s.type === 'infos_pratiques')

  const activerSection = async (type: 'programme' | 'infos_pratiques') => {
    await supabase.from('evenement_sections').upsert(
      { evenement_id: id, type, contenu: type === 'programme' ? { items: [] } : { texte: '' } },
      { onConflict: 'evenement_id,type' }
    )
    fetchData()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!evenement || !evenement.page_dediee) {
    return (
      <div className="min-h-screen bg-brand-parchment font-body text-brand-ink flex items-center justify-center">
        <div className="text-center">
          <p className="eyebrow mb-md">Page introuvable</p>
          <Link to="/calendrier" className="text-brand-petrol hover:underline font-semibold">← Retour au calendrier</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode="§05"
        eyebrowLabel="Vie associative"
        title={evenement.titre}
        subtitle={formatDate(evenement.date_debut) + (evenement.lieu ? ` — ${evenement.lieu}` : '')}
        rightSlot={
          <Link
            to="/calendrier"
            className="border border-brand-sky/60 text-brand-parchment uppercase text-xs tracking-[0.15em] font-semibold px-md py-xs hover:bg-brand-sky hover:text-brand-ink transition-colors"
          >
            ← Calendrier
          </Link>
        }
      />
      <div className="chevron-band" />

      <main className={`mx-auto p-xl space-y-xl ${ongletPrincipal === 'organisation' ? 'max-w-7xl' : 'max-w-3xl'}`}>
        <div className="flex gap-sm border-b border-brand-hairline">
          {(['infos', 'organisation'] as const).map((onglet) => (
            <button
              key={onglet}
              onClick={() => setOngletPrincipal(onglet)}
              className={`px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border-b-2 -mb-px ${
                ongletPrincipal === onglet ? 'border-brand-petrol text-brand-petrol' : 'border-transparent text-brand-ink/50'
              }`}
            >
              {onglet === 'infos' ? 'Infos' : 'Organisation'}
            </button>
          ))}
        </div>

        {ongletPrincipal === 'infos' && (
          <>
            {/* Stands à découvrir */}
            {stands.length > 0 && (
              <section className="signature-card">
                <p className="eyebrow mb-sm">Stands à découvrir</p>
                <ul className="space-y-sm">
                  {stands.map((stand) => (
                    <li key={stand.id} className="border-b border-brand-hairline pb-sm last:border-0">
                      <p className="font-medium">{stand.icone} {stand.titre}</p>
                      {stand.description && <p className="text-sm text-brand-ink/60">{stand.description}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Programme */}
            {programme ? (
              <ProgrammeSection section={programme} isAdmin={isAdmin} onSaved={fetchData} />
            ) : isAdmin ? (
              <button className="btn-secondary" onClick={() => activerSection('programme')}>
                + Activer la section Programme
              </button>
            ) : null}

            {/* Infos pratiques */}
            {infos ? (
              <InfosSection section={infos} isAdmin={isAdmin} onSaved={fetchData} />
            ) : isAdmin ? (
              <button className="btn-secondary" onClick={() => activerSection('infos_pratiques')}>
                + Activer la section Infos pratiques
              </button>
            ) : null}

            {!programme && !infos && !stands.length && !isAdmin && (
              <p className="text-center text-brand-ink/50 py-xxl">Aucune information disponible pour le moment.</p>
            )}
          </>
        )}

        {ongletPrincipal === 'organisation' && (
          <Organisation evenement={evenement} isAdmin={isAdmin} membreId={membre?.id || null} />
        )}
      </main>
    </div>
  )
}

function ProgrammeSection({ section, isAdmin, onSaved }: { section: EvenementSection; isAdmin: boolean; onSaved: () => void }) {
  const [items, setItems] = useState<ProgrammeItem[]>(section.contenu.items || [])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('evenement_sections').update({ contenu: { items } }).eq('id', section.id)
    setSaving(false)
    onSaved()
  }

  return (
    <section className="signature-card">
      <p className="eyebrow mb-sm">Programme</p>
      {!isAdmin ? (
        <ul className="space-y-sm">
          {items.map((item, i) => (
            <li key={i} className="flex gap-md border-b border-brand-hairline pb-sm last:border-0">
              <span className="font-display text-brand-petrol whitespace-nowrap">{item.heure}</span>
              <div>
                <p className="font-medium">{item.titre}</p>
                {item.description && <p className="text-sm text-brand-ink/60">{item.description}</p>}
              </div>
            </li>
          ))}
          {!items.length && <p className="text-brand-ink/50 text-sm">Programme à venir.</p>}
        </ul>
      ) : (
        <>
          <div className="space-y-sm mb-md">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_1fr_auto] gap-sm items-start">
                <input
                  placeholder="Heure"
                  value={item.heure}
                  onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, heure: e.target.value } : it))}
                  className="border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm"
                />
                <input
                  placeholder="Titre"
                  value={item.titre}
                  onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, titre: e.target.value } : it))}
                  className="border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm"
                />
                <input
                  placeholder="Description (optionnel)"
                  value={item.description || ''}
                  onChange={(e) => setItems(items.map((it, j) => j === i ? { ...it, description: e.target.value } : it))}
                  className="border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm"
                />
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-brand-brick text-sm">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-sm">
            <button
              className="btn-secondary text-xs"
              onClick={() => setItems([...items, { heure: '', titre: '', description: '' }])}
            >
              + Ajouter une ligne
            </button>
            <button className="btn-primary text-xs" onClick={save} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function InfosSection({ section, isAdmin, onSaved }: { section: EvenementSection; isAdmin: boolean; onSaved: () => void }) {
  const [texte, setTexte] = useState(section.contenu.texte || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('evenement_sections').update({ contenu: { texte } }).eq('id', section.id)
    setSaving(false)
    onSaved()
  }

  return (
    <section className="signature-card">
      <p className="eyebrow mb-sm">Infos pratiques</p>
      {!isAdmin ? (
        <p className="text-sm whitespace-pre-wrap">{texte || 'Aucune information disponible.'}</p>
      ) : (
        <>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={6}
            className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm mb-md focus:outline-none focus:border-brand-petrol"
            placeholder="Lieu détaillé, à prévoir, contact, accès..."
          />
          <button className="btn-primary text-xs" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      )}
    </section>
  )
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
