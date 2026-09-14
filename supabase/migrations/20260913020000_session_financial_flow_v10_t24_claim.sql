-- V10 T-24 claims are bound to the original reservation and saved card.
-- No cron is activated by this migration; rollout remains feature-flagged.

create table if not exists public.session_charge_incidents_v10 (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.session_payment_schedules(id) on delete restrict,
  code text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint session_charge_incident_code_safe check (code ~ '^[a-z0-9_]{1,64}$')
);

alter table public.session_charge_incidents_v10 enable row level security;
revoke all on public.session_charge_incidents_v10 from public, anon, authenticated;
grant select, insert, update on public.session_charge_incidents_v10 to service_role;

create table if not exists public.session_charge_recoveries_v10 (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.session_payment_schedules(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  patient_profile_id uuid not null references public.patient_profiles(id) on delete restrict,
  stripe_payment_intent_id text not null,
  status text not null default 'open' check (status in ('open', 'consumed', 'canceled')),
  opened_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint session_charge_recovery_pi_present check (length(trim(stripe_payment_intent_id)) > 0)
);
alter table public.session_charge_recoveries_v10 enable row level security;
revoke all on public.session_charge_recoveries_v10 from public, anon, authenticated;
grant select, insert, update on public.session_charge_recoveries_v10 to service_role;

create or replace function public.claim_due_session_payment_schedules_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
begin
  if p_now is null or p_worker_id is null
    or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_CLAIM_V10_INVALID' using errcode = '22023';
  end if;

  -- A worker that died after its fourth claim must not be retried forever.
  with exhausted as (
    select s.id
    from public.session_payment_schedules s
    where s.status in ('claimed', 'processing')
      and s.attempt_count >= 4
      and s.lease_expires_at <= p_now
    for update skip locked
  ), failed as (
    update public.session_payment_schedules s
    set status = 'failed', lease_owner = null, lease_expires_at = null,
        last_error_code = 'worker_lease_exhausted', last_failed_at = p_now,
        updated_at = p_now
    from exhausted where s.id = exhausted.id
    returning s.id
  )
  insert into public.session_charge_incidents_v10 (schedule_id, code)
  select id, 'worker_lease_exhausted' from failed
  on conflict (schedule_id) do update
    set code = excluded.code, status = 'open', resolved_at = null, updated_at = p_now;

  with candidates as (
    select s.id
    from public.session_payment_schedules s
    join public.session_payments p on p.id = s.session_payment_id
    join public.session_payment_setups setup on setup.id = s.session_payment_setup_id
    join public.bookings b on b.id = s.booking_id
    where s.status in ('scheduled', 'retry_scheduled', 'claimed', 'processing')
      and s.attempt_count < 4
      and coalesce(s.next_retry_at, s.due_at) <= p_now
      and (s.lease_expires_at is null or s.lease_expires_at <= p_now)
      and p.payment_flow_version = 'v10'
      and p.financial_status in ('pending', 'processing')
      and p.gross_amount_cents > 0
      and p.booking_id = s.booking_id
      and p.payment_due_at = s.due_at
      and setup.session_payment_id = p.id
      and setup.booking_id = b.id
      and setup.booking_version = s.booking_version
      and setup.stripe_environment = s.stripe_environment
      and setup.status = 'succeeded'
      and setup.superseded_at is null
      and setup.stripe_payment_method_id is not null
      -- Setup is bound to the pre-confirmation version. Confirming the
      -- booking is one operational transition and increments it exactly once.
      and b.version = s.booking_version + 1
      and b.status = 'confirmed'
      and b.starts_at > p_now
    order by coalesce(s.next_retry_at, s.due_at), s.id
    limit p_limit
    for update of s skip locked
  ), claimed as (
    update public.session_payment_schedules s
    set status = 'claimed', attempt_count = s.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        claimed_at = p_now, updated_at = p_now
    from candidates where s.id = candidates.id
    returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'scheduleId', s.id,
      'bookingId', s.booking_id,
      'bookingVersion', s.booking_version,
      'sessionPaymentId', s.session_payment_id,
      'setupId', setup.id,
      'stripeEnvironment', s.stripe_environment,
      'stripeCustomerId', setup.stripe_customer_id,
      'stripePaymentMethodId', setup.stripe_payment_method_id,
      'amountCents', p.gross_amount_cents,
      'currency', p.currency,
      'idempotencyKey', s.idempotency_key,
      'requestFingerprint', s.request_fingerprint,
      'attemptCount', s.attempt_count,
      'leaseExpiresAt', s.lease_expires_at
    ) order by s.due_at, s.id), '[]'::jsonb)
  into v_claims
  from claimed s
  join public.session_payment_setups setup on setup.id = s.session_payment_setup_id
  join public.session_payments p on p.id = s.session_payment_id;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

-- The local prototype was not shipped; this keeps repeated local validation
-- unambiguous while the migration is still under development.
drop function if exists public.record_session_payment_intent_v10(
  uuid,text,text,text,integer,text,text,text,text,text,timestamptz
);

create or replace function public.record_session_payment_intent_v10(
  p_schedule_id uuid,
  p_session_payment_id uuid,
  p_booking_id uuid,
  p_booking_version bigint,
  p_stripe_environment text,
  p_payment_intent_id text,
  p_status text,
  p_amount_cents integer,
  p_currency text,
  p_stripe_customer_id text,
  p_stripe_payment_method_id text,
  p_stripe_charge_id text default null,
  p_event_id text default null,
  p_event_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_setup public.session_payment_setups%rowtype;
  v_booking public.bookings%rowtype;
  v_patient_user_id uuid;
  v_result jsonb;
begin
  if p_schedule_id is null or p_session_payment_id is null
    or p_booking_id is null or p_booking_version is null
    or p_stripe_environment not in ('test', 'live')
    or nullif(trim(p_payment_intent_id), '') is null
    or p_status not in ('succeeded', 'processing', 'requires_action', 'requires_payment_method', 'canceled')
    or p_amount_cents is null or p_amount_cents <= 0
    or nullif(trim(p_currency), '') is null
    or nullif(trim(p_stripe_customer_id), '') is null
  then
    raise exception 'SESSION_PAYMENT_INTENT_V10_INVALID' using errcode = '22023';
  end if;

  -- Match the lock order used by the paid/outbox RPC.
  select p.* into v_payment
  from public.session_payments p
  join public.session_payment_schedules s on s.session_payment_id = p.id
  where s.id = p_schedule_id
  for update of p;
  if not found or v_payment.payment_flow_version <> 'v10' then
    raise exception 'SESSION_PAYMENT_INTENT_V10_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_schedule from public.session_payment_schedules
  where id = p_schedule_id for update;
  select * into v_setup from public.session_payment_setups
  where id = v_schedule.session_payment_setup_id;
  select * into v_booking from public.bookings where id = v_schedule.booking_id;

  if v_schedule.session_payment_id <> v_payment.id
    or v_schedule.session_payment_id <> p_session_payment_id
    or v_schedule.booking_id <> p_booking_id
    or v_schedule.booking_version <> p_booking_version
    or v_schedule.stripe_environment <> p_stripe_environment
    or v_schedule.booking_id <> v_payment.booking_id
    or v_setup.session_payment_id <> v_payment.id
    or v_setup.booking_version <> v_schedule.booking_version
    or v_setup.status <> 'succeeded'
    or v_setup.superseded_at is not null
    or v_setup.stripe_customer_id <> trim(p_stripe_customer_id)
    or (p_stripe_payment_method_id is not null
      and v_setup.stripe_payment_method_id <> trim(p_stripe_payment_method_id)
      and not exists (
        select 1 from public.session_charge_recoveries_v10 recovery
        where recovery.schedule_id = v_schedule.id
          and recovery.stripe_payment_intent_id = trim(p_payment_intent_id)
          and recovery.patient_profile_id = v_booking.patient_profile_id
          and recovery.status in ('open', 'consumed')
      ))
    or v_payment.gross_amount_cents <> p_amount_cents
    or lower(v_payment.currency::text) <> lower(trim(p_currency))
    or v_booking.version <> v_schedule.booking_version + 1
    or v_booking.status <> 'confirmed'
    or v_schedule.status in ('canceled', 'superseded')
    or (v_schedule.stripe_payment_intent_id is not null
      and v_schedule.stripe_payment_intent_id <> trim(p_payment_intent_id))
  then
    raise exception 'SESSION_PAYMENT_INTENT_V10_BINDING_MISMATCH' using errcode = '23514';
  end if;

  if p_status = 'succeeded' then
    if nullif(trim(p_stripe_charge_id), '') is null
      or nullif(trim(p_event_id), '') is null
      or p_event_created_at is null
    then
      raise exception 'SESSION_PAYMENT_INTENT_V10_SUCCESS_INCOMPLETE' using errcode = '22023';
    end if;
    v_result := public.confirm_session_payment_and_enqueue_transfer_v10(
      v_payment.id, p_stripe_environment, trim(p_payment_intent_id),
      trim(p_stripe_charge_id), p_event_created_at,
      trim(p_event_id), p_event_created_at
    );
    update public.session_charge_incidents_v10
    set status = 'resolved', resolved_at = now(), updated_at = now()
    where schedule_id = v_schedule.id and status = 'open';
    update public.session_charge_recoveries_v10
    set status = 'consumed', consumed_at = coalesce(consumed_at, now())
    where schedule_id = v_schedule.id and status = 'open';
    return v_result || jsonb_build_object('scheduleStatus', 'paid');
  end if;

  if v_payment.financial_status = 'paid' or v_schedule.status = 'paid' then
    return jsonb_build_object('scheduleStatus', 'paid', 'applied', false);
  end if;
  if v_schedule.status = 'failed' then
    return jsonb_build_object('scheduleStatus', 'failed', 'applied', false);
  end if;

  update public.session_payment_schedules
  set status = case p_status
        when 'processing' then 'processing'
        when 'canceled' then 'failed'
        else 'requires_customer_action'
      end,
      stripe_payment_intent_id = trim(p_payment_intent_id),
      last_error_code = case p_status
        when 'requires_action' then 'customer_authentication_required'
        when 'requires_payment_method' then 'payment_method_declined'
        when 'canceled' then 'payment_intent_canceled'
        else null
      end,
      last_failed_at = case when p_status = 'processing' then last_failed_at else now() end,
      lease_owner = null, lease_expires_at = null,
      next_retry_at = null, updated_at = now()
  where id = v_schedule.id;

  if p_status in ('requires_action', 'requires_payment_method') then
    select patient.user_id into v_patient_user_id
    from public.patient_profiles patient
    where patient.id = v_booking.patient_profile_id;
    insert into public.notifications(profile_id, kind, title, body, href, event_key)
    values (
      v_patient_user_id,
      'session_payment_declined',
      'Confirme o pagamento',
      'Seu banco precisa de uma confirmação ou de outro cartão para manter o encontro.',
      '/app/encontros/' || v_booking.id::text,
      'session-charge-recovery:' || v_schedule.id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
    perform public.enqueue_transactional_email_v1(
      'session_payment_declined',
      v_schedule.id,
      'session_payment',
      v_payment.id,
      v_patient_user_id,
      'profile:' || v_patient_user_id::text,
      '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'scheduleStatus', (select status from public.session_payment_schedules where id = v_schedule.id),
    'applied', true
  );
end;
$$;

create or replace function public.get_patient_session_charge_status_v10(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
begin
  if p_booking_id is null or auth.uid() is null then
    raise exception 'SESSION_CHARGE_ACCESS_DENIED' using errcode = '42501';
  end if;
  select b.* into v_booking from public.bookings b
  join public.patient_profiles patient on patient.id = b.patient_profile_id
  where b.id = p_booking_id and patient.user_id = auth.uid();
  if not found then
    raise exception 'SESSION_CHARGE_ACCESS_DENIED' using errcode = '42501';
  end if;
  select * into v_schedule from public.session_payment_schedules
  where booking_id = p_booking_id order by created_at desc limit 1;
  if not found then return jsonb_build_object('flow', 'other'); end if;
  return jsonb_build_object(
    'flow', 'v10',
    'status', v_schedule.status,
    'dueAt', v_schedule.due_at,
    'recoveryAvailable', v_schedule.status = 'requires_customer_action'
      and v_booking.status = 'confirmed'
      and v_booking.version = v_schedule.booking_version + 1
      and v_booking.starts_at > now()
      and v_schedule.stripe_payment_intent_id is not null
  );
end;
$$;

create or replace function public.begin_session_charge_recovery_v10(
  p_booking_id uuid,
  p_patient_profile_id uuid,
  p_schedule_id uuid,
  p_stripe_payment_intent_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_payment public.session_payments%rowtype;
  v_recovery public.session_charge_recoveries_v10%rowtype;
begin
  if p_booking_id is null or p_patient_profile_id is null or p_schedule_id is null
    or nullif(trim(p_stripe_payment_intent_id), '') is null then
    raise exception 'SESSION_CHARGE_RECOVERY_INVALID' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  select * into v_schedule from public.session_payment_schedules
  where id = p_schedule_id for update;
  select * into v_payment from public.session_payments
  where id = v_schedule.session_payment_id;
  if v_booking.patient_profile_id <> p_patient_profile_id
    or v_booking.status <> 'confirmed'
    or v_booking.version <> v_schedule.booking_version + 1
    or v_booking.starts_at <= now()
    or v_schedule.booking_id <> p_booking_id
    or v_schedule.status <> 'requires_customer_action'
    or v_schedule.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id)
    or v_payment.financial_status not in ('pending', 'processing')
  then
    raise exception 'SESSION_CHARGE_RECOVERY_NOT_ALLOWED' using errcode = '23514';
  end if;
  insert into public.session_charge_recoveries_v10 (
    schedule_id, booking_id, patient_profile_id, stripe_payment_intent_id
  ) values (
    p_schedule_id, p_booking_id, p_patient_profile_id, trim(p_stripe_payment_intent_id)
  ) on conflict (schedule_id) do update
    set opened_at = public.session_charge_recoveries_v10.opened_at
  returning * into v_recovery;
  if v_recovery.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id)
    or v_recovery.patient_profile_id <> p_patient_profile_id
    or v_recovery.status <> 'open'
  then
    raise exception 'SESSION_CHARGE_RECOVERY_CONFLICT' using errcode = '23505';
  end if;
  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.get_patient_session_charge_status_v10(uuid) from public, anon, authenticated;
grant execute on function public.get_patient_session_charge_status_v10(uuid) to authenticated, service_role;
revoke all on function public.begin_session_charge_recovery_v10(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.begin_session_charge_recovery_v10(uuid,uuid,uuid,text) to service_role;

-- V10 confirms the booking when the card is saved. A payment-owned transition
-- may therefore release that confirmed interval if payment is still incomplete
-- when the session begins.
create or replace function public.is_booking_status_transition_allowed_v1(
  p_current public.booking_status,
  p_next public.booking_status
)
returns boolean language sql immutable set search_path = '' as $$
  select case p_current
    when 'draft' then p_next in (
      'pending_payment', 'cancelled_by_patient', 'cancelled_by_payment'
    )
    when 'pending_payment' then p_next in (
      'confirmed', 'cancelled_by_patient', 'cancelled_by_payment', 'refunded'
    )
    when 'confirmed' then p_next in (
      'completed', 'cancelled_by_patient', 'cancelled_by_therapist',
      'cancelled_by_payment', 'no_show_patient', 'no_show_therapist', 'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'no_show_patient' then p_next = 'refunded'
    when 'no_show_therapist' then p_next = 'refunded'
    when 'cancelled_by_payment' then p_next = 'pending_payment'
    when 'refunded' then false
    else false
  end;
$$;

create or replace function public.list_due_session_payment_closures_v10(
  p_now timestamptz,
  p_limit integer default 20
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_items jsonb;
begin
  if p_now is null or p_limit not between 1 and 100 then
    raise exception 'SESSION_PAYMENT_CLOSURE_LIST_V10_INVALID' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduleId', schedule.id,
    'scheduleStatus', schedule.status,
    'bookingId', booking.id,
    'bookingVersion', schedule.booking_version,
    'sessionPaymentId', payment.id,
    'stripeEnvironment', schedule.stripe_environment,
    'stripePaymentIntentId', schedule.stripe_payment_intent_id,
    'stripeCustomerId', setup.stripe_customer_id,
    'stripePaymentMethodId', setup.stripe_payment_method_id,
    'amountCents', payment.gross_amount_cents,
    'currency', payment.currency,
    'idempotencyKey', schedule.idempotency_key
  ) order by booking.starts_at, schedule.id), '[]'::jsonb)
  into v_items
  from (
    select s.id
    from public.session_payment_schedules s
    join public.bookings b on b.id = s.booking_id
    join public.session_payments p on p.id = s.session_payment_id
    where b.status = 'confirmed'
      and b.starts_at <= p_now
      and p.payment_flow_version = 'v10'
      and p.financial_status in ('pending', 'processing')
      and s.status in (
        'scheduled', 'claimed', 'processing', 'requires_customer_action',
        'retry_scheduled', 'failed'
      )
    order by b.starts_at, s.id
    limit p_limit
  ) candidate
  join public.session_payment_schedules schedule on schedule.id = candidate.id
  join public.bookings booking on booking.id = schedule.booking_id
  join public.session_payments payment on payment.id = schedule.session_payment_id
  join public.session_payment_setups setup on setup.id = schedule.session_payment_setup_id;
  return jsonb_build_object('items', v_items, 'observedAt', p_now);
end;
$$;

create or replace function public.open_session_charge_incident_v10(
  p_schedule_id uuid,
  p_code text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_schedule_id is null or p_code not in (
    'payment_processing_at_session_start',
    'payment_state_unknown_at_session_start'
  ) then
    raise exception 'SESSION_CHARGE_INCIDENT_V10_INVALID' using errcode = '22023';
  end if;
  insert into public.session_charge_incidents_v10(schedule_id, code)
  values (p_schedule_id, p_code)
  on conflict (schedule_id) do update set
    code = excluded.code, status = 'open', resolved_at = null, updated_at = now();
  return jsonb_build_object('opened', true);
end;
$$;

create or replace function public.close_unpaid_session_payment_v10(
  p_schedule_id uuid,
  p_booking_id uuid,
  p_observed_stripe_status text,
  p_now timestamptz
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_booking public.bookings%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_event_id text;
begin
  if p_schedule_id is null or p_booking_id is null or p_now is null
    or p_observed_stripe_status not in (
      'not_created', 'canceled', 'requires_action', 'requires_payment_method'
    ) then
    raise exception 'SESSION_PAYMENT_CLOSURE_V10_INVALID' using errcode = '22023';
  end if;

  -- Same lock order as payment reconciliation: payment, schedule, booking.
  select payment.* into v_payment
  from public.session_payments payment
  join public.session_payment_schedules schedule
    on schedule.session_payment_id = payment.id
  where schedule.id = p_schedule_id
  for update of payment;
  select * into v_schedule from public.session_payment_schedules
  where id = p_schedule_id for update;
  select * into v_booking from public.bookings
  where id = p_booking_id for update;

  if v_schedule.status = 'canceled'
    and v_booking.status = 'cancelled_by_payment'
    and v_payment.financial_status in ('failed', 'canceled')
  then
    return jsonb_build_object('closed', true, 'applied', false, 'bookingId', v_booking.id);
  end if;

  if not found or v_payment.id is null or v_schedule.id is null
    or v_payment.payment_flow_version <> 'v10'
    or v_schedule.booking_id <> v_booking.id
    or v_schedule.booking_id <> p_booking_id
    or v_schedule.session_payment_id <> v_payment.id
    or v_booking.status <> 'confirmed'
    or v_booking.version <> v_schedule.booking_version + 1
    or v_booking.starts_at > p_now
    or v_payment.financial_status not in ('pending', 'processing')
    or v_schedule.status not in (
      'scheduled', 'requires_customer_action', 'retry_scheduled', 'failed'
    )
    or (p_observed_stripe_status = 'not_created' and (
      v_schedule.status <> 'scheduled'
      or v_schedule.stripe_payment_intent_id is not null
    ))
    or (p_observed_stripe_status <> 'not_created'
      and v_schedule.stripe_payment_intent_id is null)
  then
    raise exception 'SESSION_PAYMENT_CLOSURE_V10_NOT_ALLOWED' using errcode = '23514';
  end if;

  v_event_id := 'scheduler:v10:unpaid-at-start:' || v_schedule.id::text;
  perform public.apply_session_payment_state_v1(
    v_payment.id,
    case when p_observed_stripe_status = 'canceled'
      then 'canceled'::public.session_financial_status
      else 'failed'::public.session_financial_status end,
    v_event_id,
    p_now,
    v_schedule.stripe_payment_intent_id,
    null,
    null
  );

  update public.session_payment_schedules set
    status = 'canceled', lease_owner = null, lease_expires_at = null,
    next_retry_at = null, last_error_code = 'payment_not_completed_before_session',
    last_failed_at = p_now, updated_at = p_now
  where id = v_schedule.id;

  perform pg_catalog.set_config('tes.booking_reason', 'payment_not_completed_before_session', true);
  perform pg_catalog.set_config('tes.booking_source', 'payment_state', true);
  perform pg_catalog.set_config('tes.booking_request_id', v_event_id, true);
  update public.bookings set
    status = 'cancelled_by_payment',
    payment_status = case when p_observed_stripe_status = 'canceled'
      then 'cancelled'::public.payment_status else 'failed'::public.payment_status end,
    cancellation_reason = 'payment_not_completed_before_session',
    cancelled_at = coalesce(cancelled_at, p_now), updated_at = p_now
  where id = v_booking.id;
  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);

  update public.session_charge_recoveries_v10 set status = 'canceled'
  where schedule_id = v_schedule.id and status = 'open';
  update public.session_charge_incidents_v10 set
    status = 'resolved', resolved_at = p_now, updated_at = p_now
  where schedule_id = v_schedule.id and status = 'open';

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.patient_profiles patient, public.therapist_profiles therapist
  where patient.id = v_booking.patient_profile_id
    and therapist.id = v_booking.therapist_profile_id;
  insert into public.notifications(profile_id, kind, title, body, href, event_key)
  values
    (v_patient_user_id, 'session_payment_incomplete_patient',
      'Pagamento não concluído',
      'O pagamento não foi confirmado a tempo e o encontro foi cancelado.',
      '/app/encontros/' || v_booking.id::text,
      'session-payment-closure:' || v_schedule.id::text || ':patient'),
    (v_therapist_user_id, 'session_payment_incomplete_therapist',
      'Sessão cancelada',
      'O pagamento não foi confirmado e o horário foi liberado.',
      '/terapeuta/sessoes/' || v_booking.id::text,
      'session-payment-closure:' || v_schedule.id::text || ':therapist')
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  return jsonb_build_object('closed', true, 'applied', true, 'bookingId', v_booking.id);
end;
$$;

revoke all on function public.list_due_session_payment_closures_v10(timestamptz,integer) from public, anon, authenticated;
grant execute on function public.list_due_session_payment_closures_v10(timestamptz,integer) to service_role;
revoke all on function public.open_session_charge_incident_v10(uuid,text) from public, anon, authenticated;
grant execute on function public.open_session_charge_incident_v10(uuid,text) to service_role;
revoke all on function public.close_unpaid_session_payment_v10(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.close_unpaid_session_payment_v10(uuid,uuid,text,timestamptz) to service_role;

create or replace function public.fail_session_payment_schedule_attempt_v10(
  p_schedule_id uuid,
  p_worker_id uuid,
  p_error_code text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.session_payment_schedules%rowtype;
  v_failed boolean;
  v_retry_at timestamptz;
begin
  if p_schedule_id is null or p_worker_id is null or p_now is null
    or p_error_code not in ('stripe_transient', 'stripe_timeout', 'worker_error', 'stripe_state_unknown')
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_FAILURE_V10_INVALID' using errcode = '22023';
  end if;
  select * into v_schedule from public.session_payment_schedules
  where id = p_schedule_id for update;
  if not found or v_schedule.lease_owner is distinct from p_worker_id
    or v_schedule.lease_expires_at <= p_now
    or v_schedule.status not in ('claimed', 'processing')
  then
    raise exception 'SESSION_PAYMENT_SCHEDULE_LEASE_V10_INVALID' using errcode = '23514';
  end if;

  v_failed := v_schedule.attempt_count >= 4;
  v_retry_at := case when v_failed then null
    else p_now + make_interval(mins => least(15 * (2 ^ (v_schedule.attempt_count - 1))::integer, 60)) end;
  update public.session_payment_schedules
  set status = case when v_failed then 'failed' else 'retry_scheduled' end,
      next_retry_at = v_retry_at,
      last_error_code = p_error_code,
      last_failed_at = p_now,
      lease_owner = null, lease_expires_at = null, updated_at = p_now
  where id = p_schedule_id;

  if v_failed then
    insert into public.session_charge_incidents_v10 (schedule_id, code)
    values (p_schedule_id, p_error_code)
    on conflict (schedule_id) do update
      set code = excluded.code, status = 'open', resolved_at = null, updated_at = p_now;
  end if;
  return jsonb_build_object('status', case when v_failed then 'failed' else 'retry_scheduled' end,
    'nextRetryAt', v_retry_at, 'attemptCount', v_schedule.attempt_count);
end;
$$;

revoke all on function public.claim_due_session_payment_schedules_v10(timestamptz,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_due_session_payment_schedules_v10(timestamptz,uuid,integer,integer) to service_role;
revoke all on function public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_session_payment_intent_v10(uuid,uuid,uuid,bigint,text,text,text,integer,text,text,text,text,text,timestamptz) to service_role;
revoke all on function public.fail_session_payment_schedule_attempt_v10(uuid,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.fail_session_payment_schedule_attempt_v10(uuid,uuid,text,timestamptz) to service_role;

-- A late, verified Stripe success must still reconcile after a worker circuit
-- opens. It must not be hidden as a permanently failed local attempt.
create or replace function public.enforce_session_payment_schedule_state_v10()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.booking_version is distinct from old.booking_version
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
