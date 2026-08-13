// Edge Function : envoie une notification push (Web Push / VAPID) à
// l'audience concernée par un événement de l'app (nouvelle candidature,
// réunion publiée, nouvelle idée, vote ouvert, nouveau document).
//
// Déclenchement : 5 triggers Postgres (table candidatures/reunions/idees/
// votes/documents) appelant cette fonction via supabase_functions.http_request,
// créés directement en base via `supabase db query --linked` (PAS via une
// migration versionnée : le header d'authentification qu'ils embarquent ne
// doit jamais finir en clair dans l'historique Git). Le script qui les a
// créés est conservé hors du dépôt ; voir README.md dans ce dossier pour le
// recréer si besoin (ex: après un `supabase db reset`).
//
// Le trigger envoie un payload {type, table, record, old_record, schema} ;
// cette fonction en déduit l'événement, calcule l'audience (membres ayant
// activé le type de notification concerné, cf. colonnes notif_* sur
// membres), et pousse une notification à chaque abonnement push enregistré
// pour ces membres. Les abonnements expirés (410/404 renvoyés par le
// service push du navigateur) sont supprimés au passage.
//
// Sécurité : le header x-webhook-secret doit correspondre au secret
// WEBHOOK_SECRET (connu uniquement des triggers et de cette fonction) —
// empêche quiconque connaissant juste la clé anon publique de déclencher
// des envois de notifications arbitraires.
//
// Secrets requis (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (générés par scripts/generate-vapid-keys.mjs)
//   WEBHOOK_SECRET                        (chaîne aléatoire, cf. README.md)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies automatiquement.
//
// Secret optionnel :
//   ADMIN_EMAIL  (même valeur que VITE_ADMIN_EMAIL côté front) — permet
//   d'inclure le compte admin fixe dans l'email "Nouvelle candidature" même
//   s'il n'a pas de ligne `membres` avec acces_candidatures=true.
//
// Déploiement :
//   supabase functions deploy send-notification

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
import { envoyerEmail } from '../_shared/resend.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const webhookSecret = Deno.env.get('WEBHOOK_SECRET')!
const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? null
const SITE_URL = 'https://pompiers-lamadeleine.fr'

// Les valeurs interpolées dans les emails (corpsEmailCandidature notamment)
// peuvent venir d'une saisie publique non authentifiée (quiz de recrutement) :
// échapper avant d'injecter dans le HTML envoyé par email.
function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

webpush.setVapidDetails('mailto:contact@amicale-lamadeleine.fr', vapidPublicKey, vapidPrivateKey)

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  // deno-lint-ignore no-explicit-any
  record: any
  // deno-lint-ignore no-explicit-any
  old_record: any | null
}

type NotificationAMi = { titre: string; corps: string; corpsEmail?: string; url: string; audienceFiltre: string; parEmail: boolean } | null

const LABELS_ELIGIBILITE: Record<string, string> = {
  eligible: 'Éligible',
  a_verifier: 'À vérifier',
  pas_encore: 'Pas encore éligible',
}

// deno-lint-ignore no-explicit-any
function corpsEmailCandidature(record: any): string {
  const prenom = echapperHtml(String(record.prenom ?? ''))
  const nom = echapperHtml(String(record.nom ?? ''))
  const telephone = record.telephone ? echapperHtml(String(record.telephone)) : null
  const email = record.email ? echapperHtml(String(record.email)) : null
  const coordonnees = [
    telephone ? `Téléphone : <a href="tel:${telephone}" style="color:#181410;">${telephone}</a>` : null,
    email ? `Email : <a href="mailto:${email}" style="color:#181410;">${email}</a>` : null,
  ].filter(Boolean).join('<br>')
  const statut = LABELS_ELIGIBILITE[record.statut_eligibilite as string] ?? echapperHtml(String(record.statut_eligibilite ?? ''))

  return [
    `<p><strong>${prenom} ${nom}</strong> a laissé ses coordonnées sur le quiz de recrutement.</p>`,
    coordonnees ? `<p>${coordonnees}</p>` : '',
    `<p>Statut d'éligibilité : <strong>${statut}</strong></p>`,
  ].filter(Boolean).join('')
}

const ROLES_BUREAU = ['president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']

function calculerNotification(payload: WebhookPayload): NotificationAMi {
  const { type, table, record, old_record } = payload

  if (table === 'candidatures' && type === 'INSERT') {
    return {
      titre: 'Nouvelle candidature',
      corps: `${record.prenom} ${record.nom} a laissé ses coordonnées sur le quiz de recrutement.`,
      corpsEmail: corpsEmailCandidature(record),
      url: '/candidatures',
      audienceFiltre: 'acces_candidatures',
      parEmail: true,
    }
  }

  if (table === 'reunions' && type === 'UPDATE' && record.statut === 'publie' && old_record?.statut !== 'publie') {
    return {
      titre: 'Compte-rendu publié',
      corps: `Le CR de "${record.titre}" est disponible.`,
      url: `/reunions/${record.id}`,
      audienceFiltre: 'notif_reunions',
      parEmail: false,
    }
  }

  if (table === 'idees' && type === 'INSERT') {
    return {
      titre: 'Nouvelle idée',
      corps: `Une nouvelle idée a été soumise : "${record.titre}".`,
      url: '/idees',
      audienceFiltre: 'notif_idees_bureau',
      parEmail: false,
    }
  }

  if (table === 'votes' && type === 'UPDATE' && record.statut === 'ouvert' && old_record?.statut !== 'ouvert') {
    return {
      titre: 'Nouveau vote ouvert',
      corps: `Le vote "${record.titre}" est ouvert.`,
      url: `/votes/${record.id}`,
      audienceFiltre: 'notif_votes',
      parEmail: true,
    }
  }

  if (table === 'documents' && type === 'INSERT' && record.archive === false) {
    return {
      titre: 'Nouveau document',
      corps: `"${record.titre}" a été ajouté.`,
      url: '/documents',
      audienceFiltre: 'notif_documents',
      parEmail: false,
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const payload = (await req.json()) as WebhookPayload
  const notification = calculerNotification(payload)

  if (!notification) {
    return new Response(JSON.stringify({ skipped: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Audience push : suit les préférences notif_*/acces_candidatures (opt-in
  // personnel dans Mon compte, ou désignation par le bureau).
  let membresQuery = supabase.from('membres').select('id, email')
  if (notification.audienceFiltre === 'acces_candidatures') {
    membresQuery = membresQuery.eq('acces_candidatures', true)
  } else if (notification.audienceFiltre === 'notif_idees_bureau') {
    membresQuery = membresQuery.eq('notif_idees', true).in('role', ROLES_BUREAU)
  } else {
    membresQuery = membresQuery.eq(notification.audienceFiltre, true)
  }

  const { data: membres } = await membresQuery
  const membreIds = (membres || []).map((m) => m.id)

  let envoyesPush = 0
  if (membreIds.length) {
    const { data: abonnements } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('membre_id', membreIds)

    const payloadJson = JSON.stringify({ titre: notification.titre, corps: notification.corps, url: notification.url })

    for (const abonnement of abonnements || []) {
      try {
        await webpush.sendNotification(
          { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
          payloadJson
        )
        envoyesPush++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', abonnement.id)
        }
      }
    }
  }

  // Audience email : pour les votes, ce sont les statuts_eligibles du vote
  // qui déterminent qui doit être informé (pas une préférence générique) —
  // distinct de l'audience push ci-dessus. Pour les candidatures, même
  // groupe que le push (acces_candidatures), déjà chargé.
  let envoyesEmail = 0
  if (notification.parEmail) {
    let destinataires: { email: string }[] = membres || []
    if (payload.table === 'votes') {
      const { data } = await supabase.from('membres').select('email').in('statut', payload.record.statuts_eligibles || [])
      destinataires = data || []
    }
    // Le compte admin fixe (cf. CLAUDE.md) a accès aux candidatures sans
    // forcément avoir de ligne `membres` avec acces_candidatures=true —
    // l'ajouter explicitement pour ne pas le priver de cette notification.
    if (notification.audienceFiltre === 'acces_candidatures' && adminEmail && !destinataires.some(d => d.email === adminEmail)) {
      destinataires = [...destinataires, { email: adminEmail }]
    }

    const lienComplet = `${SITE_URL}${notification.url}`
    const corpsHtml = notification.corpsEmail ?? `<p>${notification.corps}</p>`
    for (const destinataire of destinataires) {
      const resultat = await envoyerEmail(
        destinataire.email,
        notification.titre,
        `${corpsHtml}<p><a href="${lienComplet}" style="color:#9E2222;">Voir sur l'espace membre →</a></p>`
      )
      if (resultat.ok) envoyesEmail++
    }
  }

  return new Response(JSON.stringify({ sentPush: envoyesPush, sentEmail: envoyesEmail }), { headers: { 'Content-Type': 'application/json' } })
})
