// Edge Function : crée OU réinitialise le compte de connexion (Supabase Auth)
// d'un membre existant de la table `membres`.
//
// - Nouveau compte  : inviteUserByEmail → Supabase envoie un email d'invitation
//   avec un lien permettant au membre de choisir son mot de passe.
// - Compte existant : resetPasswordForEmail → Supabase envoie un email de
//   récupération avec un lien de réinitialisation du mot de passe.
//
// Dans les deux cas l'appelant reçoit { sent: true, email } — aucun mot de
// passe n'est généré ni transmis.
//
// Sécurité : la création/modification de compte nécessite la clé service_role,
// qui ne doit jamais être exposée côté client. Cette fonction vérifie d'abord,
// avec le JWT de l'appelant, que celui-ci fait partie du bureau avant
// d'utiliser la clé service_role pour l'opération privilégiée.
//
// Déploiement :
//   supabase functions deploy create-membre-access
//
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont déjà
// fournies automatiquement par l'environnement d'exécution des Edge Functions.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES_BUREAU = ['president', 'tresorier', 'secretaire', 'adjoint_president', 'adjoint_secretaire', 'adjoint_tresorier']

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
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

    // Client "appelant" : porte le JWT de la session, soumis aux policies RLS.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user?.email) {
      return jsonResponse({ error: 'Session invalide.' }, 401)
    }

    const { data: caller } = await callerClient
      .from('membres')
      .select('role')
      .eq('email', userData.user.email)
      .maybeSingle()

    if (!caller || !ROLES_BUREAU.includes(caller.role)) {
      return jsonResponse({ error: 'Réservé au bureau.' }, 403)
    }

    const { membreId, redirectTo } = await req.json()
    if (!membreId) {
      return jsonResponse({ error: 'membreId manquant.' }, 400)
    }

    const { data: cible, error: cibleError } = await callerClient
      .from('membres')
      .select('id, email, a_un_compte')
      .eq('id', membreId)
      .maybeSingle()

    if (cibleError || !cible) {
      return jsonResponse({ error: 'Membre introuvable.' }, 404)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const inviteRedirect = redirectTo || `${supabaseUrl}/mon-compte`

    if (cible.a_un_compte) {
      // Réinitialisation : envoie un email de récupération de mot de passe.
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(cible.email, {
        redirectTo: inviteRedirect,
      })
      if (resetError) {
        return jsonResponse({ error: resetError.message }, 500)
      }
      return jsonResponse({ sent: true, email: cible.email }, 200)
    }

    // Création : invite le membre par email — il choisira son mot de passe en cliquant le lien.
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(cible.email, {
      redirectTo: inviteRedirect,
    })

    if (inviteError || !invited.user) {
      const dejaExistant = inviteError?.message.toLowerCase().includes('already')
      return jsonResponse(
        { error: dejaExistant ? 'Un compte existe déjà pour cet email.' : inviteError?.message },
        dejaExistant ? 409 : 500
      )
    }

    const { error: updateError } = await adminClient
      .from('membres')
      .update({ a_un_compte: true, auth_user_id: invited.user.id })
      .eq('id', membreId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({ sent: true, email: cible.email }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inattendue.' }, 500)
  }
})
