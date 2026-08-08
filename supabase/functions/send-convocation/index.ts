// Edge Function : envoie par email la convocation à une Assemblée Générale
// (ou tout événement du Calendrier), à la demande du bureau — déclenchement
// manuel via un bouton (pas de trigger automatique : le bureau choisit le
// moment où titre/date/ordre du jour sont prêts à être communiqués, et à
// qui — cf. sélection de statuts destinataires côté client).
//
// Contenu : infos de l'événement (titre, date, lieu, description) + l'ordre
// du jour du CR lié s'il existe déjà (module Réunions, evenement_id).
//
// Sécurité : réservé au bureau (is_bureau), vérifié via le JWT de l'appelant
// — même pattern que create-membre-access mais avec la permission plus
// large is_bureau (une convocation n'est pas une opération aussi sensible
// que la gestion des comptes membres).
//
// Déploiement :
//   supabase functions deploy send-convocation

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { envoyerEmail } from '../_shared/resend.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non authentifié.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user?.email) return jsonResponse({ error: 'Session invalide.' }, 401)

    const { data: estBureau, error: bureauError } = await callerClient.rpc('is_bureau', { p_email: userData.user.email })
    if (bureauError || !estBureau) return jsonResponse({ error: 'Réservé au bureau.' }, 403)

    const { evenementId, statuts } = await req.json()
    if (!evenementId || !Array.isArray(statuts) || !statuts.length) {
      return jsonResponse({ error: 'evenementId et statuts (non vide) requis.' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: evenement, error: evenementError } = await adminClient
      .from('evenements').select('*').eq('id', evenementId).maybeSingle()
    if (evenementError || !evenement) return jsonResponse({ error: 'Événement introuvable.' }, 404)

    const { data: reunion } = await adminClient
      .from('reunions').select('ordre_du_jour').eq('evenement_id', evenementId).maybeSingle()

    const { data: membres, error: membresError } = await adminClient
      .from('membres').select('email').in('statut', statuts)
    if (membresError) return jsonResponse({ error: membresError.message }, 500)

    const corpsHtml = `
      <p>Vous êtes convoqué(e) à :</p>
      <p style="font-size:16px;font-weight:bold;">${evenement.titre}</p>
      <p>📅 ${formatDate(evenement.date_debut)}</p>
      ${evenement.lieu ? `<p>📍 ${evenement.lieu}</p>` : ''}
      ${evenement.description ? `<p>${evenement.description}</p>` : ''}
      ${reunion?.ordre_du_jour
        ? `<p style="margin-top:16px;"><strong>Ordre du jour :</strong><br/>${reunion.ordre_du_jour.replace(/\n/g, '<br/>')}</p>`
        : '<p style="margin-top:16px;color:#6b6862;">Ordre du jour communiqué ultérieurement.</p>'
      }
    `

    let envoyes = 0
    for (const membre of membres || []) {
      const resultat = await envoyerEmail(membre.email, `Convocation — ${evenement.titre}`, corpsHtml)
      if (resultat.ok) envoyes++
    }

    return jsonResponse({ sent: envoyes, total: (membres || []).length }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inattendue.' }, 500)
  }
})
