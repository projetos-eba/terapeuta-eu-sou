create table if not exists public.financial_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null,
  status text not null default 'running',
  worker_id uuid not null,
  lease_expires_at timestamptz not null,
  attempts integer not null default 1,
  source_charges_reconciled integer not null default 0,
  settlements_reconciled integer not null default 0,
  transfers_reconciled integer not null default 0,
  payouts_reconciled integer not null default 0,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_reconciliation_runs_scheduled_for_key unique (scheduled_for),
  constraint financial_reconciliation_runs_status_check
    check (status in ('running', 'completed', 'failed')),
  constraint financial_reconciliation_runs_counts_check
    check (
      attempts > 0
      and source_charges_reconciled >= 0
      and settlements_reconciled >= 0
      and transfers_reconciled >= 0
      and payouts_reconciled >= 0
    )
);

create index if not exists financial_reconciliation_runs_status_idx
  on public.financial_reconciliation_runs (status, scheduled_for desc);

alter table public.financial_reconciliation_runs enable row level security;
revoke all on public.financial_reconciliation_runs from public, anon, authenticated;
grant select, insert, update, delete on public.financial_reconciliation_runs to service_role;

create or replace function public.claim_financial_reconciliation_run_v1(
  p_now timestamptz,
  p_worker_id uuid,
  p_lease_minutes integer default 45
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheduled_for timestamptz;
  v_run public.financial_reconciliation_runs%rowtype;
begin
  if p_now is null or p_worker_id is null or p_lease_minutes < 1 or p_lease_minutes > 55 then
    raise exception 'FINANCIAL_RECONCILIATION_CLAIM_INVALID';
  end if;

  v_scheduled_for := date_trunc('hour', p_now);

  insert into public.financial_reconciliation_runs (
    scheduled_for,
    worker_id,
    lease_expires_at
  ) values (
    v_scheduled_for,
    p_worker_id,
    p_now + make_interval(mins => p_lease_minutes)
  )
  on conflict (scheduled_for) do update
  set worker_id = excluded.worker_id,
      lease_expires_at = excluded.lease_expires_at,
      attempts = public.financial_reconciliation_runs.attempts + 1,
      status = 'running',
      last_error = null,
      completed_at = null,
      updated_at = now()
  where public.financial_reconciliation_runs.status = 'failed'
     or (
       public.financial_reconciliation_runs.status = 'running'
       and public.financial_reconciliation_runs.lease_expires_at <= p_now
     )
  returning * into v_run;

  if v_run.id is null then
    select * into v_run
    from public.financial_reconciliation_runs
    where scheduled_for = v_scheduled_for;

    return jsonb_build_object(
      'acquired', false,
      'runId', v_run.id,
      'status', v_run.status,
      'scheduledFor', v_run.scheduled_for
    );
  end if;

  return jsonb_build_object(
    'acquired', true,
    'runId', v_run.id,
    'status', v_run.status,
    'scheduledFor', v_run.scheduled_for
  );
end;
$$;

create or replace function public.finalize_financial_reconciliation_run_v1(
  p_run_id uuid,
  p_worker_id uuid,
  p_status text,
  p_source_charges_reconciled integer default 0,
  p_settlements_reconciled integer default 0,
  p_transfers_reconciled integer default 0,
  p_payouts_reconciled integer default 0,
  p_last_error text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_run_id is null or p_worker_id is null or p_status not in ('completed', 'failed') then
    raise exception 'FINANCIAL_RECONCILIATION_FINALIZE_INVALID';
  end if;

  update public.financial_reconciliation_runs
  set status = p_status,
      source_charges_reconciled = greatest(coalesce(p_source_charges_reconciled, 0), 0),
      settlements_reconciled = greatest(coalesce(p_settlements_reconciled, 0), 0),
      transfers_reconciled = greatest(coalesce(p_transfers_reconciled, 0), 0),
      payouts_reconciled = greatest(coalesce(p_payouts_reconciled, 0), 0),
      last_error = nullif(left(coalesce(p_last_error, ''), 1000), ''),
      completed_at = now(),
      lease_expires_at = now(),
      updated_at = now()
  where id = p_run_id
    and worker_id = p_worker_id
    and status = 'running';

  if not found then
    raise exception 'FINANCIAL_RECONCILIATION_RUN_CLAIM_LOST';
  end if;
end;
$$;

revoke all on function public.claim_financial_reconciliation_run_v1(timestamptz, uuid, integer)
from public, anon, authenticated;
revoke all on function public.finalize_financial_reconciliation_run_v1(uuid, uuid, text, integer, integer, integer, integer, text)
from public, anon, authenticated;
grant execute on function public.claim_financial_reconciliation_run_v1(timestamptz, uuid, integer)
to service_role;
grant execute on function public.finalize_financial_reconciliation_run_v1(uuid, uuid, text, integer, integer, integer, integer, text)
to service_role;

comment on table public.financial_reconciliation_runs is
  'Auditable hourly Stripe reconciliation runs. A unique hourly lease prevents overlapping scheduled executions.';
