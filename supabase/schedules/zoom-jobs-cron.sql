-- Template de ativacao remota. Nao executar sem revisar URL, Vault e ambiente.
-- Requer extensoes oficiais Supabase: pg_cron, pg_net e Vault.
-- Secret esperado no Vault: zoom_jobs_process_internal_token

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.unschedule('tes_zoom_jobs_process_every_minute')
where exists (
  select 1
  from cron.job
  where jobname = 'tes_zoom_jobs_process_every_minute'
);

select cron.schedule(
  'tes_zoom_jobs_process_every_minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/zoom-jobs-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tes-internal-operations-token',
      vault.decrypted_secret('zoom_jobs_process_internal_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
