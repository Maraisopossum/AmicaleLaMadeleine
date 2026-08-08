-- pg_net : requêtes HTTP asynchrones depuis Postgres, utilisé par les
-- triggers de notification push (candidatures/reunions/idees/votes/documents
-- → edge function send-notification). Les triggers eux-mêmes ne sont PAS
-- définis ici : ils embarquent un header d'authentification qui ne doit
-- jamais être commité en clair (cf. supabase/functions/send-notification/README.md).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
