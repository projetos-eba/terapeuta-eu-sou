begin;

alter table public.payout_scheduler_runs
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_failed_at timestamptz,
  add column if not exists last_succeeded_at timestamptz,
  add column if not exists last_request_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.payout_scheduler_runs'::regclass
      and conname = 'payout_scheduler_runs_consecutive_failures_check'
  ) then
    alter table public.payout_scheduler_runs
      add constraint payout_scheduler_runs_consecutive_failures_check
      check (consecutive_failures between 0 and 4);
  end if;
end;
$$;

create index if not exists payout_scheduler_runs_retry_idx
  on public.payout_scheduler_runs (next_retry_at, business_date)
  where status = 'running';

comment on column public.payout_scheduler_runs.consecutive_failures is
  'Consecutive worker failures for the same immutable weekly run and batch. Reset only after acknowledged progress or an explicit service-role resume.';
comment on column public.payout_scheduler_runs.next_retry_at is
  'Earliest instant at which the scheduler may reacquire this run after a worker failure.';
comment on column public.payout_scheduler_runs.last_request_id is
  'Internal correlation identifier only. It must never be exposed as financial authority.';

create or replace function public.claim_payout_transfer_items_v1(
  p_payout_batch_id uuid,
  p_worker_id uuid,
  p_limit integer default 10,
  p_lease_minutes integer default 5,
  p_environment text default 'test'
)
returns table (
  transfer_id uuid,
  payout_batch_item_id uuid,
  session_payment_id uuid,
  booking_id uuid,
  therapist_profile_id uuid,
  connect_account_id uuid,
  stripe_account_id text,
  stripe_charge_id text,
  amount_cents integer,
  idempotency_key text,
  request_fingerprint text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_payout_batch_id is null or p_worker_id is null
    or p_limit < 1 or p_limit > 50
    or p_lease_minutes < 1 or p_lease_minutes > 30
    or p_environment not in ('test', 'live')
  then
    raise exception 'PAYOUT_TRANSFER_CLAIM_INVALID';
  end if;

  return query
  with candidates as (
    select item.id
    from public.payout_batch_items item
    left join public.stripe_transfers transfer
      on transfer.payout_batch_item_id = item.id
    where item.payout_batch_id = p_payout_batch_id
      and item.status in ('reserved', 'failed')
      and (
        transfer.id is null
        or (
          transfer.status in ('failed', 'reconciliation_required')
          and transfer.next_retry_at <= now()
          and transfer.attempt_count < 4
          and (transfer.lease_expires_at is null or transfer.lease_expires_at <= now())
        )
      )
    order by item.created_at, item.id
    limit p_limit
    for update of item skip locked
  ), claimed_items as (
    update public.payout_batch_items item
    set status = 'transfer_pending',
        failure_code = null,
        failure_message = null,
        updated_at = now()
    from candidates
    where item.id = candidates.id
    returning item.*
  ), prepared as (
    insert into public.stripe_transfers (
      payout_batch_item_id, session_payment_id, therapist_profile_id,
      connect_account_id, idempotency_key, amount_cents, currency,
      status, stripe_source_charge_id, attempt_count, lease_owner,
      lease_expires_at, request_fingerprint, last_attempt_at
    )
    select
      item.id, item.session_payment_id, item.therapist_profile_id,
      account.id,
      'tes:' || p_environment || ':transfer:' || item.id::text || ':v1',
      item.amount_cents, 'BRL', 'pending', payment.stripe_charge_id, 1,
      p_worker_id, now() + make_interval(mins => p_lease_minutes),
      pg_catalog.encode(extensions.digest(
        pg_catalog.concat_ws('|', p_environment, item.id::text, item.amount_cents::text, 'BRL',
          account.stripe_account_id, payment.stripe_charge_id),
        'sha256'
      ), 'hex'),
      now()
    from claimed_items item
    join public.payout_batch_therapists therapist_group
      on therapist_group.id = item.payout_batch_therapist_id
      and therapist_group.payout_batch_id = item.payout_batch_id
      and therapist_group.therapist_profile_id = item.therapist_profile_id
    join public.session_payments payment
      on payment.id = item.session_payment_id
      and payment.booking_id = item.booking_id
      and payment.therapist_profile_id = item.therapist_profile_id
    join public.therapist_connect_accounts account
      on account.id = therapist_group.connect_account_id
      and account.therapist_profile_id = item.therapist_profile_id
    on conflict on constraint stripe_transfers_payout_batch_item_id_key do update
    set status = 'pending',
        attempt_count = public.stripe_transfers.attempt_count + 1,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        last_attempt_at = now(),
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where public.stripe_transfers.attempt_count < 4
      and public.stripe_transfers.status in ('failed', 'reconciliation_required')
      and public.stripe_transfers.request_fingerprint = excluded.request_fingerprint
    returning public.stripe_transfers.*
  )
  select
    transfer.id, item.id, item.session_payment_id, item.booking_id,
    item.therapist_profile_id, account.id, account.stripe_account_id,
    payment.stripe_charge_id, item.amount_cents, transfer.idempotency_key,
    transfer.request_fingerprint, transfer.attempt_count
  from prepared transfer
  join public.payout_batch_items item on item.id = transfer.payout_batch_item_id
  join public.session_payments payment on payment.id = item.session_payment_id
  join public.therapist_connect_accounts account on account.id = transfer.connect_account_id;

  update public.session_payments payment
  set transfer_status = 'transfer_pending', updated_at = now()
  where exists (
    select 1 from public.payout_batch_items item
    join public.stripe_transfers transfer on transfer.payout_batch_item_id = item.id
    where item.session_payment_id = payment.id
      and transfer.lease_owner = p_worker_id
      and transfer.status = 'pending'
  );

  update public.payout_batches
  set status = 'processing', updated_at = now()
  where id = p_payout_batch_id and status in ('open', 'partially_failed');
end;
$$;

comment on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text) is
  'Claims each item against the immutable Connect account frozen in its payout batch therapist group. Historical accounts are preserved and never replaced during a retry.';

create or replace function public.claim_weekly_payout_scheduler_run_v1(
  p_now timestamptz,
  p_worker_id uuid,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp;
  v_business_date date;
  v_cutoff_at timestamptz;
  v_window_open boolean;
  v_run public.payout_scheduler_runs%rowtype;
  v_batch_id uuid;
begin
  if p_now is null or p_worker_id is null or p_lease_minutes < 1 or p_lease_minutes > 30 then
    raise exception 'PAYOUT_SCHEDULER_CLAIM_INVALID';
  end if;

  v_local := p_now at time zone 'America/Sao_Paulo';
  v_business_date := v_local::date;
  v_window_open := extract(dow from v_local)::integer = 2
    and v_local::time >= time '02:00'
    and v_local::time < time '04:00';

  select * into v_run
  from public.payout_scheduler_runs
  where status = 'running'
  order by business_date asc
  limit 1
  for update skip locked;

  if v_run.id is not null and v_run.next_retry_at is not null and v_run.next_retry_at > p_now then
    return jsonb_build_object(
      'acquired', false,
      'reason', 'backoff_active',
      'runId', v_run.id,
      'batchId', v_run.payout_batch_id,
      'retryAt', v_run.next_retry_at
    );
  end if;

  if v_run.id is not null
    and v_run.worker_id is distinct from p_worker_id
    and v_run.lease_expires_at is not null
    and v_run.lease_expires_at > p_now
  then
    return jsonb_build_object('acquired', false, 'reason', 'already_claimed');
  end if;

  if v_run.id is null and not v_window_open then
    return jsonb_build_object('acquired', false, 'reason', 'outside_start_window');
  end if;

  if v_run.id is null then
    v_cutoff_at := make_timestamptz(
      extract(year from v_business_date)::integer,
      extract(month from v_business_date)::integer,
      extract(day from v_business_date)::integer,
      2, 0, 0, 'America/Sao_Paulo'
    );
    perform pg_advisory_xact_lock(hashtextextended('tes-weekly-payout:' || v_business_date::text, 0));

    insert into public.payout_scheduler_runs (
      business_date, reference_period_start, reference_period_end,
      cutoff_at, status, worker_id, lease_expires_at, attempts
    ) values (
      v_business_date, v_business_date - 7, v_business_date - 1,
      v_cutoff_at, 'running', p_worker_id,
      p_now + make_interval(mins => p_lease_minutes), 1
    )
    on conflict (business_date) do update
    set worker_id = excluded.worker_id,
        lease_expires_at = excluded.lease_expires_at,
        attempts = public.payout_scheduler_runs.attempts + 1,
        updated_at = now()
    where public.payout_scheduler_runs.status = 'running'
      and (public.payout_scheduler_runs.next_retry_at is null or public.payout_scheduler_runs.next_retry_at <= p_now)
      and (
        public.payout_scheduler_runs.lease_expires_at is null
        or public.payout_scheduler_runs.lease_expires_at <= p_now
        or public.payout_scheduler_runs.worker_id = p_worker_id
      )
    returning * into v_run;

    if v_run.id is null then
      return jsonb_build_object('acquired', false, 'reason', 'already_claimed');
    end if;
  else
    update public.payout_scheduler_runs
    set worker_id = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        attempts = attempts + 1,
        updated_at = now()
    where id = v_run.id
    returning * into v_run;
  end if;

  if v_run.payout_batch_id is null then
    v_batch_id := public.create_weekly_payout_batch_v2(
      v_run.reference_period_start,
      v_run.reference_period_end,
      v_run.cutoff_at,
      null
    );
    if v_batch_id is not null then
      update public.payout_scheduler_runs
      set payout_batch_id = v_batch_id, updated_at = now()
      where id = v_run.id
      returning * into v_run;
    end if;
  end if;

  return jsonb_build_object(
    'acquired', true,
    'runId', v_run.id,
    'batchId', v_run.payout_batch_id,
    'businessDate', v_run.business_date,
    'cutoffAt', v_run.cutoff_at,
    'windowOpen', v_window_open,
    'reason', case when v_run.payout_batch_id is null then 'no_eligible_payments' else null end
  );
end;
$$;

create or replace function public.record_payout_scheduler_failure_v1(
  p_run_id uuid,
  p_worker_id uuid,
  p_error_code text,
  p_error_message text,
  p_request_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payout_scheduler_runs%rowtype;
  v_failure_count integer;
  v_retry_at timestamptz;
  v_code text;
  v_message text;
  v_circuit_open boolean;
begin
  if p_run_id is null or p_worker_id is null or p_request_id is null or p_now is null then
    raise exception 'PAYOUT_SCHEDULER_FAILURE_INVALID';
  end if;

  select * into v_run
  from public.payout_scheduler_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FOUND'; end if;
  if v_run.status <> 'running' or v_run.worker_id is distinct from p_worker_id then
    raise exception 'PAYOUT_SCHEDULER_LEASE_LOST';
  end if;

  v_failure_count := least(v_run.consecutive_failures + 1, 4);
  v_code := left(nullif(regexp_replace(coalesce(p_error_code, ''), '[\r\n]+', ' ', 'g'), ''), 120);
  v_message := left(nullif(regexp_replace(coalesce(p_error_message, ''), '[\r\n]+', ' ', 'g'), ''), 500);
  v_circuit_open := v_failure_count >= 4;
  v_retry_at := case v_failure_count
    when 1 then p_now + interval '15 minutes'
    when 2 then p_now + interval '30 minutes'
    when 3 then p_now + interval '60 minutes'
    else null
  end;

  update public.payout_scheduler_runs
  set consecutive_failures = v_failure_count,
      next_retry_at = v_retry_at,
      last_failed_at = p_now,
      last_error_code = coalesce(v_code, 'worker_failure'),
      last_error_message = coalesce(v_message, 'Worker execution failed.'),
      last_request_id = p_request_id,
      status = case when v_circuit_open then 'failed'::public.payout_scheduler_run_status else status end,
      completed_at = case when v_circuit_open then coalesce(completed_at, p_now) else completed_at end,
      worker_id = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_run.id;

  if v_circuit_open then
    perform public.record_payout_operational_incident_v1(
      'scheduler:' || v_run.id::text || ':worker-circuit-open',
      'weekly_payout_scheduler_failed',
      'critical',
      coalesce(v_code, 'worker_failure'),
      coalesce(v_message, 'Worker execution failed.'),
      v_run.id,
      v_run.payout_batch_id,
      null, null, null, null,
      jsonb_build_object(
        'consecutiveFailures', v_failure_count,
        'requestId', p_request_id
      )
    );
  end if;

  return jsonb_build_object(
    'recorded', true,
    'runId', v_run.id,
    'consecutiveFailures', v_failure_count,
    'retryAt', v_retry_at,
    'circuitOpen', v_circuit_open
  );
end;
$$;

create or replace function public.record_payout_scheduler_progress_v1(
  p_run_id uuid,
  p_worker_id uuid,
  p_request_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payout_scheduler_runs%rowtype;
begin
  if p_run_id is null or p_worker_id is null or p_request_id is null or p_now is null then
    raise exception 'PAYOUT_SCHEDULER_PROGRESS_INVALID';
  end if;

  select * into v_run
  from public.payout_scheduler_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FOUND'; end if;
  if v_run.status <> 'running' or v_run.worker_id is distinct from p_worker_id then
    raise exception 'PAYOUT_SCHEDULER_LEASE_LOST';
  end if;

  update public.payout_scheduler_runs
  set consecutive_failures = 0,
      next_retry_at = null,
      last_succeeded_at = p_now,
      last_error_code = null,
      last_error_message = null,
      last_request_id = p_request_id,
      updated_at = now()
  where id = v_run.id;

  update public.payout_operational_incidents
  set status = 'resolved',
      resolved_at = coalesce(resolved_at, p_now),
      updated_at = now()
  where incident_key = 'scheduler:' || v_run.id::text || ':worker-circuit-open'
    and status = 'open';

  return jsonb_build_object('recorded', true, 'runId', v_run.id);
end;
$$;

create or replace function public.resume_failed_payout_scheduler_run_v1(
  p_run_id uuid,
  p_expected_batch_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payout_scheduler_runs%rowtype;
begin
  if p_run_id is null or p_expected_batch_id is null or p_now is null then
    raise exception 'PAYOUT_SCHEDULER_RESUME_INVALID';
  end if;

  select * into v_run
  from public.payout_scheduler_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FOUND'; end if;
  if v_run.status <> 'failed' then raise exception 'PAYOUT_SCHEDULER_RUN_NOT_FAILED'; end if;
  if v_run.payout_batch_id is distinct from p_expected_batch_id then
    raise exception 'PAYOUT_SCHEDULER_BATCH_MISMATCH';
  end if;
  if v_run.worker_id is not null or (v_run.lease_expires_at is not null and v_run.lease_expires_at > p_now) then
    raise exception 'PAYOUT_SCHEDULER_LEASE_ACTIVE';
  end if;

  update public.payout_scheduler_runs
  set status = 'running',
      consecutive_failures = 0,
      next_retry_at = null,
      last_error_code = null,
      last_error_message = null,
      completed_at = null,
      worker_id = null,
      lease_expires_at = null,
      updated_at = now()
  where id = v_run.id;

  update public.payout_operational_incidents
  set status = 'resolved',
      resolved_at = coalesce(resolved_at, p_now),
      updated_at = now()
  where incident_key = 'scheduler:' || v_run.id::text || ':worker-circuit-open'
    and status = 'open';

  return jsonb_build_object(
    'resumed', true,
    'runId', v_run.id,
    'batchId', v_run.payout_batch_id
  );
end;
$$;

create or replace function public.set_weekly_payout_scheduler_active_v1(
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  if p_active is null then raise exception 'PAYOUT_SCHEDULER_ACTIVE_INVALID'; end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'tes-weekly-payout-scheduler-v2'
  order by jobid desc
  limit 1;

  if v_job_id is null then raise exception 'PAYOUT_SCHEDULER_JOB_NOT_FOUND'; end if;

  perform cron.alter_job(v_job_id, active := p_active);
  return jsonb_build_object('updated', true, 'active', p_active);
end;
$$;

revoke all on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
from public, anon, authenticated;
revoke all on function public.claim_weekly_payout_scheduler_run_v1(timestamptz, uuid, integer)
from public, anon, authenticated;
revoke all on function public.record_payout_scheduler_failure_v1(uuid, uuid, text, text, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.record_payout_scheduler_progress_v1(uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.resume_failed_payout_scheduler_run_v1(uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.set_weekly_payout_scheduler_active_v1(boolean)
from public, anon, authenticated;

grant execute on function public.claim_payout_transfer_items_v1(uuid, uuid, integer, integer, text)
to service_role;
grant execute on function public.claim_weekly_payout_scheduler_run_v1(timestamptz, uuid, integer)
to service_role;
grant execute on function public.record_payout_scheduler_failure_v1(uuid, uuid, text, text, uuid, timestamptz)
to service_role;
grant execute on function public.record_payout_scheduler_progress_v1(uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.resume_failed_payout_scheduler_run_v1(uuid, uuid, timestamptz)
to service_role;
grant execute on function public.set_weekly_payout_scheduler_active_v1(boolean)
to service_role;

commit;
