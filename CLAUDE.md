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
- Il n'y a **pas** de garde de route centralisée dans [src/App.tsx](src/App.tsx). Chaque page protégée répète le même pattern : `useEffect` qui `navigate('/login')` (ou `/`) si `!loading && !user`/`!isAdmin`, et `return null` pendant le chargement/redirect. Toute nouvelle page protégée doit reproduire ce pattern.
- La sécurité réelle des données doit venir des **policies RLS Postgres** côté Supabase, le contrôle d'accès client n'est qu'un confort UX. Toute fonction RLS qui imite `isAdmin`/`canManageMembres` côté base (`is_bureau`, `is_membre_manager`) doit rester synchronisée avec la logique du `AuthContext` — notamment le cas du compte admin fixe (email en dur dans les deux, cf. migrations `20240111000000_membres_gestionnaire.sql` et `20240115000000_is_bureau_admin.sql`).

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
