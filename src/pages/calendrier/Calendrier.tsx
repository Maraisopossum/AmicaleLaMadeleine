import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase, Evenement } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TYPES_EVENEMENT = ['ag', 'reunion', 'activite', 'formation']

type NouvelEvenement = {
  titre: string
  type: string
  date_debut: string
  date_fin: string
  lieu: string
  description: string
  lien_google: string
  page_dediee: boolean
}

const EVENEMENT_VIDE: NouvelEvenement = {
  titre: '',
  type: 'reunion',
  date_debut: '',
  date_fin: '',
  lieu: '',
  description: '',
  lien_google: '',
  page_dediee: false,
}

export default function Calendrier() {
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [moisAffiche, setMoisAffiche] = useState(() => {
    const focus = searchParams.get('focus')
    const d = focus ? new Date(focus) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NouvelEvenement>(EVENEMENT_VIDE)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const openCreateForm = () => {
    setEditingId(null)
    setForm(EVENEMENT_VIDE)
    setFormError('')
    setShowAddForm(true)
  }

  const openEditForm = (event: Evenement) => {
    setEditingId(event.id)
    setForm({
      titre: event.titre,
      type: event.type,
      date_debut: toDatetimeLocalValue(event.date_debut),
      date_fin: event.date_fin ? toDatetimeLocalValue(event.date_fin) : '',
      lieu: event.lieu || '',
      description: event.description || '',
      lien_google: event.lien_google || '',
      page_dediee: event.page_dediee,
    })
    setFormError('')
    setShowAddForm(true)
  }

  const handleDeleteEvenement = async (event: Evenement) => {
    if (!window.confirm(`Supprimer "${event.titre}" ? Cette action est définitive.`)) return
    await supabase.from('evenements').delete().eq('id', event.id)
    fetchEvenements()
  }

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user) {
      fetchEvenements()
    }
  }, [user])

  const fetchEvenements = async () => {
    const { data } = await supabase
      .from('evenements')
      .select('*')
      .order('date_debut', { ascending: true })

    setEvenements(data || [])
    setLoading(false)
  }

  const handleAddEvenement = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')

    // form.date_debut/date_fin viennent d'un <input type="datetime-local">,
    // sans fuseau horaire : new Date(...) les interprète en heure locale du
    // navigateur, .toISOString() les convertit en UTC correctement avant
    // envoi. Envoyer la chaîne brute fait stocker l'heure locale comme si
    // c'était de l'UTC (ex: 9h locale stockée comme 9h UTC = 11h locale).
    const payload = {
      titre: form.titre.trim(),
      type: form.type,
      date_debut: new Date(form.date_debut).toISOString(),
      date_fin: form.date_fin ? new Date(form.date_fin).toISOString() : null,
      lieu: form.lieu.trim() || null,
      description: form.description.trim() || null,
      lien_google: form.lien_google.trim() || null,
      page_dediee: form.page_dediee,
    }

    const { error } = editingId
      ? await supabase.from('evenements').update(payload).eq('id', editingId)
      : await supabase.from('evenements').insert(payload)

    setSaving(false)

    if (error) {
      setFormError(error.message)
    } else {
      setShowAddForm(false)
      setEditingId(null)
      setForm(EVENEMENT_VIDE)
      fetchEvenements()
    }
  }

  const evenementsDuMois = useMemo(() => {
    return evenements.filter((event) => {
      const debut = new Date(event.date_debut)
      return debut.getFullYear() === moisAffiche.getFullYear() && debut.getMonth() === moisAffiche.getMonth()
    })
  }, [evenements, moisAffiche])

  const semaines = useMemo(() => buildMonthGrid(moisAffiche, evenementsDuMois), [moisAffiche, evenementsDuMois])

  const generateICS = (evenement: Evenement) => {
    const startDate = new Date(evenement.date_debut)
    const endDate = evenement.date_fin ? new Date(evenement.date_fin) : startDate

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Amicale des Sapeurs-Pompiers de La Madeleine//EN
BEGIN:VEVENT
UID:${evenement.id}@amicale-lamadeleine.fr
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${evenement.titre}
DESCRIPTION:${evenement.description || ''}
LOCATION:${evenement.lieu || ''}
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${evenement.titre.replace(/\s+/g, '_')}.ics`
    a.click()
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

  const aujourdHui = new Date()
  const estMoisCourant =
    moisAffiche.getFullYear() === aujourdHui.getFullYear() && moisAffiche.getMonth() === aujourdHui.getMonth()

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode="§05"
        eyebrowLabel="Vie associative"
        title="Calendrier des événements"
        subtitle="Assemblées générales, réunions, activités"
      />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        {isAdmin && (
          <button className="btn-primary mb-xl" onClick={openCreateForm}>
            + Ajouter un événement
          </button>
        )}

        {/* Grille mensuelle */}
        <div className="signature-card mb-xl">
          <div className="flex items-center justify-between mb-lg">
            <button
              onClick={() => setMoisAffiche(addMonths(moisAffiche, -1))}
              className="btn-secondary text-xs"
              aria-label="Mois précédent"
            >
              ← Précédent
            </button>
            <div className="text-center">
              <h2 className="font-display font-bold uppercase text-xl">
                {moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </h2>
              {!estMoisCourant && (
                <button
                  onClick={() => setMoisAffiche(new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1))}
                  className="text-xs text-brand-petrol hover:underline font-semibold"
                >
                  Revenir à aujourd'hui
                </button>
              )}
            </div>
            <button
              onClick={() => setMoisAffiche(addMonths(moisAffiche, 1))}
              className="btn-secondary text-xs"
              aria-label="Mois suivant"
            >
              Suivant →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-brand-hairline border border-brand-hairline">
            {JOURS.map((jour) => (
              <div key={jour} className="bg-brand-ink text-brand-parchment text-center py-xs text-xs uppercase tracking-[0.1em] font-semibold">
                {jour}
              </div>
            ))}
            {semaines.flat().map((jour, i) => (
              <div
                key={i}
                className={`bg-brand-paper min-h-[64px] p-xs ${jour && isToday(jour.date) ? 'ring-2 ring-inset ring-brand-petrol' : ''}`}
              >
                {jour && (
                  <>
                    <span className="text-xs text-brand-ink/50">{jour.date.getDate()}</span>
                    <div className="flex flex-col gap-px mt-xxs">
                      {jour.events.map((event) => (
                        <span
                          key={event.id}
                          title={event.titre}
                          className={`text-[10px] leading-tight truncate px-xxs border-l-2 ${getTypeClass(event.type)}`}
                        >
                          {event.titre}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Détails du mois affiché */}
        <p className="eyebrow mb-md">
          {evenementsDuMois.length} événement{evenementsDuMois.length === 1 ? '' : 's'} ce mois-ci
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {evenementsDuMois.map((event) => (
            <div key={event.id} className="signature-card">
              <div className="mb-md">
                <span className={`tag ${getTypeClass(event.type)}`}>
                  {getTypeLabel(event.type)}
                </span>
              </div>

              <h3 className="font-display font-bold uppercase text-lg mb-sm">{event.titre}</h3>

              {event.description && (
                <p className="text-sm text-brand-ink/70 mb-md">{event.description}</p>
              )}

              <p className="text-sm text-brand-ink/50 mb-md">
                {formatDate(event.date_debut)}
                {event.date_fin && event.date_fin !== event.date_debut && (
                  <> &rarr; {formatDate(event.date_fin)}</>
                )}
              </p>

              {event.lieu && (
                <p className="text-sm text-brand-ink/50 mb-md">
                  📍 {event.lieu}
                </p>
              )}

              <div className="flex gap-sm">
                <button
                  onClick={() => generateICS(event)}
                  className="btn-secondary text-xs flex-1"
                >
                  Exporter ICS
                </button>
                {event.lien_google && (
                  <a
                    href={event.lien_google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs flex-1 text-center"
                  >
                    Google Calendar
                  </a>
                )}
              </div>

              {event.page_dediee && (
                <Link
                  to={`/calendrier/${event.id}`}
                  className="block text-center text-xs text-brand-petrol hover:underline font-semibold mt-sm"
                >
                  {isAdmin ? 'Gérer la page de l\'événement →' : 'Voir la page de l\'événement →'}
                </Link>
              )}

              {isAdmin && (
                <div className="flex gap-md mt-sm">
                  <button
                    onClick={() => openEditForm(event)}
                    className="text-xs text-brand-petrol hover:underline font-semibold"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDeleteEvenement(event)}
                    className="text-xs text-brand-brick hover:underline font-semibold"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!evenementsDuMois.length && (
          <div className="text-center py-xxl text-brand-ink/50">
            Aucun événement ce mois-ci.
          </div>
        )}
      </main>

      {showAddForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={() => setShowAddForm(false)}>
          <div className="signature-card max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">
              {editingId ? "Modifier l'événement" : 'Ajouter un événement'}
            </h2>
            <form onSubmit={handleAddEvenement}>
              {formError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{formError}</div>
              )}

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre</label>
                <input
                  required
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <div className="grid grid-cols-2 gap-md mb-md">
                <div>
                  <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  >
                    {TYPES_EVENEMENT.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Lieu</label>
                  <input
                    value={form.lieu}
                    onChange={(e) => setForm({ ...form, lieu: e.target.value })}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md mb-md">
                <div>
                  <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Début</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.date_debut}
                    onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Fin (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={form.date_fin}
                    onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                    className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  />
                </div>
              </div>

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  rows={2}
                />
              </div>

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Lien Google Calendar (optionnel)</label>
                <input
                  value={form.lien_google}
                  onChange={(e) => setForm({ ...form, lien_google: e.target.value })}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <label className="flex items-center gap-sm mb-lg text-sm">
                <input
                  type="checkbox"
                  checked={form.page_dediee}
                  onChange={(e) => setForm({ ...form, page_dediee: e.target.checked })}
                />
                Créer une page dédiée (programme, infos pratiques — pour un gros événement type JPO)
              </label>

              <div className="flex gap-sm">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowAddForm(false)}>
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

// Convertit un timestamp ISO (UTC) en valeur locale "YYYY-MM-DDTHH:mm" pour
// pré-remplir un <input type="datetime-local"> (qui travaille en heure locale).
function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type JourGrille = { date: Date; events: Evenement[] } | null

function buildMonthGrid(mois: Date, evenementsDuMois: Evenement[]): JourGrille[][] {
  const annee = mois.getFullYear()
  const moisIndex = mois.getMonth()
  const premierJour = new Date(annee, moisIndex, 1)
  const nbJours = new Date(annee, moisIndex + 1, 0).getDate()

  // Lundi = 0 ... Dimanche = 6
  const decalage = (premierJour.getDay() + 6) % 7

  const jours: JourGrille[] = []
  for (let i = 0; i < decalage; i++) jours.push(null)

  for (let jour = 1; jour <= nbJours; jour++) {
    const date = new Date(annee, moisIndex, jour)
    const events = evenementsDuMois.filter((e) => new Date(e.date_debut).getDate() === jour)
    jours.push({ date, events })
  }

  while (jours.length % 7 !== 0) jours.push(null)

  const semaines: JourGrille[][] = []
  for (let i = 0; i < jours.length; i += 7) {
    semaines.push(jours.slice(i, i + 7))
  }
  return semaines
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
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

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    ag: 'AG',
    reunion: 'Réunion',
    activite: 'Activité',
    formation: 'Formation',
  }
  return labels[type] || type
}

const getTypeClass = (type: string) => {
  const classes: Record<string, string> = {
    ag: 'border-brand-petrol text-brand-petrol',
    reunion: 'border-brand-sky text-brand-petrol',
    activite: 'border-brand-brick text-brand-brick',
    formation: 'border-brand-hairline text-brand-ink/70',
  }
  return classes[type] || 'border-brand-hairline text-brand-ink/50'
}
