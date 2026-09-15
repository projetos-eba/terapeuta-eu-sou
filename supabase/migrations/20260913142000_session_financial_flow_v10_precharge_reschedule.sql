-- V10 phase 5: an untouched off-session charge follows an approved patient
-- reschedule without replacing the reservation-specific SetupIntent binding.
-- Any claimed or externally-created PaymentIntent remains a support operation.

alter table public.session_payment_schedules
  add column expected_booking_version bigint;

update public.session_payment_schedules schedule
set expected_booking_version = schedule.booking_version + 1
where expected_booking_version is null;

alter table public.session_payment_schedules
  alter column expected_booking_version set not null,
  add constraint session_payment_schedules_expected_booking_version_positive
    check (expected_booking_version > 0);

comment on column public.session_payment_schedules.expected_booking_version is
  'Booking version that must still be current when this immutable charge schedule is claimed or reconciled.';

create or replace function public.default_session_payment_schedule_booking_version_v10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_version bigint;
begin
  if new.expected_booking_version is not null then
    return new;
  end if;

  select booking.version
  into v_booking_version
  from public.bookings as booking
  where booking.id = new.booking_id;

  if not found then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_BOOKING_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- Initial checkout inserts the schedule before confirming the booking. That
  -- confirmation is the next and only expected operational transition.
  new.expected_booking_version := v_booking_version + 1;
  return new;
end;
$$;

drop trigger if exists a05_default_session_payment_schedule_booking_version
  on public.session_payment_schedules;
create trigger a05_default_session_payment_schedule_booking_version
before insert on public.session_payment_schedules
for each row execute function public.default_session_payment_schedule_booking_version_v10();

revoke all on function public.default_session_payment_schedule_booking_version_v10()
from public, anon, authenticated;

create or replace function public.enforce_session_payment_schedule_state_v10()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.booking_version is distinct from old.booking_version
    or new.expected_booking_version is distinct from old.expected_booking_version
    or new.session_payment_id is distinct from old.session_payment_id
    or new.session_payment_setup_id is distinct from old.session_payment_setup_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.due_at is distinct from old.due_at
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_BINDING_IMMUTABLE' using errcode = '23514';
  end if;
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'scheduled' and new.status in ('claimed', 'paid', 'canceled', 'superseded'))
    or (old.status = 'claimed' and new.status in ('processing', 'paid', 'requires_customer_action', 'retry_scheduled', 'failed', 'canceled', 'superseded'))
    or (old.status = 'processing' and new.status in ('paid', 'requires_customer_action', 'retry_scheduled', 'failed', 'canceled', 'superseded'))
    or (old.status = 'requires_customer_action' and new.status in ('claimed', 'processing', 'paid', 'failed', 'canceled', 'superseded'))
    or (old.status = 'retry_scheduled' and new.status in ('claimed', 'paid', 'canceled', 'superseded'))
    or (old.status = 'failed' and new.status in ('paid', 'canceled'))
  ) then
    raise exception 'SESSION_PAYMENT_SCHEDULE_V10_TRANSITION_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- The following fail-closed rewrite changes only the six stale-version guards
-- introduced by the preceding, versioned migrations. A fresh or drifted schema
-- aborts unless every expected fragment occurs exactly once.
do $migration$
declare
  v_definition text;
  v_hit_count integer;
  v_new_fragments text[] := array[
    'b.version = s.expected_booking_version',
    'v_booking.version <> v_schedule.expected_booking_version',
    'v_booking.version = v_schedule.expected_booking_version',
    'v_booking.version <> v_schedule.expected_booking_version',
    'v_booking.version <> v_schedule.expected_booking_version',
    'v_booking.version <> v_schedule.expected_booking_version'
  ];
  v_old_fragments text[] := array[
    'b.version = s.booking_version + 1',
    'v_booking.version <> v_schedule.booking_version + 1',
    'v_booking.version = v_schedule.booking_version + 1',
    'v_booking.version <> v_schedule.booking_version + 1',
    'v_booking.version <> v_schedule.booking_version + 1',
    'v_booking.version <> v_schedule.booking_version + 1'
  ];
  v_signatures text[] := array[
    'public.claim_due_session_payment_schedules_v10(timestamptz,uuid,integer,integer)',
    'public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz)',
    'public.get_patient_session_charge_status_v10(uuid)',
    'public.begin_session_charge_recovery_v10(uuid,uuid,uuid,text)',
    'public.close_unpaid_session_payment_v10(uuid,uuid,text,timestamptz)',
    'public.cancel_uncharged_session_v10(uuid,uuid,text,text)'
  ];
  v_signature text;
  v_index integer;
  v_procedure regprocedure;
begin
  for v_index in 1..array_length(v_signatures, 1) loop
    v_signature := v_signatures[v_index];
    v_procedure := pg_catalog.to_regprocedure(v_signature);
    if v_procedure is null then
      raise exception 'SESSION_PAYMENT_V10_RESCHEDULE_SCHEMA_DRIFT: %', v_signature
        using errcode = 'P0001';
    end if;

    select pg_catalog.pg_get_functiondef(v_procedure::oid)
    into v_definition;
    v_hit_count := (
      length(v_definition)
      - length(replace(v_definition, v_old_fragments[v_index], ''))
    ) / length(v_old_fragments[v_index]);

    if v_hit_count <> 1
      or position(v_new_fragments[v_index] in v_definition) > 0
    then
      raise exception 'SESSION_PAYMENT_V10_RESCHEDULE_SCHEMA_DRIFT: %', v_signature
        using errcode = 'P0001';
    end if;

    execute replace(
      v_definition,
      v_old_fragments[v_index],
      v_new_fragments[v_index]
    );
  end loop;
end;
$migration$;

create or replace function public.enforce_session_payment_v10_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy_key text;
  v_account public.therapist_connect_accounts%rowtype;
  v_amounts_changed boolean;
  v_due_at_reschedule boolean;
begin
  v_amounts_changed := tg_op = 'UPDATE' and (
    new.platform_commission_bps is distinct from old.platform_commission_bps
    or new.platform_gross_commission_cents is distinct from old.platform_gross_commission_cents
    or new.therapist_amount_cents is distinct from old.therapist_amount_cents
    or new.gross_amount_cents is distinct from old.gross_amount_cents
  );

  v_due_at_reschedule := tg_op = 'UPDATE'
    and new.payment_due_at is distinct from old.payment_due_at
    and pg_catalog.current_setting('tes.v10_reschedule_payment_id', true) = old.id::text
    and old.payment_flow_version = 'v10'
    and new.payment_flow_version = 'v10'
    and old.financial_status = 'pending'
    and new.financial_status = 'pending'
    and old.stripe_payment_intent_id is null
    and new.stripe_payment_intent_id is null
    and old.stripe_charge_id is null
    and new.stripe_charge_id is null
    and not exists (
      select 1 from public.session_payment_schedules schedule
      where schedule.session_payment_id = old.id
        and schedule.status not in ('paid', 'failed', 'canceled', 'superseded')
    )
    and not exists (
      select 1 from public.session_transfer_jobs job
      where job.session_payment_id = old.id
    )
    and not exists (
      select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = old.id
    )
    and new.payment_due_at = (
      select booking.starts_at - interval '24 hours'
      from public.bookings booking where booking.id = old.booking_id
    );

  if tg_op = 'UPDATE'
    and (old.payment_flow_version = 'v10' or new.payment_flow_version = 'v10')
  then
    if new.payment_flow_version is distinct from old.payment_flow_version
      or new.policy_version_id is distinct from old.policy_version_id
      or new.connect_account_id_snapshot is distinct from old.connect_account_id_snapshot
      or new.stripe_connect_account_id_snapshot is distinct from old.stripe_connect_account_id_snapshot
      or (new.payment_due_at is distinct from old.payment_due_at and not v_due_at_reschedule)
    then
      raise exception 'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE'
        using errcode = '23514';
    end if;

    if v_amounts_changed and not (
      old.payment_flow_version = 'v10'
      and new.payment_flow_version = 'v10'
      and old.financial_status = 'pending'
      and new.financial_status = 'pending'
      and not exists (
        select 1 from public.session_payment_setups setup
        where setup.session_payment_id = old.id
          and setup.status = 'succeeded'
          and setup.superseded_at is null
      )
      and not exists (
        select 1 from public.session_payment_schedules schedule
        where schedule.session_payment_id = old.id
          and schedule.status not in ('canceled', 'superseded')
      )
      and not exists (
        select 1 from public.session_transfer_jobs job
        where job.session_payment_id = old.id
      )
      and not exists (
        select 1 from public.stripe_transfers transfer
        where transfer.session_payment_id = old.id
      )
    ) then
      raise exception 'SESSION_PAYMENT_FINANCIAL_SNAPSHOT_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;

  if new.payment_flow_version <> 'v10' then
    return new;
  end if;

  select policy.policy_key into v_policy_key
  from public.financial_policy_versions policy
  where policy.id = new.policy_version_id;
  if v_policy_key is distinct from 'tes-payments-v10-setup-t24-immediate-transfer' then
    raise exception 'SESSION_PAYMENT_V10_POLICY_REQUIRED' using errcode = '23514';
  end if;

  select account.* into v_account
  from public.therapist_connect_accounts account
  where account.id = new.connect_account_id_snapshot;
  if not found
    or v_account.therapist_profile_id <> new.therapist_profile_id
    or v_account.stripe_account_id <> new.stripe_connect_account_id_snapshot
  then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_SNAPSHOT_INVALID'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and (
    not v_account.is_current or v_account.closed_at is not null
    or v_account.operational_status <> 'ready'
    or v_account.stripe_transfers_status <> 'active'
    or not v_account.payouts_enabled
    or v_account.payout_status <> 'enabled'
    or v_account.payout_schedule_interval <> 'daily'
  ) then
    raise exception 'SESSION_PAYMENT_CONNECT_ACCOUNT_NOT_READY'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.reschedule_uncharged_session_v10(
  p_booking_id uuid,
  p_patient_user_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_proposed_timezone text,
  p_reason text,
  p_request_id text,
  p_expected_booking_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_existing public.booking_reschedule_requests%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_setup public.session_payment_setups%rowtype;
  v_result jsonb;
  v_due_at timestamptz;
  v_idempotency_key text;
  v_fingerprint text;
  v_new_schedule_id uuid;
begin
  if p_booking_id is null or p_patient_user_id is null
    or p_proposed_starts_at is null or p_proposed_ends_at is null
    or p_proposed_starts_at >= p_proposed_ends_at
    or p_proposed_starts_at <= now()
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
  then
    raise exception 'SESSION_PRECHARGE_RESCHEDULE_V10_INVALID'
      using errcode = '22023';
  end if;

  -- Keep the same lock order as payment recording and cancellation.
  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id
  for update;
  select booking.* into v_booking
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  where booking.id = p_booking_id and patient.user_id = p_patient_user_id
  for update of booking;
  if not found then
    raise exception 'SESSION_PRECHARGE_RESCHEDULE_V10_FORBIDDEN'
      using errcode = '42501';
  end if;
  if v_payment.id is null or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PRECHARGE_RESCHEDULE_V10_NOT_FOUND'
      using errcode = '23514';
  end if;

  select request.* into v_existing
  from public.booking_reschedule_requests request
  where request.request_id = trim(p_request_id)
  for update;
  if found then
    if v_existing.booking_id <> v_booking.id
      or v_existing.requested_by_profile_id <> p_patient_user_id
      or v_existing.proposed_starts_at <> p_proposed_starts_at
      or v_existing.proposed_ends_at <> p_proposed_ends_at
      or v_existing.proposed_timezone <> p_proposed_timezone
      or v_existing.status <> 'applied'
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    select schedule.* into v_schedule
    from public.session_payment_schedules schedule
    where schedule.session_payment_id = v_payment.id
      and schedule.status = 'scheduled'
      and schedule.idempotency_key = 'tes:v10:session-charge:reschedule:' || trim(p_request_id)
    limit 1;
    if not found then
      raise exception 'SESSION_PRECHARGE_RESCHEDULE_V10_REQUIRES_SUPPORT'
        using errcode = '23514';
    end if;
    return jsonb_build_object(
      'applied', false,
      'bookingId', v_booking.id,
      'bookingVersion', v_booking.version,
      'chargeTiming', case when v_schedule.due_at <= now() then 'immediate' else 'scheduled' end,
      'paymentDueAt', v_schedule.due_at,
      'rescheduleRequestId', v_existing.id,
      'scheduleId', v_schedule.id,
      'status', 'applied'
    );
  end if;

  select schedule.* into v_schedule
  from public.session_payment_schedules schedule
  where schedule.session_payment_id = v_payment.id
    and schedule.status not in ('paid', 'failed', 'canceled', 'superseded')
  order by schedule.created_at desc
  limit 1 for update;
  select setup.* into v_setup
  from public.session_payment_setups setup
  where setup.id = v_schedule.session_payment_setup_id;

  if v_booking.status <> 'confirmed'
    or v_booking.starts_at <= now() + interval '24 hours'
    or (p_expected_booking_version is not null
      and p_expected_booking_version <> v_booking.version)
    or p_proposed_timezone <> v_booking.timezone
    or p_proposed_ends_at <> p_proposed_starts_at
      + v_booking.service_duration_minutes_snapshot * interval '1 minute'
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_payment.paid_at is not null
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.attempt_count <> 0
    or v_schedule.stripe_payment_intent_id is not null
    or v_schedule.stripe_charge_id is not null
    or v_schedule.lease_owner is not null
    or v_schedule.expected_booking_version <> v_booking.version
    or v_setup.id is null
    or v_setup.status <> 'succeeded'
    or v_setup.superseded_at is not null
    or v_setup.booking_version <> v_schedule.booking_version
    or exists (select 1 from public.session_transfer_jobs job
      where job.session_payment_id = v_payment.id)
    or exists (select 1 from public.stripe_transfers transfer
      where transfer.session_payment_id = v_payment.id)
  then
    raise exception 'SESSION_PRECHARGE_RESCHEDULE_V10_REQUIRES_SUPPORT'
      using errcode = '23514';
  end if;

  v_result := public.apply_patient_booking_reschedule_v1(
    v_booking.id,
    p_patient_user_id,
    p_proposed_starts_at,
    p_proposed_ends_at,
    p_proposed_timezone,
    p_reason,
    trim(p_request_id),
    v_booking.version
  );

  select booking.* into v_booking
  from public.bookings booking where booking.id = p_booking_id;
  v_due_at := v_booking.starts_at - interval '24 hours';

  update public.session_payment_schedules
  set status = 'superseded', lease_owner = null, lease_expires_at = null,
      updated_at = now()
  where id = v_schedule.id;

  perform pg_catalog.set_config(
    'tes.v10_reschedule_payment_id', v_payment.id::text, true
  );
  update public.session_payments
  set payment_due_at = v_due_at, updated_at = now()
  where id = v_payment.id;
  perform pg_catalog.set_config('tes.v10_reschedule_payment_id', '', true);

  v_idempotency_key := 'tes:v10:session-charge:reschedule:' || trim(p_request_id);
  v_fingerprint := encode(extensions.digest(concat_ws(':',
    v_schedule.stripe_environment,
    v_payment.id::text,
    v_setup.id::text,
    v_setup.stripe_payment_method_id,
    v_due_at::text,
    v_payment.gross_amount_cents::text,
    v_payment.currency::text,
    v_booking.version::text
  ), 'sha256'), 'hex');

  insert into public.session_payment_schedules (
    booking_id, booking_version, expected_booking_version,
    session_payment_id, session_payment_setup_id, stripe_environment,
    due_at, idempotency_key, request_fingerprint
  ) values (
    v_booking.id, v_setup.booking_version, v_booking.version,
    v_payment.id, v_setup.id, v_schedule.stripe_environment,
    v_due_at, v_idempotency_key, v_fingerprint
  ) returning id into v_new_schedule_id;

  return v_result || jsonb_build_object(
    'applied', true,
    'chargeTiming', case when v_due_at <= now() then 'immediate' else 'scheduled' end,
    'paymentDueAt', v_due_at,
    'scheduleId', v_new_schedule_id
  );
end;
$$;

revoke all on function public.reschedule_uncharged_session_v10(
  uuid,uuid,timestamptz,timestamptz,text,text,text,integer
) from public, anon, authenticated;
grant execute on function public.reschedule_uncharged_session_v10(
  uuid,uuid,timestamptz,timestamptz,text,text,text,integer
) to service_role;
