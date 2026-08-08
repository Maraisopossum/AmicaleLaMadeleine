# À faire — checklist de mise en production

État au 2026-08-08. Rien n'a été poussé sur GitHub ni déployé sur Netlify pour l'instant (volontaire).

## 🌐 Domaine & déploiement

- [x] Domaine Resend toujours vérifié après le passage aux nameservers Netlify — retesté (candidature → email envoyé avec succès).
- [x] `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL`, `VITE_SDIS_RECRUTEMENT_URL`, `VITE_VAPID_PUBLIC_KEY` — non sensibles, versionnées directement dans `netlify.toml` (`[build.environment]`), rien à saisir à la main.
- [x] Variables d'environnement Netlify (secrets) vérifiées présentes : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`.
- [ ] Quand prêt : `git add`, commit, puis `git push` (déclenchera le build Netlify).

## 🔐 Accès candidatures

- [x] Fix ponctuel : ta fiche membre a `acces_candidatures = true` (sans ça, ni le push ni l'email des candidatures n'atteignaient personne — bug découvert en testant).
- [ ] **Toujours aucune interface** pour désigner une 2e personne (le champ existe, rien ne le coche dans Membres.tsx). Dis-le-moi si tu veux que je construise la case à cocher.

## 🎯 Recrutement / QR code

- [ ] **QR code** vers `https://pompiers-lamadeleine.fr/recrutement` à générer une fois le domaine actif.
- [ ] Vérifier que les 5 questions du quiz et les textes de résultat te conviennent (jamais testés sur un vrai téléphone).

## 🎨 Réseaux sociaux

- [x] Vraies URLs Facebook/Instagram renseignées.
- [x] Icônes SVG recréées à la main — validées.

## 🔔 Notifications push

- [x] Déployées et testées côté Supabase (secrets VAPID, edge function, 5 triggers).
- [x] `VITE_VAPID_PUBLIC_KEY` réglée via `netlify.toml`.
- [ ] Triggers Postgres **pas dans une migration versionnée** (embarquent un secret) — procédure de reconstruction dans `supabase/functions/send-notification/README.md`.
- [ ] Personne n'a encore testé un vrai abonnement + une vraie notification reçue sur téléphone.

## 📧 Emails (Resend) — nouveau

- [x] Clé `RESEND_API_KEY` configurée, 3 fonctions déployées (`create-membre-access`, `send-notification`, `send-convocation`), migration `reunions.evenement_id` appliquée.
- [x] Testé de bout en bout (candidature → `delivered` confirmé sur Gmail), y compris après le changement de nameservers.
- [x] URL du site SDIS corrigée : `https://www.sdis59.fr/sengager/sapeurs-pompiers-volontaires/`.
- [x] **Résolu** : `sdis59.fr` recevait mal les emails car les enregistrements SPF/DKIM/DMARC n'avaient jamais été recréés dans la zone DNS Netlify après le changement de nameservers (ils n'existaient que dans l'ancienne zone Hostinger, devenue inutilisée). Une fois ajoutés dans Netlify, email reçu avec succès sur `sdis59.fr`.
- [x] Expéditeur changé de `no-reply@` vers `contact@pompiers-lamadeleine.fr` (recommandation Resend, meilleure délivrabilité) — assure-toi que cette boîte existe vraiment ou redirige vers quelqu'un qui la surveille. 3 fonctions redéployées.
- [ ] Email "nouveau vote ouvert" et "convocation AG" jamais testés en conditions réelles (évité volontairement pour ne pas spammer de vrais membres pendant les tests) — à essayer sur un vrai vote/AG quand tu seras prêt.

## 🧹 Reste ouvert depuis plus tôt

- [x] Migrations `20240119`/`20240120` (module "Partenaires" abandonné) supprimées.
- [ ] `design-system/` traîne toujours en non-suivi dans Git — jamais tranché si on le commite ou on le supprime.

- [x] Domaine `pompiers-lamadeleine.fr` fonctionnel — le blocage était un cache DNS local (résolu en testant en 5G), pas une erreur de configuration.
