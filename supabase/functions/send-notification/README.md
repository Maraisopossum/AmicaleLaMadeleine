# Notifications push — état du déploiement

✅ Déployé et opérationnel sur le projet Supabase "Amicale" (`hdlclzjhxvzgajbdqbts`) :

- Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEBHOOK_SECRET` configurés
  (`supabase secrets set`).
- Fonction `send-notification` déployée (`supabase functions deploy`).
- Extension `pg_net` activée (migration `20260808000002_enable_pg_net.sql`,
  versionnée — aucun secret dedans).
- 5 triggers Postgres (`send_notification_candidatures/reunions/idees/votes/documents`)
  créés en base, chacun appelant `net.http_post()` vers cette fonction avec
  un header `x-webhook-secret` que la fonction vérifie avant de traiter quoi
  que ce soit.

## Pourquoi les triggers ne sont pas dans une migration versionnée

Le corps du trigger embarque le `WEBHOOK_SECRET` en clair dans le header
HTTP envoyé à la fonction — le committer dans `supabase/migrations/`
l'exposerait dans l'historique Git. Il a été créé une seule fois via
`supabase db query --linked --file <script>`, script conservé **hors du
dépôt** (scratchpad de la session qui l'a mis en place).

## Recréer les triggers (si jamais perdus, ex: nouveau projet Supabase ou reset)

1. Récupérer/regénérer un `WEBHOOK_SECRET` (`openssl rand -hex 32` ou
   équivalent) et le (re)poser avec `supabase secrets set WEBHOOK_SECRET=...`.
2. Écrire un script SQL (voir modèle ci-dessous), l'exécuter avec
   `supabase db query --linked --file mon-script.sql`, puis **le supprimer**
   ou le garder strictement hors du dépôt Git.

```sql
create or replace function public.trigger_send_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-notification',
    body := jsonb_build_object(
      'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <clé anon — publique, sans risque>',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$;

create trigger send_notification_candidatures after insert on public.candidatures
  for each row execute function public.trigger_send_notification();
create trigger send_notification_reunions after update on public.reunions
  for each row execute function public.trigger_send_notification();
create trigger send_notification_idees after insert on public.idees
  for each row execute function public.trigger_send_notification();
create trigger send_notification_votes after update on public.votes
  for each row execute function public.trigger_send_notification();
create trigger send_notification_documents after insert on public.documents
  for each row execute function public.trigger_send_notification();
```

## Vérifier que ça tourne

```sql
-- Historique des envois (asynchrone via pg_net) :
select status_code, content::text, created from net._http_response order by id desc limit 5;
```

## Reste à faire côté client

- `VITE_VAPID_PUBLIC_KEY` doit être renseignée dans `.env` (déjà fait en
  local) **et** dans les variables de build Netlify avant le prochain
  déploiement, sinon le bouton "Activer les notifications" dans Mon compte
  restera inopérant en production.
