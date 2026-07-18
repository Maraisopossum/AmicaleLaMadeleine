// Edge Function : crée OU réinitialise le compte de connexion (Supabase Auth)
// d'un membre existant de la table `membres`, en lui attribuant un mot de
// passe temporaire — sans envoyer d'email (le SMTP intégré de Supabase est
// limité à quelques envois par heure, insuffisant pour un onboarding en masse
// et aucun nom de domaine n'est disponible pour un SMTP personnalisé).
//
// Le mot de passe temporaire est retourné en clair à l'appelant (le bureau),
// qui le communique au membre hors email (oral, papier). Le membre est
// contraint de le changer à sa première connexion via le flag
// `doit_changer_mdp` (voir 20240121000000_membres_doit_changer_mdp.sql).
//
// - Nouveau compte  : auth.admin.createUser() avec email_confirm: true (aucune
//   confirmation par email envoyée).
// - Compte existant : auth.admin.updateUserById() sur l'auth_user_id stocké.
//
// Sécurité : la création/modification de compte nécessite la clé service_role,
// qui ne doit jamais être exposée côté client. Cette fonction vérifie d'abord,
// avec le JWT de l'appelant, qu'il est président ou le compte admin fixe —
// via la RPC is_membre_manager() (20240111000000_membres_gestionnaire.sql),
// seule source de vérité pour cette permission (déjà utilisée pour la
// modification de rôle/statut et la suppression d'un membre). Le reste du
// bureau (trésorier, secrétaire, adjoints) n'a pas accès à cette opération.
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

// Alphabet sans caractères ambigus (0/O, 1/l/I exclus) : pensé pour être
// recopié à la main depuis une feuille imprimée.
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function generateTempPassword(length = 10): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}

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

    const { data: isManager, error: managerError } = await callerClient.rpc('is_membre_manager', {
      p_email: userData.user.email,
    })

    if (managerError || !isManager) {
      return jsonResponse({ error: 'Réservé au président et à l\'administrateur.' }, 403)
    }

    const { membreId } = await req.json()
    if (!membreId) {
      return jsonResponse({ error: 'membreId manquant.' }, 400)
    }

    const { data: cible, error: cibleError } = await callerClient
      .from('membres')
      .select('id, email, a_un_compte, auth_user_id')
      .eq('id', membreId)
      .maybeSingle()

    if (cibleError || !cible) {
      return jsonResponse({ error: 'Membre introuvable.' }, 404)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const tempPassword = generateTempPassword()

    if (cible.a_un_compte) {
      // Réinitialisation : écrase le mot de passe du compte existant.
      if (!cible.auth_user_id) {
        return jsonResponse({ error: 'Compte marqué actif mais sans auth_user_id — incohérence à corriger manuellement.' }, 500)
      }
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(cible.auth_user_id, {
        password: tempPassword,
      })
      if (updateAuthError) {
        return jsonResponse({ error: updateAuthError.message }, 500)
      }
      const { error: updateError } = await adminClient
        .from('membres')
        .update({ doit_changer_mdp: true })
        .eq('id', membreId)
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500)
      }
      return jsonResponse({ email: cible.email, password: tempPassword }, 200)
    }

    // Création : compte + mot de passe temporaire, aucun email envoyé.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cible.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !created.user) {
      const dejaExistant = createError?.message.toLowerCase().includes('already')
      return jsonResponse(
        { error: dejaExistant ? 'Un compte existe déjà pour cet email.' : createError?.message },
        dejaExistant ? 409 : 500
      )
    }

    const { error: updateError } = await adminClient
      .from('membres')
      .update({ a_un_compte: true, auth_user_id: created.user.id, doit_changer_mdp: true })
      .eq('id', membreId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({ email: cible.email, password: tempPassword }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inattendue.' }, 500)
  }
})
