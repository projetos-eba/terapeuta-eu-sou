-- Versioned activation script. DO NOT run as part of migrations or local reset.
-- Preconditions: PAYMENTS_INTERNAL_OPERATIONS_TOKEN in Vault, deployed Edge
-- Function, complete Connect webhook coverage, eligible administrators and
-- every connected account validated with enabled automatic daily payouts.
--
-- Replace the Vault secret names only through the approved environment runbook.
select cron.unschedule(jobid)
from cron.job
where jobname = 'tes-weekly-payout-scheduler-v1';

select cron.schedule(
  'tes-weekly-payout-scheduler-v2',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/weekly-payout-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tes-internal-operations-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'payments_internal_operations_token'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
