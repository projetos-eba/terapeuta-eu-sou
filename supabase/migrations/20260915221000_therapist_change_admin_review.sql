-- Therapist-initiated changes keep the existing reschedule aggregate. A
-- therapist may ask the patient to choose another slot, or ask to cancel; the
-- patient may then choose a slot or request an administrative refund review.
-- Neither path calls Stripe from the participant command.

alter table public.booking_reschedule_requests
  add column if not exists change_kind text not null default 'legacy';

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_status;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_status check (
    status in (
      'pending', 'accepted', 'rejected', 'cancelled', 'expired', 'applied',
      'pending_admin_review', 'refunded'
    )
  );

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_change_kind_check;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_change_kind_check check (
    change_kind in (
      'legacy', 'therapist_reschedule', 'therapist_cancellation'
    )
  );

alter table public.booking_reschedule_requests
  alter column proposed_starts_at drop not null,
  alter column proposed_ends_at drop not null;

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_range;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_range check (
    (proposed_starts_at is null and proposed_ends_at is null)
    or (proposed_starts_at is not null and proposed_ends_at is not null
      and proposed_starts_at < proposed_ends_at)
  );

drop index if exists public.booking_reschedule_requests_one_pending_idx;
create unique index booking_reschedule_requests_one_open_idx
on public.booking_reschedule_requests (booking_id)
where status in ('pending', 'pending_admin_review');

create index if not exists booking_reschedule_requests_admin_review_idx
on public.booking_reschedule_requests (created_at)
where status = 'pending_admin_review';

-- Existing proposal validation remains authoritative for all concrete slots.
-- An open-choice therapist request intentionally has no slot to validate yet.
create or replace function public.validate_booking_reschedule_request_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if new.change_kind in ('therapist_reschedule', 'therapist_cancellation')
    and new.proposed_starts_at is null
    and new.proposed_ends_at is null
  then
    return new;
  end if;

  select * into v_booking
  from public.bookings
  where id = new.booking_id
  for update;

  if not found or v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || v_booking.patient_profile_id::text, 0
    )
  );
  perform public.expire_booking_holds_v1(now(), v_booking.therapist_profile_id);

  if new.proposed_timezone <> v_booking.timezone
    or new.proposed_ends_at <> new.proposed_starts_at
      + v_booking.service_duration_minutes_snapshot * interval '1 minute'
    or new.proposed_starts_at = v_booking.starts_at
    or not exists (
      select 1
      from public.list_booking_reschedule_candidates_v1(
        v_booking.id,
        new.proposed_starts_at,
        new.proposed_ends_at + interval '1 microsecond',
        now(),
        10
      ) as candidate
      where candidate.starts_at = new.proposed_starts_at
        and candidate.ends_at = new.proposed_ends_at
    )
  then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings as conflict
    where conflict.therapist_profile_id = v_booking.therapist_profile_id
      and conflict.id <> v_booking.id
      and conflict.status in ('draft', 'pending_payment', 'confirmed')
      and conflict.occupied_during && pg_catalog.tstzrange(
        new.proposed_starts_at
          - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
        new.proposed_ends_at
          + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
        '[)'
      )
  ) or exists (
    select 1 from public.booking_holds as hold
    where hold.therapist_profile_id = v_booking.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && pg_catalog.tstzrange(
        new.proposed_starts_at
          - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
        new.proposed_ends_at
          + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
        '[)'
      )
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if public.patient_has_schedule_conflict_v1(
    v_booking.patient_profile_id,
    new.proposed_starts_at,
    new.proposed_ends_at,
    v_booking.id
  ) then
    raise exception 'PATIENT_SCHEDULE_CONFLICT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.open_therapist_booking_change_v1(
  p_booking_id uuid,
  p_therapist_user_id uuid,
  p_kind text,
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
  v_request public.booking_reschedule_requests%rowtype;
  v_change_kind text;
begin
  if p_kind not in ('reschedule', 'cancellation')
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
    or length(trim(coalesce(p_reason, ''))) > 500
  then
    raise exception 'INVALID_THERAPIST_CHANGE_REQUEST' using errcode = '22023';
  end if;

  v_change_kind := case p_kind
    when 'reschedule' then 'therapist_reschedule'
    else 'therapist_cancellation'
  end;

  select * into v_existing
  from public.booking_reschedule_requests
  where request_id = trim(p_request_id)
  for update;

  if found then
    if v_existing.booking_id <> p_booking_id
      or v_existing.requested_by_profile_id <> p_therapist_user_id
      or v_existing.change_kind <> v_change_kind
    then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    return pg_catalog.jsonb_build_object(
      'bookingId', v_existing.booking_id,
      'bookingVersion', v_existing.booking_version_at_request,
      'expiresAt', v_existing.expires_at,
      'rescheduleRequestId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id
    and therapist.user_id = p_therapist_user_id
  for update of booking;

  if not found then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;
  if p_expected_booking_version is not null
    and p_expected_booking_version <> v_booking.version
  then
    raise exception 'BOOKING_VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  -- This is the same booking-level fence used by the patient-no-show worker.
  -- It serializes opening the patient decision with a job already being
  -- reserved, so the request can neutralize any unfinished no-show fence.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.id::text, 0)
  );

  if exists (
    select 1 from public.booking_reschedule_requests as request
    where request.booking_id = v_booking.id
      and request.status in ('pending', 'pending_admin_review')
  ) then
    raise exception 'BOOKING_RESCHEDULE_ALREADY_PENDING' using errcode = 'P0001';
  end if;

  insert into public.booking_reschedule_requests (
    booking_id, requested_by_profile_id, reason, status, request_id,
    booking_version_at_request, expires_at, change_kind
  ) values (
    v_booking.id, p_therapist_user_id,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    'pending', trim(p_request_id), v_booking.version,
    now() + interval '48 hours', v_change_kind
  ) returning * into v_request;

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, request_id, source,
    previous_status, next_status, payload
  ) values (
    v_booking.id, p_therapist_user_id, 'booking_reschedule_requested',
    trim(p_request_id), 'therapist_change', v_booking.status, v_booking.status,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'changeKind', v_change_kind,
      'expiresAt', v_request.expires_at,
      'rescheduleRequestId', v_request.id
    ))
  ) on conflict do nothing;

  update public.video_session_control_jobs as job
  set status = 'done'::public.video_session_control_job_status,
      completed_at = coalesce(job.completed_at, now()),
      locked_until_at = null,
      last_error_code = null,
      last_error_message = null,
      metadata = job.metadata || pg_catalog.jsonb_build_object(
        'supersededBy', 'pending_therapist_change',
        'supersededAt', now()
      ),
      updated_at = now()
  where job.booking_id = v_booking.id
    and job.operation = 'end_patient_no_show'::public.video_session_control_operation
    and job.status in (
      'queued'::public.video_session_control_job_status,
      'retry'::public.video_session_control_job_status
    );

  update public.video_sessions as session
  set termination_reason = null,
      termination_requested_at = null,
      updated_at = now()
  where session.booking_id = v_booking.id
    and session.termination_confirmed_at is null
    and session.termination_reason = 'patient_no_show';

  return pg_catalog.jsonb_build_object(
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'expiresAt', v_request.expires_at,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

create or replace function public.enter_therapist_change_admin_review_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_booking public.bookings%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
begin
  if old.status = new.status
    or new.status <> 'pending_admin_review'
    or new.change_kind not in ('therapist_reschedule', 'therapist_cancellation')
  then
    return new;
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = new.booking_id
  for update;

  select patient.user_id into v_patient_user_id
  from public.patient_profiles as patient
  where patient.id = v_booking.patient_profile_id;

  select therapist.user_id into v_therapist_user_id
  from public.therapist_profiles as therapist
  where therapist.id = v_booking.therapist_profile_id;

  select * into v_payment
  from public.session_payments
  where booking_id = new.booking_id
  for update;

  if found then
    update public.session_payments
    set refund_pending = true,
        transfer_status = case
          when transfer_status = 'transferred' then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'manual_refund_review',
        eligible_at = null,
        updated_at = now()
    where id = v_payment.id;
  end if;

  if v_booking.status = 'confirmed' then
    perform public.transition_booking_status_v1(
      v_booking.id,
      'cancelled_by_therapist'::public.booking_status,
      new.requested_by_profile_id,
      'therapist_change_refund_review',
      'therapist-change-review:' || new.id::text,
      null,
      'therapist_change'
    );
  end if;

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, request_id, source,
    previous_status, next_status, payload
  ) values (
    new.booking_id, new.resolved_by_profile_id,
    'therapist_change_admin_review',
    'therapist-change-review:' || new.id::text,
    'therapist_change', v_booking.status,
    'cancelled_by_therapist'::public.booking_status,
    pg_catalog.jsonb_build_object('rescheduleRequestId', new.id)
  ) on conflict do nothing;

  insert into public.notifications (
    profile_id, kind, title, body, href, event_key
  ) values
    (v_patient_user_id, 'therapist_change_refund_review_patient',
      'Reembolso em análise pelo TES',
      'Seu encontro foi encerrado. Nossa equipe vai analisar o reembolso.',
      '/app/encontros/' || new.booking_id::text,
      'therapist-change-review:' || new.id::text || ':patient'),
    (v_therapist_user_id, 'therapist_change_refund_review_therapist',
      'Reembolso em análise pelo TES',
      'A sessão foi encerrada e a equipe TES fará a análise financeira.',
      '/terapeuta/sessoes/' || new.booking_id::text,
      'therapist-change-review:' || new.id::text || ':therapist')
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists enter_therapist_change_admin_review
  on public.booking_reschedule_requests;
create trigger enter_therapist_change_admin_review
after update of status on public.booking_reschedule_requests
for each row execute function public.enter_therapist_change_admin_review_v1();

create or replace function public.resolve_therapist_booking_change_v1(
  p_reschedule_request_id uuid,
  p_patient_user_id uuid,
  p_resolution text,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_proposed_timezone text,
  p_request_id text,
  p_expected_booking_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.booking_reschedule_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_patient_user_id uuid;
begin
  if p_resolution not in ('reschedule', 'refund')
    or length(trim(coalesce(p_request_id, ''))) not between 8 and 200
  then
    raise exception 'INVALID_THERAPIST_CHANGE_RESOLUTION' using errcode = '22023';
  end if;

  select * into v_request
  from public.booking_reschedule_requests
  where id = p_reschedule_request_id
  for update;
  if not found or v_request.change_kind not in (
    'therapist_reschedule', 'therapist_cancellation'
  ) then
    raise exception 'BOOKING_RESCHEDULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = v_request.booking_id
  for update;

  select patient.user_id into v_patient_user_id
  from public.patient_profiles as patient
  where patient.id = v_booking.patient_profile_id;
  if v_patient_user_id <> p_patient_user_id then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    if v_request.resolution_request_id = trim(p_request_id) then
      return pg_catalog.jsonb_build_object(
        'bookingId', v_booking.id,
        'bookingVersion', v_booking.version,
        'rescheduleRequestId', v_request.id,
        'status', v_request.status
      );
    end if;
    raise exception 'BOOKING_RESCHEDULE_ALREADY_RESOLVED' using errcode = 'P0001';
  end if;

  if v_request.expires_at <= now() then
    update public.booking_reschedule_requests
    set status = case
          when v_request.change_kind = 'therapist_cancellation'
            or v_request.original_starts_at <= now()
          then 'pending_admin_review'
          else 'expired'
        end,
        resolved_by_profile_id = p_patient_user_id,
        resolution_request_id = trim(p_request_id),
        resolved_at = now(), updated_at = now()
    where id = v_request.id
    returning * into v_request;
    return pg_catalog.jsonb_build_object(
      'bookingId', v_booking.id,
      'bookingVersion', v_booking.version,
      'rescheduleRequestId', v_request.id,
      'status', v_request.status
    );
  end if;

  if p_resolution = 'reschedule' then
    if p_proposed_starts_at is null or p_proposed_ends_at is null
      or p_proposed_starts_at >= p_proposed_ends_at
      or p_proposed_starts_at <= now()
      or not public.is_valid_timezone_v1(p_proposed_timezone)
      or p_proposed_timezone <> v_booking.timezone
      or p_proposed_ends_at <> p_proposed_starts_at
        + v_booking.service_duration_minutes_snapshot * interval '1 minute'
      or p_proposed_starts_at = v_booking.starts_at
      or not exists (
        select 1 from public.list_booking_reschedule_candidates_v1(
          v_booking.id, p_proposed_starts_at,
          p_proposed_ends_at + interval '1 microsecond', now(), 10
        ) as candidate
        where candidate.starts_at = p_proposed_starts_at
          and candidate.ends_at = p_proposed_ends_at
      )
    then
      raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    update public.booking_reschedule_requests
    set proposed_starts_at = p_proposed_starts_at,
        proposed_ends_at = p_proposed_ends_at,
        proposed_timezone = p_proposed_timezone,
        updated_at = now()
    where id = v_request.id;

    return public.resolve_booking_reschedule_v1(
      v_request.id, p_patient_user_id, 'accepted', trim(p_request_id),
      p_expected_booking_version
    );
  end if;

  update public.booking_reschedule_requests
  set status = 'pending_admin_review',
      resolved_by_profile_id = p_patient_user_id,
      resolution_request_id = trim(p_request_id),
      resolved_at = now(), updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return pg_catalog.jsonb_build_object(
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

-- The existing expiry entry point is used by maintenance jobs. Therapist
-- cancellations and passed original appointments become admin review; an
-- unchosen future reschedule preserves its original confirmed time.
create or replace function public.expire_booking_reschedule_requests_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  update public.booking_reschedule_requests
  set status = case
        when change_kind = 'therapist_cancellation'
          or (change_kind = 'therapist_reschedule'
            and original_starts_at <= p_now)
        then 'pending_admin_review'
        else 'expired'
      end,
      resolved_at = p_now,
      updated_at = p_now
  where status = 'pending' and expires_at <= p_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.complete_therapist_change_refund_v1(
  p_actor_user_id uuid,
  p_session_payment_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.booking_reschedule_requests%rowtype;
  v_payment public.session_payments%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id and role = 'admin'
      and auth_deleted_at is null and anonymized_at is null
  ) then
    raise exception 'ADMIN_REFUND_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_payment from public.session_payments
  where id = p_session_payment_id
  for update;
  if not found or v_payment.financial_status <> 'refunded' then
    return pg_catalog.jsonb_build_object('completed', false);
  end if;

  select * into v_request from public.booking_reschedule_requests
  where booking_id = v_payment.booking_id
    and status = 'pending_admin_review'
    and change_kind in ('therapist_reschedule', 'therapist_cancellation')
  order by created_at desc
  limit 1
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('completed', false);
  end if;

  update public.booking_reschedule_requests
  set status = 'refunded', updated_at = now()
  where id = v_request.id;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  where booking.id = v_request.booking_id;

  insert into public.notifications (
    profile_id, kind, title, body, href, event_key
  ) values
    (v_patient_user_id, 'therapist_change_refund_resolved_patient',
      'Reembolso concluído',
      'O reembolso do encontro foi concluído. Consulte os detalhes financeiros.',
      '/app/encontros/' || v_request.booking_id::text,
      'therapist-change-refund:' || v_request.id::text || ':patient'),
    (v_therapist_user_id, 'therapist_change_refund_resolved_therapist',
      'Reembolso concluído',
      'A análise financeira da sessão foi concluída.',
      '/terapeuta/sessoes/' || v_request.booking_id::text,
      'therapist-change-refund:' || v_request.id::text || ':therapist')
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  return pg_catalog.jsonb_build_object('completed', true, 'rescheduleRequestId', v_request.id);
end;
$$;

-- This is the only relaxation of the existing Admin full-refund command: an
-- explicitly queued therapist-change review already blocks transfers with
-- refund_pending=true. The claim keeps it blocked again atomically.
create or replace function public.claim_full_session_refund_v10_v3(
  p_actor_user_id uuid,
  p_session_payment_id uuid,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_review_pending boolean;
begin
  perform 1 from public.session_payments
  where id = p_session_payment_id for update;

  select exists (
    select 1
    from public.booking_reschedule_requests as request
    join public.session_payments as payment on payment.booking_id = request.booking_id
    where payment.id = p_session_payment_id
      and request.status = 'pending_admin_review'
      and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
  ) into v_review_pending;

  select actor_user_id into v_actor
  from public.session_refund_decisions_v10
  where session_payment_id = p_session_payment_id;
  if v_actor is not null and v_actor <> p_actor_user_id then
    raise exception 'FULL_REFUND_DECISION_ALREADY_EXISTS' using errcode = '23505';
  end if;

  if v_review_pending and v_actor is null then
    update public.session_payments
    set refund_pending = false, updated_at = now()
    where id = p_session_payment_id;
  end if;

  return public.claim_full_session_refund_v10_v2(
    p_actor_user_id, p_session_payment_id, p_request_id, p_reason
  );
end;
$$;

revoke all on function public.validate_booking_reschedule_request_v1()
  from public, anon, authenticated;
revoke all on function public.open_therapist_booking_change_v1(uuid, uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.enter_therapist_change_admin_review_v1()
  from public, anon, authenticated;
revoke all on function public.resolve_therapist_booking_change_v1(uuid, uuid, text, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.expire_booking_reschedule_requests_v1(timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_therapist_change_refund_v1(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_full_session_refund_v10_v3(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.open_therapist_booking_change_v1(uuid, uuid, text, text, text, integer)
  to service_role;
grant execute on function public.resolve_therapist_booking_change_v1(uuid, uuid, text, timestamptz, timestamptz, text, text, integer)
  to service_role;
grant execute on function public.expire_booking_reschedule_requests_v1(timestamptz)
  to service_role;
grant execute on function public.complete_therapist_change_refund_v1(uuid, uuid, text)
  to service_role;
grant execute on function public.claim_full_session_refund_v10_v3(uuid, uuid, text, text)
  to service_role;
