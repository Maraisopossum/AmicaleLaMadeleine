# Amicale des Sapeurs-Pompiers de La Madeleine

Outil de gestion en ligne pour l'amicale - organigramme, statuts, cotisations, calendrier.

## Setup

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

## Configuration

1. Copier `.env.example` vers `.env`
2. Ajouter vos clés Supabase :
   - `VITE_SUPABASE_URL` - URL de votre projet Supabase
   - `VITE_SUPABASE_ANON_KEY` - Clé publique anon

## Déploiement Netlify

1. Build command : `npm run build`
2. Publish directory : `dist`
3. Variables d'environnement dans les settings Netlify

## Structure

```
src/
├── components/    # Composants réutilisables
├── pages/
│   ├── auth/     # Login
│   ├── dashboard/ # Tableau de bord bureau
│   ├── members/  # Gestion membres
│   ├── documents/ # Statuts, règlements
│   └── cotisations/ # Suivi cotisations
├── contexts/      # Auth context
└── lib/          # Supabase client
```

## Configuration Supabase

1. Créer un projet sur https://supabase.com
2. Aller dans SQL Editor → coller la migration `supabase/migrations/20240101000000_initial_schema.sql`
3. Activer l'authentification par email dans Authentication → Settings
4. Dans Authentication → Policies : vérifier les politiques RLS

## Configuration Netlify

1. Connecter le repo Git à Netlify
2. Build command : `npm run build`
3. Publish directory : `dist`
4. Ajouter les variables d'environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Fonctionnalités MVP

1. **Organigramme** - Page publique du bureau (date nomination)
2. **Membres** - Tableau actifs/passifs/honoraires (avec filtres)
3. **Documents** - Hébergement PDF + catégories + archives
4. **Cotisations** - Suivi annuel payé/non-payé
5. **Calendrier** - Événements avec export ICS + Google Calendar