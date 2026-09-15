-- V10 activation script. Run only after the V10 policy, Functions, webhook
-- destinations and internal operations secret have been verified in the target.
-- This file is intentionally not a migration and is never executed by reset.
--
-- The two workers are independent:
--   1. process-session-charges claims due T-24 schedules;
--   2. process-session-transfers claims the durable post-payment outbox.
--
-- V9 jobs are not unscheduled here. They must remain available while any V9
-- obligation is open, as required by the V9/V10 coexistence contract.

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'SUPABASE_FUNCTIONS_BASE_URL'
      and nullif(trim(decrypted_secret), '') is not null
  ) or not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      and nullif(trim(decrypted_secret), '') is not null
  ) then
    raise exception 'SESSION_FINANCIAL_FLOW_V10_VAULT_PRECONDITION_FAILED';
  end if;

  if not exists (
    select 1
    from public.financial_policy_versions
    where policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
      and is_active
  ) then
    raise exception 'SESSION_FINANCIAL_FLOW_V10_POLICY_NOT_ACTIVE';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'tes-session-financial-v10-charge-v1',
  'tes-session-financial-v10-transfer-v1'
);

select cron.schedule(
  'tes-session-financial-v10-charge-v1',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'SUPABASE_FUNCTIONS_BASE_URL'
    ) || '/process-session-charges',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-tes-internal-operations-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      )
    ),
    body := jsonb_build_object('source', 'pg_cron', 'limit', 10)
  );
  $cron$
);

select cron.schedule(
  'tes-session-financial-v10-transfer-v1',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'SUPABASE_FUNCTIONS_BASE_URL'
    ) || '/process-session-transfers',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-tes-internal-operations-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'PAYMENTS_INTERNAL_OPERATIONS_TOKEN'
      )
    ),
    body := jsonb_build_object('source', 'pg_cron', 'limit', 10)
  );
  $cron$
);
