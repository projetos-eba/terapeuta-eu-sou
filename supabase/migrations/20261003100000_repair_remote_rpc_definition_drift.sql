-- Repair three RPC definitions that drifted between environments.
--
-- This migration is intentionally limited to CREATE OR REPLACE FUNCTION with
-- unchanged signatures. It does not mutate data, indexes, policies, grants,
-- triggers, schedules, or table definitions. Existing ownership and EXECUTE
-- privileges are therefore preserved by PostgreSQL.

-- V10 charge claims must fail safe while a therapist-led reschedule decision
-- is still pending. The charge worker expires due requests before calling this
-- function, so the original schedule becomes claimable normally at T-24.
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

  with exhausted as (
    select s.id from public.session_payment_schedules s
    where s.status in ('claimed', 'processing')
      and s.attempt_count >= 4 and s.lease_expires_at <= p_now
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
      and p.booking_id = s.booking_id and p.payment_due_at = s.due_at
      and setup.session_payment_id = p.id and setup.booking_id = b.id
      and setup.booking_version = s.booking_version
      and setup.stripe_environment = s.stripe_environment
      and setup.status = 'succeeded' and setup.superseded_at is null
      and setup.stripe_payment_method_id is not null
      and b.version = s.expected_booking_version and b.status = 'confirmed'
      and b.starts_at > p_now
      and not exists (
        select 1 from public.booking_reschedule_requests request
        where request.booking_id = b.id
          and request.status = 'pending'
          and request.change_kind = 'therapist_reschedule'
      )
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
      'scheduleId', s.id, 'bookingId', s.booking_id,
      'bookingVersion', s.booking_version,
      'sessionPaymentId', s.session_payment_id, 'setupId', setup.id,
      'stripeEnvironment', s.stripe_environment,
      'stripeCustomerId', setup.stripe_customer_id,
      'stripePaymentMethodId', setup.stripe_payment_method_id,
      'amountCents', p.gross_amount_cents, 'currency', p.currency,
      'idempotencyKey', s.idempotency_key,
      'requestFingerprint', s.request_fingerprint,
      'attemptCount', s.attempt_count, 'leaseExpiresAt', s.lease_expires_at
    ) order by s.due_at, s.id), '[]'::jsonb)
  into v_claims
  from claimed s
  join public.session_payment_setups setup on setup.id = s.session_payment_setup_id
  join public.session_payments p on p.id = s.session_payment_id;

  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

-- MTR-4 V2 keeps the established V1 access/privacy contract and adds the
-- scheduled-session daily series without changing any source data.
create or replace function public.get_therapist_session_metrics_v2(
  p_period_days integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_profile_id uuid;
  v_timezone text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_points jsonb;
begin
  v_base := public.get_therapist_session_metrics_v1(p_period_days);
  v_profile_id := (v_base #>> '{therapist,profileId}')::uuid;
  v_timezone := v_base #>> '{meta,timezone}';
  v_period_start := (v_base #>> '{meta,periodStart}')::timestamptz;
  v_period_end := (v_base #>> '{meta,periodEnd}')::timestamptz;

  if v_profile_id is null
    or v_timezone is null
    or v_period_start is null
    or v_period_end is null then
    raise exception 'THERAPIST_SESSION_METRICS_V2_BASE_CONTRACT_INVALID'
      using errcode = 'P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_set(
        daily.point,
        '{sessionsScheduled}',
        to_jsonb(coalesce(scheduled.sessions_scheduled, 0)),
        true
      )
      order by (daily.point ->> 'date')::date
    ),
    '[]'::jsonb
  )
  into v_points
  from jsonb_array_elements(v_base #> '{evolution,points}') as daily(point)
  left join (
    select
      (booking.starts_at at time zone v_timezone)::date as local_date,
      count(*)::integer as sessions_scheduled
    from public.bookings as booking
    where booking.therapist_profile_id = v_profile_id
      and booking.starts_at >= v_period_start
      and booking.starts_at < v_period_end
      and booking.status in (
        'confirmed',
        'completed',
        'cancelled_by_patient',
        'cancelled_by_therapist',
        'cancelled_by_admin',
        'cancelled_by_payment',
        'no_show_patient',
        'no_show_therapist',
        'no_show_both',
        'refunded'
      )
    group by (booking.starts_at at time zone v_timezone)::date
  ) as scheduled
    on scheduled.local_date = (daily.point ->> 'date')::date;

  return jsonb_set(
    jsonb_set(v_base, '{contractVersion}', to_jsonb(2), true),
    '{evolution}',
    jsonb_build_object(
      'status', v_base #> '{evolution,status}',
      'points', v_points
    ),
    true
  );
end;
$$;

-- The V1 compatibility entry point follows the current theme-only V2
-- contract. It no longer reads or recreates the retired category identifier.
create or replace function public.submit_therapy_catalog_request_v1(p_actor_user_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return public.submit_therapy_catalog_request_v2(
    p_actor_user_id,
    jsonb_build_object(
      'informedName', p_payload->>'informedName',
      'themeIds', coalesce(p_payload->'themeIds', '[]'::jsonb),
      'submission', coalesce(p_payload->'submission', jsonb_build_object(
        'description', p_payload->>'description',
        'objective', p_payload->>'justification',
        'useCases', p_payload->>'useCases',
        'sessionProcess', p_payload->>'sessionProcess'
      ))
    ),
    gen_random_uuid()
  );
end; $$;
