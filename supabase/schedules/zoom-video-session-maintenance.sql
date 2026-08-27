-- Idempotent activation script for staging/production. The required Vault
-- values must be configured and validated before this script is executed.
--
-- Requer extensoes pg_cron, pg_net e supabase_vault habilitadas.

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'SUPABASE_FUNCTIONS_BASE_URL'
      and nullif(trim(decrypted_secret), '') is not null
  ) or not exists (
    select 1 from vault.decrypted_secrets
    where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      and nullif(trim(decrypted_secret), '') is not null
  ) then
    raise exception 'ZOOM_MAINTENANCE_VAULT_PRECONDITION_FAILED';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'zoom-video-session-maintenance-every-minute';

select cron.schedule(
  'zoom-video-session-maintenance-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'SUPABASE_FUNCTIONS_BASE_URL'
    ) || '/zoom-video-session-maintenance?limit=10',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-tes-internal-operations-token',
      (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      )
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
