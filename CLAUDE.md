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
├── components/Layout/   # Header, Footer
├── pages/
│   ├── public/          # Organigramme (accueil, sans auth)
│   ├── auth/             # Login
│   ├── dashboard/        # Tableau de bord (rôles bureau)
│   ├── members/          # Liste/gestion membres
│   ├── documents/        # PDF + archives
│   ├── cotisations/      # Suivi paiements
│   └── calendrier/       # Événements + ICS
├── contexts/AuthContext.tsx  # Auth + résolution du membre courant
├── lib/supabase.ts       # Client Supabase + types de données
└── styles/               # Tailwind + CSS custom
supabase/migrations/      # Schéma SQL (source de vérité du schéma DB)
```

## Auth et autorisation

- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) expose `user` (session Supabase Auth), `membre` (ligne `membres` jointe par email), `loading`, et `isAdmin` (vrai si `membre.role` ∈ `president | tresorier | secretaire | adjoint`).
- Il n'y a **pas** de garde de route centralisée dans [src/App.tsx](src/App.tsx). Chaque page protégée (Dashboard, Membres, Documents, Cotisations, Calendrier) répète elle-même le même pattern : `useEffect` qui `navigate('/')` si `!loading && !isAdmin`, et `return null` pendant le chargement/redirect. Toute nouvelle page protégée doit reproduire ce pattern.
- La sécurité réelle des données doit venir des **policies RLS Postgres** côté Supabase, le contrôle d'accès client n'est qu'un confort UX.

## Données et types

- Le schéma SQL canonique vit dans [supabase/migrations/20240101000000_initial_schema.sql](supabase/migrations/20240101000000_initial_schema.sql) : `membres`, `organigramme`, `documents`, `cotisations`, `evenements`, `parametres_notifications`.
- Les types TS correspondants (`Membre`, `Document`, `Cotisation`, `Evenement`) sont déclarés à la main dans [src/lib/supabase.ts](src/lib/supabase.ts), pas générés — `npm run supabase:generate` produit un `database.types.ts` séparé qui n'est pas encore consommé ailleurs. Si le schéma SQL change, mettre à jour ces types manuellement (notamment les valeurs de `CHECK` constraints comme `role` ou `type`).

## Pages et données de test

Les pages comme [src/pages/public/Organigramme.tsx](src/pages/public/Organigramme.tsx) contiennent des jeux de données statiques (`bureauTest`, `membresTest`) chargés par défaut en `useEffect`, avec l'appel Supabase réel laissé en commentaire juste après (`/* Promise.all([fetchBureau(), fetchMembres()]) */`). Pour brancher une page sur les vraies données, décommenter cet appel et retirer le fallback de test.

## Style

Design system Tailwind custom dans [tailwind.config.cjs](tailwind.config.cjs) plutôt que l'échelle par défaut :
- Couleurs : `primary` rouge `#FF4F00`, `accent.gold` `#D4AF37`, `surface.dark` anthracite `#1a1a1a`.
- Espacements sémantiques `xxs`→`section` (ex. `p-xl`, `gap-lg`) et rayons `xs`→`pill`.

Utiliser ces tokens plutôt que les classes Tailwind par défaut (`bg-red-600`, etc.) pour rester cohérent avec l'existant.

## Notes

Voir [DESIGN.md](DESIGN.md) pour les décisions de design UI/UX détaillées.
