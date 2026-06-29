// Edge Function : crée OU réinitialise le compte de connexion (Supabase Auth)
// d'un membre existant de la table `membres`, avec un mot de passe aléatoire
// à usage unique. Si `membres.a_un_compte` est déjà true, on réinitialise le
// mot de passe du compte existant au lieu d'en créer un nouveau.
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
const PASSWORD_LENGTH = 16
// Alphabet sans caractères ambigus (0/O, 1/l/I).
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*'

function generatePassword(): string {
  const bytes = new Uint8Array(PASSWORD_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('')
}

async function findAuthUserIdByEmail(adminClient: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const emailLower = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    const found = data.users.find((u) => u.email?.toLowerCase() === emailLower)
    if (found) return found.id
    if (data.users.length < 200) break
  }
  return null
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

    const { data: caller } = await callerClient
      .from('membres')
      .select('role')
      .eq('email', userData.user.email)
      .maybeSingle()

    if (!caller || !ROLES_BUREAU.includes(caller.role)) {
      return jsonResponse({ error: 'Réservé au bureau.' }, 403)
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

    // Client admin : seule la clé service_role peut créer/modifier un compte Auth.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const password = generatePassword()

    if (cible.a_un_compte) {
      // Réinitialisation : le compte existe déjà, on remplace son mot de passe.
      let authUserId = cible.auth_user_id as string | null

      if (!authUserId) {
        // Compte créé avant l'ajout de auth_user_id : on le retrouve par email
        // en parcourant les utilisateurs Auth, puis on mémorise l'id trouvé.
        authUserId = await findAuthUserIdByEmail(adminClient, cible.email)

        if (!authUserId) {
          return jsonResponse(
            { error: 'Compte introuvable côté authentification. Contacte le support.' },
            404
          )
        }

        await adminClient.from('membres').update({ auth_user_id: authUserId }).eq('id', membreId)
      }

      const { error: resetError } = await adminClient.auth.admin.updateUserById(authUserId, { password })
      if (resetError) {
        return jsonResponse({ error: resetError.message }, 500)
      }

      return jsonResponse({ email: cible.email, password }, 200)
    }

    // Création d'un nouveau compte.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cible.email,
      password,
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
      .update({ a_un_compte: true, auth_user_id: created.user.id })
      .eq('id', membreId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({ email: cible.email, password }, 200)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erreur inattendue.' }, 500)
  }
})
