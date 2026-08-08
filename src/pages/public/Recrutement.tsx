import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, ReponsesQuizRecrutement } from '../../lib/supabase'

const SDIS_URL = import.meta.env.VITE_SDIS_RECRUTEMENT_URL as string | undefined

type Ecran = 'intro' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'resultat'

type ResultatConfig = {
  eyebrow: string
  titre: string
  texte: string
  statut: 'eligible' | 'a_verifier' | 'pas_encore'
  capture: boolean
}

const ETAPES: Ecran[] = ['q1', 'q2', 'q3', 'q4', 'q5']

export default function Recrutement() {
  const [ecran, setEcran] = useState<Ecran>('intro')
  const [reponses, setReponses] = useState<ReponsesQuizRecrutement>({})
  const [resultat, setResultat] = useState<ResultatConfig | null>(null)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState('')

  const repondre = <K extends keyof ReponsesQuizRecrutement>(cle: K, valeur: NonNullable<ReponsesQuizRecrutement[K]>) => {
    const nouvelles = { ...reponses, [cle]: valeur }
    setReponses(nouvelles)

    const idx = ETAPES.indexOf(ecran as typeof ETAPES[number])
    if (idx < ETAPES.length - 1) {
      setEcran(ETAPES[idx + 1])
      window.scrollTo(0, 0)
      return
    }
    setResultat(calculerResultat(nouvelles))
    setEcran('resultat')
    window.scrollTo(0, 0)
  }

  const retour = (ecranPrecedent: Ecran) => {
    setEcran(ecranPrecedent)
    window.scrollTo(0, 0)
  }

  const recommencer = () => {
    setReponses({})
    setResultat(null)
    setPrenom(''); setNom(''); setTelephone(''); setEmail('')
    setEnvoye(false); setErreur('')
    setEcran('intro')
    window.scrollTo(0, 0)
  }

  const envoyerContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resultat) return
    setErreur('')
    if (!prenom.trim() || !nom.trim()) { setErreur('Prénom et nom sont obligatoires.'); return }
    if (!telephone.trim() && !email.trim()) { setErreur('Laisse au moins un téléphone ou un email.'); return }

    setEnvoi(true)
    const { error } = await supabase.from('candidatures').insert({
      prenom: prenom.trim(),
      nom: nom.trim(),
      telephone: telephone.trim() || null,
      email: email.trim() || null,
      reponses,
      statut_eligibilite: resultat.statut,
    })
    setEnvoi(false)

    if (error) { setErreur(error.message); return }
    setEnvoye(true)
  }

  const etapeIdx = ETAPES.indexOf(ecran as typeof ETAPES[number])
  const progression = etapeIdx >= 0 ? ((etapeIdx) / ETAPES.length) * 100 : ecran === 'resultat' ? 100 : 0

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-brand-paper">
        <header className="bg-brand-ink px-lg pt-lg pb-md">
          <div className="flex items-center justify-between mb-sm">
            <Link to="/" className="font-display font-bold uppercase tracking-[0.08em] text-brand-parchment text-sm hover:text-brand-sky transition-colors">
              ← Amicale <span className="text-brand-sky">La Madeleine</span>
            </Link>
            <span className="text-xs text-brand-parchment/60">
              {ecran === 'intro' ? 'Accueil' : ecran === 'resultat' ? 'Résultat' : `${etapeIdx + 1} / ${ETAPES.length}`}
            </span>
          </div>
          <div className="h-2 bg-brand-ink border border-brand-hairline/30 rounded-pill overflow-hidden">
            <div className="h-full bg-brand-brick transition-all duration-300" style={{ width: `${progression}%` }} />
          </div>
        </header>

        <main className="flex-1 flex flex-col px-lg py-xl">
          {ecran === 'intro' && (
            <div className="flex flex-col flex-1">
              <p className="eyebrow mb-sm">Journée portes ouvertes</p>
              <h1 className="font-display font-extrabold uppercase text-4xl leading-[0.95] mb-md">
                T'as ce qu'il faut pour porter le casque ?
              </h1>
              <p className="text-sm text-brand-ink/70 mb-xl leading-relaxed">
                En <strong>1 minute</strong> et <strong>5 questions</strong>, découvre si tu peux rejoindre les
                sapeurs-pompiers volontaires du centre de La Madeleine.
              </p>
              <div className="grid grid-cols-3 gap-sm mb-xl">
                {[['5', 'questions rapides'], ['1 min', 'pour savoir'], ['0€', 'pour tenter']].map(([num, label]) => (
                  <div key={label} className="border border-brand-hairline bg-brand-parchment p-sm text-center">
                    <p className="font-display font-extrabold text-2xl text-brand-brick leading-none">{num}</p>
                    <p className="text-xs text-brand-ink/60 mt-xxs">{label}</p>
                  </div>
                ))}
              </div>
              <button className="btn-primary mt-auto" onClick={() => { setEcran('q1'); window.scrollTo(0, 0) }}>
                Je tente le test →
              </button>
            </div>
          )}

          {ecran === 'q1' && (
            <Question
              numero={1} titre="Quel âge as-tu ?"
              sousTitre="L'engagement en tant que SPV est possible entre 18 et 55 ans."
              options={[
                ['Moins de 16 ans', () => repondre('age', 'under16')],
                ['16 - 17 ans', () => repondre('age', 'jsp')],
                ['18 - 55 ans', () => repondre('age', 'ok')],
                ['Plus de 55 ans', () => repondre('age', 'over55')],
              ]}
            />
          )}

          {ecran === 'q2' && (
            <Question
              numero={2} titre="Tu vis à proximité de la caserne ?"
              sousTitre="Pouvoir rejoindre la caserne rapidement lors d'une alerte, c'est la base de la garde en astreinte."
              options={[
                ['Oui', () => repondre('residence', 'oui')],
                ['Non', () => repondre('residence', 'non')],
              ]}
              onRetour={() => retour('q1')}
            />
          )}

          {ecran === 'q3' && (
            <Question
              numero={3} titre="Tu peux te rendre disponible régulièrement ?"
              sousTitre="Gardes, astreintes et formations : le volontariat demande un vrai engagement de temps, en plus de ta vie pro."
              options={[
                ['Oui, je peux m\'organiser', () => repondre('dispo', 'oui')],
                ['Je ne sais pas encore', () => repondre('dispo', 'peut_etre')],
                ['Non, emploi du temps trop chargé', () => repondre('dispo', 'non')],
              ]}
              onRetour={() => retour('q2')}
            />
          )}

          {ecran === 'q4' && (
            <Question
              numero={4} titre="Tu es en pleine possession de tes droits civiques ?"
              sousTitre="C'est une condition légale pour devenir SPV — aucun justificatif ne t'est demandé aujourd'hui."
              options={[
                ['Oui', () => repondre('droits_civiques', 'oui')],
                ['Non', () => repondre('droits_civiques', 'non')],
                ['Je ne suis pas sûr(e)', () => repondre('droits_civiques', 'pas_sur')],
              ]}
              onRetour={() => retour('q3')}
            />
          )}

          {ecran === 'q5' && (
            <Question
              numero={5} titre="Ton casier judiciaire est vierge ?"
              sousTitre="(bulletin n°2) — autre condition légale, sans justificatif à ce stade."
              options={[
                ['Oui', () => repondre('casier', 'oui')],
                ['Non', () => repondre('casier', 'non')],
                ['Je ne suis pas sûr(e)', () => repondre('casier', 'pas_sur')],
              ]}
              onRetour={() => retour('q4')}
            />
          )}

          {ecran === 'resultat' && resultat && (
            <div className="flex flex-col flex-1">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-lg ${resultat.statut === 'eligible' ? 'bg-brand-sky' : 'bg-brand-hairline'}`}>
                {resultat.statut === 'eligible' ? '🚒' : '🧭'}
              </div>
              <p className={`eyebrow mb-sm ${resultat.statut === 'eligible' ? '' : 'text-brand-ink/50'}`}>{resultat.eyebrow}</p>
              <h1 className="font-display font-extrabold uppercase text-3xl leading-[0.95] mb-md">{resultat.titre}</h1>
              <p className="text-sm text-brand-ink/70 leading-relaxed mb-xl">{resultat.texte}</p>

              {resultat.capture && !envoye && (
                <form onSubmit={envoyerContact} className="signature-card mb-lg">
                  <p className="font-display font-bold uppercase text-base mb-md">Laisse tes coordonnées</p>
                  {erreur && <div className="border border-brand-brick text-brand-brick p-sm mb-md text-xs">{erreur}</div>}
                  <div className="grid grid-cols-2 gap-sm mb-sm">
                    <input required placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)}
                      className="border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm focus:outline-none focus:border-brand-petrol" />
                    <input required placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)}
                      className="border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm focus:outline-none focus:border-brand-petrol" />
                  </div>
                  <input placeholder="Téléphone" value={telephone} onChange={e => setTelephone(e.target.value)}
                    className="w-full border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm mb-sm focus:outline-none focus:border-brand-petrol" />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full border border-brand-hairline bg-brand-parchment px-sm py-xs text-sm mb-md focus:outline-none focus:border-brand-petrol" />
                  <button type="submit" disabled={envoi} className="btn-primary w-full text-sm">
                    {envoi ? 'Envoi…' : 'Envoyer mes coordonnées'}
                  </button>
                </form>
              )}

              {resultat.capture && envoye && (
                <div className="signature-card mb-lg text-center py-lg">
                  <p className="font-display font-bold uppercase text-brand-petrol">✓ Coordonnées transmises</p>
                  <p className="text-sm text-brand-ink/60 mt-xs">Le bureau te recontacte prochainement.</p>
                </div>
              )}

              {SDIS_URL && (
                <a href={SDIS_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary text-center mb-lg">
                  Voir le site du SDIS →
                </a>
              )}

              <button onClick={recommencer} className="text-sm text-brand-ink/50 underline mt-auto">
                Recommencer le test
              </button>
            </div>
          )}
        </main>

        <footer className="text-center py-md text-xs text-brand-ink/40">
          Amicale des Sapeurs-Pompiers de La Madeleine · Journée portes ouvertes
        </footer>
      </div>
    </div>
  )
}

function calculerResultat(r: ReponsesQuizRecrutement): ResultatConfig {
  if (r.age === 'under16') {
    return {
      eyebrow: 'Résultat', titre: 'Reviens nous voir bientôt',
      texte: "Tu es un peu jeune pour t'engager comme volontaire, mais le corps des Jeunes Sapeurs-Pompiers (JSP) accueille dès 11 ans dans certaines sections. L'engagement SPV sera possible à partir de 16 ans.",
      statut: 'pas_encore', capture: true,
    }
  }
  if (r.age === 'jsp') {
    return {
      eyebrow: 'Résultat', titre: 'Tu es sur la bonne voie',
      texte: "À 16-17 ans, un engagement anticipé est parfois possible selon les conditions du centre, ou tu peux continuer via les JSP en attendant tes 18 ans. Ton dossier peut déjà être préparé en amont.",
      statut: 'pas_encore', capture: true,
    }
  }
  if (r.age === 'over55') {
    return {
      eyebrow: 'Résultat', titre: "L'Amicale a aussi besoin de toi",
      texte: "L'âge limite d'engagement opérationnel est dépassé, mais l'Amicale recherche des bénévoles pour l'organisation d'événements, et le statut de sapeur-pompier vétéran est peut-être ouvert selon ton profil.",
      statut: 'pas_encore', capture: true,
    }
  }
  if (r.residence === 'non') {
    return {
      eyebrow: 'Résultat', titre: 'On en parle en réunion',
      texte: "Une tolérance est parfois possible selon ta situation — laisse-nous tes coordonnées, le bureau en discutera et te recontacte.",
      statut: 'a_verifier', capture: true,
    }
  }
  if (r.dispo === 'non') {
    return {
      eyebrow: 'Résultat', titre: 'Peut-être pas maintenant',
      texte: "Le volontariat demande une vraie disponibilité régulière. Si ton emploi du temps ne le permet pas aujourd'hui, ce n'est que partie remise — laisse-nous tes coordonnées, on te recontacte si ta situation évolue.",
      statut: 'pas_encore', capture: true,
    }
  }
  if (r.droits_civiques === 'non') {
    return {
      eyebrow: 'Résultat', titre: "C'est une condition légale",
      texte: "Être en pleine possession de ses droits civiques est une condition légale pour devenir sapeur-pompier volontaire, fixée par le SDIS59.",
      statut: 'pas_encore', capture: false,
    }
  }
  if (r.droits_civiques === 'pas_sur') {
    return {
      eyebrow: 'Résultat', titre: 'On en parle en privé',
      texte: "Pas de souci si tu n'es pas sûr(e) — laisse-nous tes coordonnées, un membre du bureau te recontacte pour clarifier ça tranquillement, en toute discrétion.",
      statut: 'a_verifier', capture: true,
    }
  }
  if (r.casier === 'non') {
    return {
      eyebrow: 'Résultat', titre: "C'est une condition légale",
      texte: "Un casier judiciaire vierge (bulletin n°2) est une condition légale pour devenir sapeur-pompier volontaire, fixée par le SDIS59.",
      statut: 'pas_encore', capture: false,
    }
  }
  if (r.casier === 'pas_sur') {
    return {
      eyebrow: 'Résultat', titre: 'On en parle en privé',
      texte: "Pas de souci si tu n'es pas sûr(e) — laisse-nous tes coordonnées, un membre du bureau te recontacte pour clarifier ça tranquillement, en toute discrétion.",
      statut: 'a_verifier', capture: true,
    }
  }

  return {
    eyebrow: 'Résultat', titre: 'Engage-toi !',
    texte: "Sur la base de tes réponses, tu remplis les critères de base pour devenir sapeur-pompier volontaire à La Madeleine. La suite se joue en vrai : laisse-nous tes coordonnées, on te recontacte rapidement.",
    statut: 'eligible', capture: true,
  }
}

function Question({ numero, titre, sousTitre, options, onRetour }: {
  numero: number
  titre: string
  sousTitre: string
  options: [string, () => void][]
  onRetour?: () => void
}) {
  return (
    <div className="flex flex-col flex-1">
      <p className="text-xs uppercase tracking-[0.08em] font-semibold text-brand-ink/40 mb-sm">Question {numero} / 5</p>
      <h2 className="font-display font-bold uppercase text-2xl leading-tight mb-xs">{titre}</h2>
      <p className="text-sm text-brand-ink/60 mb-xl leading-relaxed">{sousTitre}</p>
      <div className="flex flex-col gap-sm mt-auto">
        {options.map(([label, onClick]) => (
          <button
            key={label}
            onClick={onClick}
            className="text-left bg-brand-paper border-[1.5px] border-brand-hairline hover:border-brand-brick px-lg py-md font-semibold text-sm transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      {onRetour && (
        <button onClick={onRetour} className="text-xs text-brand-ink/50 mt-lg self-start">
          ← Retour
        </button>
      )}
    </div>
  )
}
