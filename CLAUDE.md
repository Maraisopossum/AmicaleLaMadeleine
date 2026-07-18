# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Amicale des Sapeurs-Pompiers de La Madeleine

Application web de gestion associative pour sapeurs-pompiers (organigramme, membres, documents, cotisations, calendrier). Stack : React + Supabase + Netlify.

## Stack Technique
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Hébergement**: Netlify
- **Icônes**: Emoji natifs (pas de lib dépendance lourde)

## Commandes

```bash
npm run dev        # Serveur de dev (Vite) sur http://localhost:3000
npm run build      # Build de production -> dist/
npm run preview    # Preview du build
npm run lint       # ESLint sur src (.ts, .tsx)

npm run supabase:start     # Démarre Supabase en local (CLI Supabase requise)
npm run supabase:push      # Push les migrations vers le projet Supabase distant
npm run supabase:generate  # Régénère src/lib/database.types.ts depuis le schéma local
```

Aucune suite de tests n'est configurée à ce jour.

## Configuration

1. Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Le client ([src/lib/supabase.ts](src/lib/supabase.ts)) les lit via `import.meta.env`.
2. Côté Supabase : SQL Editor → coller `supabase/migrations/20240101000000_initial_schema.sql` ; Authentication → Settings → activer Email/Password ; Storage → créer un bucket public `documents` pour les PDF.
3. Côté Netlify : Settings → Environment → Build variables avec les mêmes clés `VITE_SUPABASE_*` (build command `npm run build`, publish dir `dist`, voir [netlify.toml](netlify.toml)).

## Architecture des dossiers

```
src/
├── components/Layout/   # Header, ModuleHeader
├── pages/
│   ├── public/          # Organigramme, Welcome (accueil, sans auth)
│   ├── auth/             # Login
│   ├── dashboard/        # Tableau de bord (rôles bureau)
│   ├── members/          # Liste/gestion membres
│   ├── documents/        # PDF + archives
│   ├── cotisations/      # Suivi paiements
│   ├── compte/           # Mon compte (auto-édition membre)
│   └── calendrier/       # Événements + ICS + page dédiée + Organisation
├── contexts/AuthContext.tsx  # Auth + résolution du membre courant
├── lib/supabase.ts       # Client Supabase + types de données
└── styles/               # Tailwind + CSS custom
supabase/migrations/      # Schéma SQL (source de vérité du schéma DB)
```

## Auth et autorisation

- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) expose `user` (session Supabase Auth), `membre` (ligne `membres` jointe par email), `loading`, `isAdmin` et `canManageMembres`.
- `isAdmin` est vrai si `membre.role` ∈ les 6 rôles élus de bureau (`president`, `secretaire`, `tresorier`, `adjoint_president`, `adjoint_secretaire`, `adjoint_tresorier`) **ou** si l'email connecté est `VITE_ADMIN_EMAIL` — ce compte admin fixe ([src/pages/auth/Login.tsx](src/pages/auth/Login.tsx) l'utilise via le raccourci de connexion `admin`/`admin`) n'a pas forcément de ligne `membres` avec un rôle de bureau, donc ce cas doit rester explicite dans `isAdmin`.
- `canManageMembres` (plus restreint qu'`isAdmin` : seulement président + admin) gate la modification du rôle/statut d'un membre ou sa suppression.
- La garde de route est centralisée dans [src/components/RequireAuth.tsx](src/components/RequireAuth.tsx), branchée sur chaque route protégée dans [src/App.tsx](src/App.tsx) (`<Route path="..." element={<RequireAuth><Page /></RequireAuth>} />`). Elle redirige vers `/login` si `!user`, et vers `/mon-compte` si `membre.doit_changer_mdp` est vrai (mot de passe temporaire non encore changé, sauf sur `/mon-compte` elle-même). Toute nouvelle page protégée doit être enveloppée par `RequireAuth` plutôt que de dupliquer un `useEffect` de garde.
- La sécurité réelle des données doit venir des **policies RLS Postgres** côté Supabase, le contrôle d'accès client n'est qu'un confort UX. Toute fonction RLS qui imite `isAdmin`/`canManageMembres` côté base (`is_bureau`, `is_membre_manager`) doit rester synchronisée avec la logique du `AuthContext` — notamment le cas du compte admin fixe (email en dur dans les deux, cf. migrations `20240111000000_membres_gestionnaire.sql` et `20240115000000_is_bureau_admin.sql`).

### Attribution des accès (mot de passe temporaire, pas d'email)

Le SMTP intégré de Supabase est limité à quelques envois par heure (aucun nom de domaine disponible pour un SMTP personnalisé/Resend), insuffisant pour un onboarding en masse. L'edge function [supabase/functions/create-membre-access/index.ts](supabase/functions/create-membre-access/index.ts) n'envoie donc plus aucun email : elle génère un mot de passe temporaire (lisible, sans caractères ambigus), l'attribue via `auth.admin.createUser`/`updateUserById`, et le retourne en clair à l'appelant, qui le communique au membre hors email.

Générer/réinitialiser un accès est réservé au président et à l'admin fixe (même permission que modifier le rôle/statut d'un membre ou le supprimer, donc `canManageMembres` côté client) — pas à tout le bureau. L'edge function vérifie ce droit via la RPC `is_membre_manager()` (`20240111000000_membres_gestionnaire.sql`), et non via une liste de rôles dupliquée : c'est la même source de vérité que les policies RLS `membres_delete_manager` et le trigger `lock_sensitive_membre_fields`.

- `membres.doit_changer_mdp` (migration `20240121000000_membres_doit_changer_mdp.sql`) est mis à `true` par l'edge function à chaque attribution/réinitialisation. La colonne est verrouillée contre l'écriture directe par un membre (même trigger que les autres colonnes sensibles, cf. `20240110000000_membres_self_update.sql`) ; seule la RPC `SECURITY DEFINER` `clear_doit_changer_mdp()`, appelée par [MonCompte.tsx](src/pages/compte/MonCompte.tsx) juste après un changement de mot de passe réussi, peut la repasser à `false`.
- `RequireAuth` (voir plus haut) force la redirection vers `/mon-compte` tant que ce flag est vrai — le membre ne peut rien faire d'autre tant qu'il n'a pas changé son mot de passe temporaire.
- [Membres.tsx](src/pages/members/Membres.tsx) permet de générer les accès un par un ou en masse (sélection multiple + export CSV `prenom,nom,email,mot_de_passe_temporaire`) — ce CSV contient des mots de passe en clair, à traiter comme un document sensible (à supprimer après usage).
- [Login.tsx](src/pages/auth/Login.tsx) n'a plus de flux self-service « mot de passe oublié » : un membre qui perd son mot de passe doit contacter le bureau.

## Données et types

- Le schéma SQL canonique vit dans les migrations de [supabase/migrations/](supabase/migrations/), appliquées dans l'ordre chronologique de leur préfixe de date. Tables principales : `membres`, `organigramme`, `documents`, `cotisations`, `evenements`, `parametres_notifications`, plus le module Organisation d'événement (`evenement_sections`, `evenement_organisation`, `stands`, `deadlines`, `affectations`).
- Les types TS correspondants (`Membre`, `Document`, `Cotisation`, `Evenement`, `Stand`, `Deadline`, `Affectation`...) sont déclarés à la main dans [src/lib/supabase.ts](src/lib/supabase.ts), pas générés — `npm run supabase:generate` produit un `database.types.ts` séparé qui n'est pas encore consommé ailleurs. Si le schéma SQL change, mettre à jour ces types manuellement (notamment les valeurs de `CHECK` constraints comme `role` ou `type`).
- Les écritures Supabase (`const { data } = await supabase...`) n'inspectent généralement pas `error` — un échec réseau ou une policy RLS qui bloque silencieusement se traduit par une liste vide côté UI plutôt qu'un message d'erreur. C'est la convention actuelle du code existant, pas un oubli isolé à corriger page par page.

## Module Organisation d'un événement

[src/pages/calendrier/Evenement.tsx](src/pages/calendrier/Evenement.tsx) (page dédiée d'un événement, visible seulement si `evenements.page_dediee = true`) a deux onglets : "Infos" (programme/infos pratiques + liste publique des stands) et "Organisation" ([src/pages/calendrier/Organisation.tsx](src/pages/calendrier/Organisation.tsx), réservé aux gros événements type JPO).

- L'onglet Organisation a 3 sous-parties : Stands, Deadlines, Planning horaire (grille de créneaux configurable en heures de début/fin + durée, imprimable en A4 paysage via une feuille `@media print` scoped sur `#planning-impression`).
- Modèle de permission à deux niveaux, distinct d'`isAdmin` global : un membre peut être désigné `responsable_id` d'un `stand` et devient alors gestionnaire de ce stand uniquement (peut l'éditer, gérer ses deadlines et ses affectations de créneaux), sans être du bureau. Côté RLS, la fonction `is_stand_manager(email, stand_id)` (migration `20240114000000_evenement_organisation.sql`) encode cette règle ; côté front, le callback `peutGererStand(stand)` dans `Organisation.tsx` fait la même vérification (`isAdmin || stand.responsable_id === membre.id`).
- Les deadlines peuvent être globales à l'événement (`stand_id = null`, gérées par le bureau) ou rattachées à un stand (gérées aussi par son gestionnaire).
- Les affectations de créneaux acceptent soit un `membre_id` existant, soit un `nom_libre` (bénévole externe sans compte) — `affectations` a une contrainte `CHECK` exigeant l'un des deux.

## Style

Design system Tailwind custom dans [tailwind.config.cjs](tailwind.config.cjs) plutôt que l'échelle par défaut. La palette réellement utilisée dans le code est `brand.*` ("Caserne 1847", extraite de l'écusson) : `brand-brick` (rouge brique), `brand-petrol` (bleu pétrole, couleur d'accent principale), `brand-sky`, `brand-ink` (texte foncé), `brand-parchment`/`brand-paper` (fonds clairs), `brand-hairline` (bordures). Les tokens `primary`/`accent`/`surface` existent aussi dans le config mais ne sont utilisés nulle part dans `src/` — ne pas les introduire dans du nouveau code, rester sur `brand-*`.

Espacements sémantiques `xxs`→`section` (ex. `p-xl`, `gap-lg`) et rayons `xs`→`pill`, à utiliser plutôt que les classes Tailwind par défaut (`bg-red-600`, `p-4`, etc.) pour rester cohérent avec l'existant.

## Notes

Voir [DESIGN.md](DESIGN.md) pour les décisions de design UI/UX détaillées, et [AUDIT.md](AUDIT.md) pour l'historique d'un audit sécurité/qualité (RLS, gardes d'auth manquantes, etc.) déjà corrigé dans le code actuel.
