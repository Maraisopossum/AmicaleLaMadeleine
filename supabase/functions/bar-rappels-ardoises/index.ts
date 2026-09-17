// Edge Function : vérification périodique des ardoises du bar, appelée par
// un cron GitHub Actions (.github/workflows/bar-rappels-ardoises.yml, même
// principe que keep-alive.yml). Le cron tourne quotidiennement, mais cette
// fonction ne fait réellement quelque chose que si la fréquence configurée
// (bar_configuration_rappels.frequence_jours) est écoulée depuis le dernier
// envoi — un changement de fréquence dans l'appli prend donc effet sans
// toucher au fichier de workflow.
//
// Pour chaque membre dont le solde dépasse le seuil "avertissement" ou
// "urgent" (bar_configuration_rappels), envoie :
//   - une notification personnelle au membre concerné (s'il a activé
//     notif_bar_ardoise) ;
//   - un récapitulatif aux barmans/bureau ayant activé notif_bar_ardoise.
//
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (déjà utilisées par
// send-notification), BAR_CRON_SECRET (dédié, distinct de WEBHOOK_SECRET —
// celui-ci authentifie un déclenchement externe programmé, pas un trigger
// Postgres). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fournies
// automatiquement.
//
// Déploiement :
//   supabase functions deploy bar-rappels-ardoises

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const cronSecret = Deno.env.get('BAR_CRON_SECRET')!

webpush.setVapidDetails('mailto:contact@amicale-lamadeleine.fr', vapidPublicKey, vapidPrivateKey)

const ROLES_BUREAU = ['president', 'secretaire', 'tresorier', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']

function formatMontant(n: number): string {
  return `${Math.abs(n).toFixed(2)} €`
}

async function envoyerPush(supabase: ReturnType<typeof createClient>, membreIds: string[], titre: string, corps: string) {
  if (!membreIds.length) return 0
  const { data: abonnements } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('membre_id', membreIds)

  const payloadJson = JSON.stringify({ titre, corps, url: '/bar' })
  let envoyes = 0
  for (const abonnement of abonnements || []) {
    try {
      await webpush.sendNotification(
        { endpoint: abonnement.endpoint as string, keys: { p256dh: abonnement.p256dh as string, auth: abonnement.auth as string } },
        payloadJson
      )
      envoyes++
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', abonnement.id as string)
      }
    }
  }
  return envoyes
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: config } = await supabase.from('bar_configuration_rappels').select('*').eq('id', true).single()
  if (!config) {
    return new Response(JSON.stringify({ error: 'Configuration des rappels introuvable.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const dernierEnvoi = config.dernier_envoi ? new Date(config.dernier_envoi as string) : null
  const joursEcoules = dernierEnvoi ? (Date.now() - dernierEnvoi.getTime()) / (1000 * 60 * 60 * 24) : Infinity
  if (joursEcoules < Number(config.frequence_jours)) {
    return new Response(JSON.stringify({ skipped: true, reason: 'Fréquence pas encore écoulée.', joursEcoules }), { headers: { 'Content-Type': 'application/json' } })
  }

  const seuilAvertissement = Number(config.seuil_avertissement)
  const seuilUrgent = Number(config.seuil_urgent)

  const { data: soldes } = await supabase.from('bar_soldes').select('membre_id, solde').lte('solde', seuilAvertissement)
  const membreIds = (soldes || []).map((s) => s.membre_id as string)

  let concernes: { id: string; prenom: string; nom: string; solde: number; palier: 'avertissement' | 'urgent'; notif_bar_ardoise: boolean }[] = []
  if (membreIds.length) {
    const { data: membresData } = await supabase
      .from('membres')
      .select('id, prenom, nom, notif_bar_ardoise, role, est_barman')
      .in('id', membreIds)

    concernes = (soldes || []).map((s) => {
      const m = (membresData || []).find((x) => x.id === s.membre_id)
      return {
        id: s.membre_id as string,
        prenom: (m?.prenom as string) ?? '',
        nom: (m?.nom as string) ?? '',
        solde: Number(s.solde),
        palier: Number(s.solde) <= seuilUrgent ? 'urgent' : 'avertissement',
        notif_bar_ardoise: (m?.notif_bar_ardoise as boolean) ?? true,
      }
    }).sort((a, b) => a.solde - b.solde)
  }

  // Notification personnelle à chaque membre concerné.
  let envoyesPersonnels = 0
  for (const c of concernes) {
    if (!c.notif_bar_ardoise) continue
    const titre = c.palier === 'urgent' ? 'Ardoise à régler en urgence' : 'Ardoise à régler'
    const corps = `Tu dois ${formatMontant(c.solde)} sur ton ardoise du bar — pense à la régler.`
    envoyesPersonnels += await envoyerPush(supabase, [c.id], titre, corps)
  }

  // Récapitulatif aux barmans/bureau ayant activé les rappels.
  let envoyesRecap = 0
  if (concernes.length) {
    const { data: managers } = await supabase
      .from('membres')
      .select('id')
      .eq('notif_bar_ardoise', true)
      .or(`est_barman.eq.true,role.in.(${ROLES_BUREAU.join(',')})`)

    const managerIds = (managers || []).map((m) => m.id as string)
    const urgents = concernes.filter((c) => c.palier === 'urgent')
    const corps = urgents.length
      ? `${concernes.length} ardoise(s) à relancer, dont ${urgents.length} en urgence (ex: ${urgents[0].prenom} ${urgents[0].nom}, ${formatMontant(urgents[0].solde)}).`
      : `${concernes.length} ardoise(s) à relancer.`
    envoyesRecap = await envoyerPush(supabase, managerIds, 'Ardoises à relancer', corps)
  }

  await supabase.from('bar_configuration_rappels').update({ dernier_envoi: new Date().toISOString() }).eq('id', true)

  return new Response(
    JSON.stringify({ concernes: concernes.length, envoyesPersonnels, envoyesRecap }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
