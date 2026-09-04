-- Versioned activation script. DO NOT run as part of migrations or local reset.
-- Runs at minute 17, after the session confirmation job at :07 and away from
-- the weekly scheduler ticks (:00/:15/:30/:45).
-- The weekly scheduler still performs its own final reconciliation and each
-- Transfer revalidates the source Balance Transaction immediately before creation.
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
    raise exception 'FINANCIAL_RECONCILIATION_VAULT_PRECONDITION_FAILED';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'tes-financial-reconciliation-hourly-v1';

select cron.schedule(
  'tes-financial-reconciliation-hourly-v1',
  '17 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_FUNCTIONS_BASE_URL')
      || '/reconcile-stripe-transfers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tes-internal-operations-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
