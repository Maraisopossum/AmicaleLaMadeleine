# Audit du projet — Amicale ASP La Madeleine

Date : 2026-06-28
Périmètre : sécurité, bugs, qualité de code, architecture.

## Critique — sécurité / confidentialité des données

### 1. Aucune politique RLS sur les tables Supabase
`supabase/migrations/20240101000000_initial_schema.sql` ne contient aucun `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY`. Par défaut Supabase autorise toutes les opérations via la clé `anon` quand RLS n'est pas activé : n'importe qui en possession de `VITE_SUPABASE_ANON_KEY` (visible dans le bundle JS livré au navigateur) peut lire/écrire `membres`, `cotisations`, `documents`, `evenements`, `organigramme`, `parametres_notifications` directement via l'API REST de Supabase, sans passer par l'app.

**Corrigé** : ajout de `supabase/migrations/20240102000000_enable_rls.sql` qui active RLS sur toutes les tables et pose des policies de base (lecture publique pour le contenu non sensible, lecture/écriture restreinte aux membres authentifiés pour les données sensibles, écriture réservée au bureau pour les opérations d'administration). **Cette migration doit être poussée vers Supabase** (`npm run supabase:push` ou copier/coller dans le SQL Editor) — elle n'a aucun effet tant qu'elle n'est pas appliquée à la base réelle.

### 2. Pages "protégées" en réalité accessibles sans authentification
Seul `Dashboard.tsx` implémentait le pattern de garde (`useEffect` + redirect si `!isAdmin`). `Membres.tsx`, `Documents.tsx`, `Cotisations.tsx` et `Calendrier.tsx` fetchaient et affichaient leurs données sans aucune vérification de session — en contradiction avec la doc existante qui annonçait "Auth requise" pour ces routes. Concrètement, avant correctif, un visiteur non connecté pouvait voir sur `/cotisations` qui avait payé sa cotisation, et sur `/membres` la liste complète des emails.

**Corrigé** : le même pattern de garde que `Dashboard.tsx` a été ajouté à ces quatre pages (redirect vers `/login` si non authentifié).

### 3. Le contrôle `isAdmin` côté client n'est pas une protection
Dans `Cotisations.tsx`, `toggleCotisation` vérifie `isAdmin` avant d'agir, mais sans RLS (point 1) n'importe qui avec la clé anon peut appeler `supabase.from('cotisations').upsert(...)` directement depuis la console du navigateur, en contournant totalement l'UI. La policy d'écriture ajoutée dans le correctif RLS résout ce point — la vérification client reste utile pour l'UX, mais la vraie barrière est maintenant côté base.

## Bugs

### 4. Lien "Voir les archives" mort
`Documents.tsx` génère un lien `/documents?archive=1` mais ne lit jamais ce paramètre d'URL — le filtre archive est inopérant, la page affiche toujours uniquement les documents non archivés.

**Corrigé** : lecture du paramètre `archive` via `useSearchParams` et requête filtrée en conséquence.

### 5. Code "prod" commenté mais non fonctionnel
Dans `Organigramme.tsx`, le bloc commenté censé activer les vraies données (`Promise.all([fetchBureau(), fetchMembres()])`) référençait des fonctions qui n'existaient pas dans le fichier. Décommenter tel quel comme suggéré par le commentaire aurait provoqué une erreur au build.

**Corrigé** : `fetchBureau()` et `fetchMembres()` sont maintenant de vraies fonctions qui interrogent Supabase, filtrées par `role` (bureau vs membres). Comme cette page est publique (pas d'auth), elles lisent une nouvelle vue `membres_public` (`supabase/migrations/20240103000000_membres_public_view.sql`) qui ne projette que les colonnes non sensibles (`id, prenom, nom, role, statut, date_nomination`) — sans email — plutôt que la table `membres` elle-même, qui est désormais réservée aux utilisateurs authentifiés par la policy RLS du point 1. **Cette migration doit aussi être poussée vers Supabase.**

### 6. `npm run lint` cassé
Le script appelait `eslint` mais aucune dépendance ESLint n'était déclarée dans `package.json`.

**Corrigé** : ajout d'ESLint 10 (flat config) avec `@typescript-eslint`, `eslint-plugin-react-hooks` et `eslint-plugin-react-refresh` (`eslint.config.js`). `npm run lint` passe maintenant avec seulement des warnings préexistants et inoffensifs (variables non utilisées, deps de `useEffect`) — aucune erreur bloquante.

## Dette technique / nettoyage

- ~~`src/pages/public/Organigramme-simple.tsx`~~ : **supprimé**, fichier mort jamais importé.
- **`netlify.toml`** référence `[functions] directory = "netlify/functions"` qui n'existe pas dans le repo — config sans effet, à retirer si aucune fonction Netlify n'est prévue.
- **Erreurs Supabase ignorées partout** : toutes les pages font `const { data } = await supabase...` sans jamais regarder `error` — un échec réseau ou une policy RLS qui bloque silencieusement donnera juste une liste vide à l'utilisateur, sans message d'erreur. Non corrigé (nécessite de décider d'une UX d'erreur cohérente sur toutes les pages).
- **Table `organigramme`** (poste, date_debut/fin, type_poste) toujours non utilisée : `Organigramme.tsx` continue de dériver le bureau via `membres.role`, comme le faisaient les données de test. Garder les deux modèles (rôle sur `membres` vs mandats dans `organigramme`) est une duplication à trancher si l'historique des mandats devient un besoin réel.
- **Table `parametres_notifications`** : présente en SQL, aucun type TS ni aucune UI ne l'exploite — la fonctionnalité de rappels par email est à l'état de schéma seul.
- **Aucun test automatisé** configuré (pas de Jest/Vitest/Playwright).
- Boutons "+ Ajouter un membre / document / événement" (visibles seulement si `isAdmin`) n'ont pas de handler — UI de stub sans action.

## Non couvert par cet audit

- Revue manuelle des policies RLS une fois poussées en base (le correctif fourni est une base raisonnable, pas un audit de chaque cas d'usage métier).
- Accessibilité (a11y) et performance.
- Configuration réelle du projet Supabase (buckets Storage, redirect URLs auth) — non vérifiable depuis le repo.

## À faire côté Supabase

Les trois migrations ajoutées par cet audit ne prennent effet qu'une fois poussées :
1. `20240102000000_enable_rls.sql`
2. `20240103000000_membres_public_view.sql`

`npm run supabase:push`, ou coller leur contenu dans le SQL Editor du projet Supabase.
