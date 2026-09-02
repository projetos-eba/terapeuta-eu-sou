-- Run only after the function and Vault prerequisites are deployed.
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
    raise exception 'RESERVATION_CHECKOUT_MAINTENANCE_VAULT_PRECONDITION_FAILED';
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reservation-checkout-maintenance-every-minute';

select cron.schedule(
  'reservation-checkout-maintenance-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'SUPABASE_FUNCTIONS_BASE_URL'
    ) || '/reservation-checkout-maintenance',
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
