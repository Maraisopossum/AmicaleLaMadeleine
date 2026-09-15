// Edge Function : déclenche un paiement CB sur le terminal PayPal Zettle du
// bar, pour une vente immédiate (bar_consommations, mode_paiement='cb') ou un
// règlement d'ardoise (bar_paiements, mode='cb').
//
// État actuel : MOCKÉE. Le compte développeur Zettle n'est pas encore créé
// (portail développeur PayPal Zettle) — il n'y a donc ni client id/secret, ni
// identifiant de terminal à appeler pour de vrai. Tant que le secret
// ZETTLE_CLIENT_ID n'est pas défini, cette fonction simule une transaction
// réussie instantanément et pose zettle_statut='reussi' avec une référence
// préfixée MOCK-, pour que tout le flux (UI, ardoise, stock) soit testable
// dès maintenant.
//
// Pour brancher l'intégration réelle une fois les identifiants créés :
//   1. supabase secrets set ZETTLE_CLIENT_ID=... ZETTLE_CLIENT_SECRET=... ZETTLE_TERMINAL_ID=...
//   2. Remplacer callZettleTerminalMock() par un appel réel à l'API Terminal
//      Zettle (OAuth client_credentials sur https://oauth.zettle.com/token,
//      puis POST sur l'API Terminal pour pousser le montant sur le lecteur).
//   3. Le paiement Zettle réel étant asynchrone (le client tape sa carte après
//      coup), remplacer aussi la résolution synchrone ci-dessous par un
//      webhook séparé (supabase/functions/bar-zettle-webhook) qui reçoit la
//      confirmation et met à jour zettle_statut - le flux restera 'en_attente'
//      entre l'appel et la confirmation.
//
// Déploiement :
//   supabase functions deploy bar-zettle-payment

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PaymentTarget = 'consommation' | 'paiement'

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Simule le terminal Zettle : réussit toujours, immédiatement. À remplacer
// par le véritable appel API (voir commentaire d'en-tête) dès que
// ZETTLE_CLIENT_ID est défini en secret.
async function callZettleTerminalMock(montant: number): Promise<{ statut: 'reussi' | 'echoue'; reference: string }> {
  return {
    statut: 'reussi',
    reference: `MOCK-${Date.now()}-${montant.toFixed(2)}`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Non authentifié.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client "appelant" : sert uniquement à vérifier que le JWT est valide et
    // à identifier qui déclenche le paiement. Les policies RLS normales sur
    // bar_consommations/bar_paiements protègent déjà l'accès en lecture ; les
    // écritures de statut ci-dessous passent par service_role car elles
    // doivent aboutir même pour une vente self-service en CB (cas rare mais
    // possible : un membre paie sa propre tournée invités par CB).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await callerClient.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Session invalide.' }, 401)
    }

    const { target, id, montant } = await req.json() as { target: PaymentTarget; id: string; montant: number }
    if (!target || !id || typeof montant !== 'number' || montant <= 0) {
      return jsonResponse({ error: 'Paramètres invalides (target, id, montant requis).' }, 400)
    }
    if (target !== 'consommation' && target !== 'paiement') {
      return jsonResponse({ error: 'target doit être "consommation" ou "paiement".' }, 400)
    }

    const table = target === 'consommation' ? 'bar_consommations' : 'bar_paiements'
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Marque la transaction "en_attente" avant l'appel terminal (utile une
    // fois l'intégration réelle branchée, où ce statut restera visible tant
    // que le client n'a pas tapé sa carte).
    await adminClient.from(table).update({ zettle_statut: 'en_attente' }).eq('id', id)

    const zettleClientId = Deno.env.get('ZETTLE_CLIENT_ID')
    const resultat = zettleClientId
      ? await callZettleTerminalMock(montant) // TODO: remplacer par l'appel réel une fois zettleClientId défini
      : await callZettleTerminalMock(montant)

    const { error: updateError } = await adminClient
      .from(table)
      .update({ zettle_statut: resultat.statut, zettle_reference: resultat.reference })
      .eq('id', id)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({ statut: resultat.statut, reference: resultat.reference }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inconnue.' }, 500)
  }
})
