-- Session administration: presentation-safe reservation data and a narrow,
-- pre-charge-only cancellation command. This migration never calls Stripe.
begin;

create or replace function public.is_booking_status_transition_allowed_v1(
  p_current public.booking_status,
  p_next public.booking_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_current
    when 'draft' then p_next in (
      'pending_payment', 'cancelled_by_patient', 'cancelled_by_payment'
    )
    when 'pending_payment' then p_next in (
      'confirmed', 'cancelled_by_patient', 'cancelled_by_payment', 'refunded'
    )
    when 'confirmed' then p_next in (
      'completed', 'cancelled_by_patient', 'cancelled_by_therapist',
      'cancelled_by_admin', 'cancelled_by_payment', 'no_show_patient',
      'no_show_therapist', 'no_show_both', 'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'cancelled_by_admin' then false
    when 'no_show_patient' then p_next in ('confirmed', 'refunded')
    when 'no_show_therapist' then p_next in ('confirmed', 'refunded')
    when 'no_show_both' then p_next in ('confirmed', 'refunded')
    when 'cancelled_by_payment' then p_next = 'pending_payment'
    when 'refunded' then false
    else false
  end;
$$;

create or replace function public.transition_booking_status_v1(
  p_booking_id uuid,
  p_target_status public.booking_status,
  p_actor_profile_id uuid,
  p_reason text,
  p_request_id text,
  p_expected_version integer default null,
  p_source text default 'agenda_a2'
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_booking_reason text;
  v_booking public.bookings%rowtype;
  v_existing_status public.booking_status;
begin
  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_booking
  from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select next_status into v_existing_status
  from public.booking_events
  where booking_id = p_booking_id
    and event_type = 'booking_status_changed'
    and request_id = trim(p_request_id);
  if found then
    if v_existing_status <> p_target_status then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_booking;
  end if;

  select case
      when patient.user_id = p_actor_profile_id then 'patient'
      when therapist.user_id = p_actor_profile_id then 'therapist'
      when exists (
        select 1 from public.profiles as profile
        where profile.id = p_actor_profile_id
          and profile.role = 'admin'::public.user_role
          and profile.auth_deleted_at is null
          and profile.anonymized_at is null
      ) then 'admin'
      else null
    end into v_actor_role
  from public.patient_profiles as patient
  join public.therapist_profiles as therapist
    on therapist.id = v_booking.therapist_profile_id
  where patient.id = v_booking.patient_profile_id;

  if v_actor_role is null
    and not (p_actor_profile_id is null and p_source in ('admin', 'system'))
  then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_expected_version is not null and p_expected_version <> v_booking.version then
    raise exception 'BOOKING_VERSION_CONFLICT' using errcode = '40001';
  end if;
  if p_target_status in ('pending_payment', 'confirmed', 'refunded') then
    raise exception 'PAYMENT_WORKFLOW_REQUIRED' using errcode = 'P0001';
  end if;
  if p_target_status = 'cancelled_by_patient' and v_actor_role <> 'patient' then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_target_status in (
    'cancelled_by_therapist', 'completed', 'no_show_patient', 'no_show_therapist'
  ) and v_actor_role <> 'therapist' then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_target_status = 'cancelled_by_admin'
    and (v_actor_role <> 'admin' or p_source <> 'admin_precharge_cancellation') then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_target_status in (
    'cancelled_by_patient', 'cancelled_by_therapist', 'cancelled_by_admin'
  ) and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'CANCELLATION_REASON_REQUIRED' using errcode = '22023';
  end if;

  -- The administrative justification belongs only to the append-only audit
  -- record. Participant-facing state and lifecycle events stay neutral.
  v_booking_reason := case
    when p_target_status = 'cancelled_by_admin' then ''
    else left(trim(coalesce(p_reason, '')), 500)
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform pg_catalog.set_config('tes.booking_actor_profile_id', coalesce(p_actor_profile_id::text, ''), true);
  perform pg_catalog.set_config('tes.booking_reason', v_booking_reason, true);
  perform pg_catalog.set_config('tes.booking_request_id', trim(p_request_id), true);
  perform pg_catalog.set_config('tes.booking_source', left(trim(coalesce(p_source, 'agenda_a2')), 80), true);

  update public.bookings
  set status = p_target_status,
      cancellation_reason = case when p_target_status in (
        'cancelled_by_patient', 'cancelled_by_therapist'
      ) then v_booking_reason else cancellation_reason end,
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  if p_target_status in (
    'cancelled_by_patient', 'cancelled_by_therapist', 'cancelled_by_admin'
  ) then
    perform public.sync_booking_video_session_from_agenda_v1(
      v_booking.id, 'cancel', p_request_id
    );
  end if;

  perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
  perform pg_catalog.set_config('tes.booking_reason', '', true);
  perform pg_catalog.set_config('tes.booking_request_id', '', true);
  perform pg_catalog.set_config('tes.booking_source', '', true);
  return v_booking;
end;
$$;

create or replace function public.admin_cancel_uncharged_session_v10(
  p_booking_id uuid,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_now timestamptz := now();
  v_request_id text := p_request_id::text;
begin
  if p_booking_id is null or p_request_id is null
    or length(trim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'ADMIN_SESSION_PRECHARGE_CANCEL_INVALID' using errcode = '22023';
  end if;
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null
  ) then
    raise exception 'ADMIN_SESSION_PRECHARGE_CANCEL_FORBIDDEN' using errcode = '42501';
  end if;

  -- Follow the established worker-safe lock order: payment, booking, schedule.
  select * into v_payment from public.session_payments
  where booking_id = p_booking_id for update;
  select * into v_booking from public.bookings
  where id = p_booking_id for update;
  if not found or v_payment.id is null then
    raise exception 'ADMIN_SESSION_PRECHARGE_CANCEL_NOT_AVAILABLE' using errcode = '23514';
  end if;
  select * into v_schedule from public.session_payment_schedules
  where session_payment_id = v_payment.id and status <> 'superseded'
  order by (status = 'scheduled') desc, created_at desc
  limit 1 for update;

  if v_booking.status = 'cancelled_by_admin'
    and v_payment.financial_status = 'canceled'
    and v_schedule.status = 'canceled'
    and exists (
      select 1 from public.booking_events as event
      where event.booking_id = v_booking.id
        and event.event_type = 'booking_status_changed'
        and event.request_id = v_request_id
        and event.next_status = 'cancelled_by_admin'
    ) then
    return jsonb_build_object(
      'applied', false, 'bookingId', v_booking.id,
      'canceled', true, 'charged', false
    );
  end if;

  if v_payment.payment_flow_version <> 'v10'
    or v_booking.status <> 'confirmed'
    or v_booking.starts_at <= v_now + interval '24 hours'
    or v_payment.financial_status <> 'pending'
    or v_payment.stripe_payment_intent_id is not null
    or v_payment.stripe_charge_id is not null
    or v_payment.paid_at is not null
    or v_schedule.id is null
    or v_schedule.status <> 'scheduled'
    or v_schedule.booking_id <> v_booking.id
    or v_schedule.expected_booking_version <> v_booking.version
    or v_schedule.attempt_count <> 0
    or v_schedule.stripe_payment_intent_id is not null
    or v_schedule.stripe_charge_id is not null
    or v_schedule.lease_owner is not null
    or v_schedule.lease_expires_at is not null
    or not exists (
      select 1 from public.session_payment_setups as setup
      where setup.id = v_schedule.session_payment_setup_id
        and setup.session_payment_id = v_payment.id
        and setup.booking_id = v_booking.id
        and setup.booking_version = v_schedule.booking_version
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    or exists (
      select 1 from public.booking_reschedule_requests as request
      where request.booking_id = v_booking.id
        and request.status in ('pending', 'pending_admin_review')
    )
    or exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    or exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    )
  then
    raise exception 'ADMIN_SESSION_PRECHARGE_CANCEL_NOT_AVAILABLE' using errcode = '23514';
  end if;

  update public.session_payment_schedules
  set status = 'canceled', canceled_at = v_now,
      lease_owner = null, lease_expires_at = null, next_retry_at = null,
      updated_at = v_now
  where id = v_schedule.id;
  update public.session_payment_setups
  set status = 'canceled', updated_at = v_now
  where id = v_schedule.session_payment_setup_id and status = 'succeeded';
  update public.session_promotion_reservations
  set status = 'released', released_at = v_now, updated_at = v_now
  where session_payment_id = v_payment.id and status = 'reserved';
  update public.session_payments
  set financial_status = 'canceled', transfer_status = 'not_eligible',
      canceled_at = v_now, updated_at = v_now
  where id = v_payment.id;

  perform public.transition_booking_status_v1(
    v_booking.id,
    'cancelled_by_admin'::public.booking_status,
    v_actor_id,
    trim(p_reason),
    v_request_id,
    v_booking.version,
    'admin_precharge_cancellation'
  );
  update public.bookings
  set payment_status = 'cancelled', cancelled_at = v_now, updated_at = v_now
  where id = v_booking.id;

  perform public.record_admin_audit_event_v1(
    v_actor_id, 'admin', 'admin.sessions.manage',
    'session.cancel_before_charge', 'booking', v_booking.id::text,
    jsonb_build_object('status', 'confirmed', 'paymentStatus', 'pending'),
    jsonb_build_object('status', 'cancelled_by_admin', 'paymentStatus', 'canceled'),
    trim(p_reason), v_request_id, null, 'admin-session-precharge-cancellation'
  );

  return jsonb_build_object(
    'applied', true, 'bookingId', v_booking.id,
    'canceled', true, 'charged', false
  );
end;
$$;

revoke all on function public.admin_cancel_uncharged_session_v10(uuid, text, uuid)
  from public, anon;
grant execute on function public.admin_cancel_uncharged_session_v10(uuid, text, uuid)
  to authenticated, service_role;

-- Keep the existing authorisation/filtering contracts and only append the
-- small payment projection required to present a future reservation honestly.
alter function public.admin_get_operation_module_v1(text, integer, integer)
  rename to admin_get_operation_module_v1_before_session_reservation;

create function public.admin_get_operation_module_v1(
  p_module text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_rows jsonb;
begin
  v_base := public.admin_get_operation_module_v1_before_session_reservation(
    p_module, p_limit, p_offset
  );
  if p_module is distinct from 'sessions' then
    return v_base;
  end if;

  select coalesce(jsonb_agg(enriched.row_payload order by rows.ordinality), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(v_base -> 'rows') with ordinality as rows(row, ordinality)
  left join public.bookings as booking on booking.id = (rows.row ->> 'id')::uuid
  left join public.session_payments as payment on payment.booking_id = booking.id
  left join lateral (
    select schedule.*
    from public.session_payment_schedules as schedule
    where schedule.session_payment_id = payment.id and schedule.status <> 'superseded'
    order by (schedule.status = 'scheduled') desc, schedule.created_at desc
    limit 1
  ) as schedule on true
  cross join lateral (
    select rows.row || jsonb_build_object(
      'financial_status', payment.financial_status,
      'can_cancel_before_charge', coalesce(
        booking.status = 'confirmed'::public.booking_status
        and booking.starts_at > now() + interval '24 hours'
        and payment.payment_flow_version = 'v10'
        and payment.financial_status = 'pending'::public.session_financial_status
        and payment.stripe_payment_intent_id is null
        and payment.stripe_charge_id is null
        and payment.paid_at is null
        and schedule.id is not null
        and schedule.status = 'scheduled'
        and schedule.booking_id = booking.id
        and schedule.expected_booking_version = booking.version
        and schedule.attempt_count = 0
        and schedule.stripe_payment_intent_id is null
        and schedule.stripe_charge_id is null
        and schedule.lease_owner is null
        and schedule.lease_expires_at is null
        and exists (
          select 1 from public.session_payment_setups as setup
          where setup.id = schedule.session_payment_setup_id
            and setup.session_payment_id = payment.id
            and setup.booking_id = booking.id
            and setup.booking_version = schedule.booking_version
            and setup.status = 'succeeded'
            and setup.superseded_at is null
        )
        and not exists (
          select 1 from public.booking_reschedule_requests as request
          where request.booking_id = booking.id
            and request.status in ('pending', 'pending_admin_review')
        )
        and not exists (
          select 1 from public.session_transfer_jobs as job
          where job.session_payment_id = payment.id
        )
        and not exists (
          select 1 from public.stripe_transfers as transfer
          where transfer.session_payment_id = payment.id
        ),
        false
      )
    ) as row_payload
  ) as enriched;

  return jsonb_set(v_base, '{rows}', v_rows);
end;
$$;

revoke all on function public.admin_get_operation_module_v1_before_session_reservation(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_module_v1(text, integer, integer)
  from public, anon;
grant execute on function public.admin_get_operation_module_v1(text, integer, integer)
  to authenticated, service_role;

alter function public.admin_get_operation_detail_v1(text, uuid)
  rename to admin_get_operation_detail_v1_before_session_reservation;

create function public.admin_get_operation_detail_v1(p_module text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_record jsonb;
  v_payment public.session_payments%rowtype;
  v_schedule public.session_payment_schedules%rowtype;
  v_can_cancel boolean := false;
begin
  v_base := public.admin_get_operation_detail_v1_before_session_reservation(p_module, p_id);
  v_record := v_base -> 'record';
  if p_module is distinct from 'sessions' or v_record is null or v_record = 'null'::jsonb then
    return v_base;
  end if;

  select * into v_payment from public.session_payments where booking_id = p_id;
  select * into v_schedule from public.session_payment_schedules
  where session_payment_id = v_payment.id and status <> 'superseded'
  order by (status = 'scheduled') desc, created_at desc limit 1;

  select coalesce(
    booking.status = 'confirmed'::public.booking_status
    and booking.starts_at > now() + interval '24 hours'
    and v_payment.payment_flow_version = 'v10'
    and v_payment.financial_status = 'pending'::public.session_financial_status
    and v_payment.stripe_payment_intent_id is null
    and v_payment.stripe_charge_id is null
    and v_payment.paid_at is null
    and v_schedule.id is not null
    and v_schedule.status = 'scheduled'
    and v_schedule.booking_id = booking.id
    and v_schedule.expected_booking_version = booking.version
    and v_schedule.attempt_count = 0
    and v_schedule.stripe_payment_intent_id is null
    and v_schedule.stripe_charge_id is null
    and v_schedule.lease_owner is null
    and v_schedule.lease_expires_at is null
    and exists (
      select 1 from public.session_payment_setups as setup
      where setup.id = v_schedule.session_payment_setup_id
        and setup.session_payment_id = v_payment.id
        and setup.booking_id = booking.id
        and setup.booking_version = v_schedule.booking_version
        and setup.status = 'succeeded'
        and setup.superseded_at is null
    )
    and not exists (
      select 1 from public.booking_reschedule_requests as request
      where request.booking_id = booking.id
        and request.status in ('pending', 'pending_admin_review')
    )
    and not exists (
      select 1 from public.session_transfer_jobs as job
      where job.session_payment_id = v_payment.id
    )
    and not exists (
      select 1 from public.stripe_transfers as transfer
      where transfer.session_payment_id = v_payment.id
    ), false
  ) into v_can_cancel
  from public.bookings as booking where booking.id = p_id;

  return jsonb_set(v_base, '{record}', v_record || jsonb_build_object(
    'financial_status', v_payment.financial_status,
    'can_cancel_before_charge', v_can_cancel
  ));
end;
$$;

revoke all on function public.admin_get_operation_detail_v1_before_session_reservation(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_operation_detail_v1(text, uuid)
  from public, anon;
grant execute on function public.admin_get_operation_detail_v1(text, uuid)
  to authenticated, service_role;

-- Reminders and neutral participant communication must also observe the new
-- terminal state. Guard each definition so a divergent predecessor is never
-- silently replaced.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_anchor constant text :=
    'new.next_status::text in (''cancelled_by_patient'', ''cancelled_by_therapist'', ''refunded'')';
  v_replacement constant text :=
    'new.next_status::text in (''cancelled_by_patient'', ''cancelled_by_therapist'', ''cancelled_by_admin'', ''refunded'')';
  v_hits integer;
  v_name text;
begin
  foreach v_name in array array[
    'public.notify_booking_lifecycle_v1()',
    'public.enqueue_booking_email_v1()'
  ] loop
    v_signature := pg_catalog.to_regprocedure(v_name);
    if v_signature is null then
      raise exception 'ADMIN_SESSION_CANCELLATION_COMMUNICATION_SCHEMA_DRIFT: %', v_name
        using errcode = 'P0001';
    end if;
    select pg_catalog.pg_get_functiondef(v_signature::oid) into v_definition;
    v_hits := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
    if v_hits <> 1 then
      raise exception 'ADMIN_SESSION_CANCELLATION_COMMUNICATION_SCHEMA_DRIFT: %', v_name
        using errcode = 'P0001';
    end if;
    execute replace(v_definition, v_anchor, v_replacement);
  end loop;
end;
$migration$;

-- A delayed setup confirmation must not revive a booking that an Admin has
-- already cancelled locally before the scheduled charge ever began.
do $migration$
declare
  v_signature constant text :=
    'public.complete_session_payment_setup_v10(uuid,bigint,text,text,text,text,text,text,text,timestamp with time zone)';
  v_procedure regprocedure;
  v_definition text;
  v_anchor constant text :=
    '''cancelled_by_patient'', ''cancelled_by_therapist''';
  v_replacement constant text :=
    '''cancelled_by_patient'', ''cancelled_by_therapist'', ''cancelled_by_admin''';
  v_hits integer;
begin
  v_procedure := pg_catalog.to_regprocedure(v_signature);
  if v_procedure is null then
    raise exception 'ADMIN_SESSION_CANCELLATION_SETUP_SCHEMA_DRIFT: %', v_signature using errcode = 'P0001';
  end if;
  select pg_catalog.pg_get_functiondef(v_procedure::oid) into v_definition;
  v_hits := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_hits <> 1 then
    raise exception 'ADMIN_SESSION_CANCELLATION_SETUP_SCHEMA_DRIFT: %', v_signature using errcode = 'P0001';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

-- A session cancelled locally by an Admin must never be considered eligible
-- for a video room. These are read/guard functions only; the cancellation
-- command itself does not create, update, or contact a video provider.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_anchor constant text := '''cancelled_by_patient'',';
  v_replacement constant text := '''cancelled_by_patient'', ''cancelled_by_admin'',';
  v_hits integer;
  v_name text;
begin
  foreach v_name in array array[
    'public.build_video_session_access_state_v1(public.booking_status,public.session_financial_status,timestamp with time zone,timestamp with time zone,public.video_session_status,boolean,timestamp with time zone)',
    'public.ensure_video_session_for_paid_booking_v1(uuid,text,text)'
  ] loop
    v_signature := pg_catalog.to_regprocedure(v_name);
    if v_signature is null then
      raise exception 'ADMIN_SESSION_CANCELLATION_VIDEO_SCHEMA_DRIFT: %', v_name
        using errcode = 'P0001';
    end if;
    select pg_catalog.pg_get_functiondef(v_signature::oid) into v_definition;
    v_hits := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
    if v_hits <> 1 then
      raise exception 'ADMIN_SESSION_CANCELLATION_VIDEO_SCHEMA_DRIFT: %', v_name
        using errcode = 'P0001';
    end if;
    execute replace(v_definition, v_anchor, v_replacement);
  end loop;
end;
$migration$;

-- Count the new terminal state in the private, aggregated therapist metrics.
-- The existing cancellation counters remain aggregate-only and their contract
-- is unchanged; this only prevents administrative cancellations from being
-- silently omitted.
do $migration$
declare
  v_signature constant text := 'public.get_therapist_session_metrics_v1(integer)';
  v_procedure regprocedure;
  v_definition text;
  v_cancelled_pair_pattern constant text :=
    $pattern$'cancelled_by_patient',\s*'cancelled_by_therapist'$pattern$;
  v_outcome_anchor constant text :=
    $$('cancelled_by_therapist', 'Canceladas pelo terapeuta', 5)$$;
  v_outcome_replacement constant text :=
    $$('cancelled_by_therapist', 'Canceladas pelo terapeuta', 5),
              ('cancelled_by_admin', 'Canceladas pela administração', 6)$$;
begin
  v_procedure := pg_catalog.to_regprocedure(v_signature);
  if v_procedure is null then
    raise exception 'ADMIN_SESSION_CANCELLATION_METRICS_SCHEMA_DRIFT: %', v_signature
      using errcode = 'P0001';
  end if;
  select pg_catalog.pg_get_functiondef(v_procedure::oid) into v_definition;
  if regexp_count(v_definition, v_cancelled_pair_pattern) <> 3
    or (length(v_definition) - length(replace(v_definition, v_outcome_anchor, '')))
      / length(v_outcome_anchor) <> 1
  then
    raise exception 'ADMIN_SESSION_CANCELLATION_METRICS_SCHEMA_DRIFT: %', v_signature
      using errcode = 'P0001';
  end if;
  v_definition := regexp_replace(
    v_definition,
    v_cancelled_pair_pattern,
    '''cancelled_by_patient'', ''cancelled_by_therapist'', ''cancelled_by_admin''',
    'g'
  );
  execute replace(v_definition, v_outcome_anchor, v_outcome_replacement);
end;
$migration$;

-- Keep the therapist session summary terminal without changing historical
-- cancellation categories or financial rules.
do $migration$
declare
  v_signature constant text :=
    'public.get_therapist_sessions_v1(integer,timestamp with time zone,uuid,timestamp with time zone,timestamp with time zone,public.booking_status,public.session_financial_status,uuid,uuid,text)';
  v_procedure regprocedure;
  v_definition text;
  v_anchor constant text :=
    '''cancelled_by_therapist''::public.booking_status';
  v_replacement constant text :=
    '''cancelled_by_therapist''::public.booking_status, ''cancelled_by_admin''::public.booking_status';
  v_hits integer;
begin
  v_procedure := pg_catalog.to_regprocedure(v_signature);
  if v_procedure is null then
    raise exception 'ADMIN_SESSION_CANCELLATION_METRICS_SCHEMA_DRIFT: %', v_signature using errcode = 'P0001';
  end if;
  select pg_catalog.pg_get_functiondef(v_procedure::oid) into v_definition;
  v_hits := (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor);
  if v_hits <> 1 then
    raise exception 'ADMIN_SESSION_CANCELLATION_METRICS_SCHEMA_DRIFT: %', v_signature using errcode = 'P0001';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

comment on function public.admin_cancel_uncharged_session_v10(uuid, text, uuid) is
  'Admin-only V10 pre-charge cancellation. It locks the local schedule and payment state, rejects any charge activity, and never invokes a payment provider.';

commit;
