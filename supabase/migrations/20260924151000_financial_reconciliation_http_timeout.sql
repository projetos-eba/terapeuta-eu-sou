-- The Edge Function can legitimately reconcile multiple Stripe objects for
-- longer than pg_net's short default timeout. Extending the HTTP wait changes
-- only the scheduler observation window; it does not retry, create or mutate a
-- financial object. Local reset remains inert because it does not create jobs.
do $migration$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'tes-financial-reconciliation-hourly-v1';

  if v_job_id is not null then
    perform cron.alter_job(
      v_job_id,
      command => $cron$
        select net.http_post(
          url := (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'SUPABASE_FUNCTIONS_BASE_URL'
          ) || '/reconcile-stripe-transfers',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-tes-internal-operations-token', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
            )
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        );
      $cron$
    );
  end if;
end
$migration$;
