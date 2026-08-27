-- Versioned activation script. DO NOT run as part of migrations or local reset.
-- Preconditions: PAYMENTS_INTERNAL_OPERATIONS_TOKEN in Vault, deployed Edge
-- Function, complete Connect webhook coverage, eligible administrators and
-- every connected account validated with enabled automatic daily payouts.
--
-- Replace the Vault secret names only through the approved environment runbook.
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
    raise exception 'WEEKLY_PAYOUT_VAULT_PRECONDITION_FAILED';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'tes-weekly-payout-scheduler-v1',
  'tes-weekly-payout-scheduler-v2'
);

select cron.schedule(
  'tes-weekly-payout-scheduler-v2',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_FUNCTIONS_BASE_URL')
      || '/weekly-payout-scheduler',
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
