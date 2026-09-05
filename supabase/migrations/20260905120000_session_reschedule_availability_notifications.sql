-- Booking-aware reschedule availability and lifecycle notifications.
-- Existing bookings keep their immutable commercial/scheduling snapshots;
-- current schedule rules, exceptions, notice and horizon remain authoritative.

create or replace function public.list_booking_reschedule_candidates_v1(
  p_booking_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_reference_at timestamptz default now(),
  p_limit integer default 5000
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  occupied_during tstzrange
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_horizon_days integer;
  v_min_notice integer;
  v_step integer;
begin
  if p_range_start is null
    or p_range_end is null
    or p_range_start >= p_range_end
    or p_range_end - p_range_start > interval '92 days'
    or p_limit not between 1 and 5000
  then
    raise exception 'INVALID_RESCHEDULE_RANGE' using errcode = '22023';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.status = 'confirmed'
    and exists (
      select 1 from public.therapist_profiles as therapist
      where therapist.id = booking.therapist_profile_id
        and therapist.status = 'approved'
    )
    and exists (
      select 1 from public.therapist_schedule_settings as schedule
      where schedule.therapist_profile_id = booking.therapist_profile_id
    );

  if not found then
    return;
  end if;

  select
    coalesce((select settings.min_notice_minutes from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 120),
    coalesce((select settings.max_days_ahead from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 90),
    coalesce((select settings.interval_minutes from public.therapist_service_booking_settings as settings where settings.service_id = v_booking.service_id), 30)
  into v_min_notice, v_horizon_days, v_step;

  return query
  with local_days as (
    select generated.local_day::date as local_day
    from pg_catalog.generate_series(
      (p_range_start at time zone v_booking.timezone)::date - 1,
      (p_range_end at time zone v_booking.timezone)::date + 1,
      interval '1 day'
    ) as generated(local_day)
  ),
  rule_windows as (
    select
      local_day.local_day + rule.start_time as local_start,
      local_day.local_day + rule.end_time as local_end
    from local_days as local_day
    join public.availability_rules as rule
      on rule.therapist_profile_id = v_booking.therapist_profile_id
     and rule.service_id = v_booking.service_id
     and rule.is_active
     and rule.day_of_week = extract(dow from local_day.local_day)::integer
  ),
  available_exception_windows as (
    select
      exception.starts_at at time zone v_booking.timezone as local_start,
      exception.ends_at at time zone v_booking.timezone as local_end
    from public.availability_exceptions as exception
    where exception.therapist_profile_id = v_booking.therapist_profile_id
      and exception.is_available
      and coalesce(exception.status, 'active') = 'active'
      and (exception.service_id is null or exception.service_id = v_booking.service_id)
      and exception.starts_at < p_range_end
      and exception.ends_at > p_range_start
  ),
  source_windows as (
    select local_start, local_end from rule_windows
    union
    select local_start, local_end from available_exception_windows
  ),
  local_candidates as (
    select generated.local_starts_at::timestamp as local_starts_at
    from source_windows as source_window
    cross join lateral pg_catalog.generate_series(
      source_window.local_start,
      source_window.local_end
        - (v_booking.service_duration_minutes_snapshot
          + v_booking.buffer_after_minutes_snapshot) * interval '1 minute',
      v_step * interval '1 minute'
    ) as generated(local_starts_at)
    where source_window.local_start <= source_window.local_end
      - (v_booking.service_duration_minutes_snapshot
        + v_booking.buffer_after_minutes_snapshot) * interval '1 minute'
  ),
  utc_candidates as (
    select distinct
      candidate.local_starts_at at time zone v_booking.timezone as starts_at,
      (candidate.local_starts_at at time zone v_booking.timezone)
        + v_booking.service_duration_minutes_snapshot * interval '1 minute' as ends_at,
      candidate.local_starts_at
    from local_candidates as candidate
  )
  select
    candidate.starts_at,
    candidate.ends_at,
    v_booking.timezone,
    pg_catalog.tstzrange(
      candidate.starts_at
        - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
      candidate.ends_at
        + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
      '[)'
    )
  from utc_candidates as candidate
  where candidate.starts_at >= p_range_start
    and candidate.ends_at <= p_range_end
    and candidate.starts_at >= p_reference_at + v_min_notice * interval '1 minute'
    and candidate.starts_at < p_reference_at + v_horizon_days * interval '1 day'
    and (candidate.starts_at at time zone v_booking.timezone) = candidate.local_starts_at
    and not exists (
      select 1
      from public.availability_exceptions as exception
      where exception.therapist_profile_id = v_booking.therapist_profile_id
        and not exception.is_available
        and coalesce(exception.status, 'active') = 'active'
        and (exception.service_id is null or exception.service_id = v_booking.service_id)
        and pg_catalog.tstzrange(exception.starts_at, exception.ends_at, '[)')
          && pg_catalog.tstzrange(
            candidate.starts_at
              - v_booking.buffer_before_minutes_snapshot * interval '1 minute',
            candidate.ends_at
              + v_booking.buffer_after_minutes_snapshot * interval '1 minute',
            '[)'
          )
    )
  order by candidate.starts_at
  limit p_limit;
end;
$$;

create or replace function public.get_booking_reschedule_availability_v1(
  p_booking_id uuid,
  p_actor_profile_id uuid,
  p_scope text default 'next',
  p_anchor date default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_horizon_ends_at timestamptz;
  v_horizon_days integer;
  v_range_end timestamptz;
  v_range_start timestamptz;
  v_therapy_name text;
begin
  if p_scope not in ('next', 'month', 'day')
    or p_limit not between 1 and 1000
    or (p_scope in ('month', 'day') and p_anchor is null)
  then
    raise exception 'INVALID_RESCHEDULE_RANGE' using errcode = '22023';
  end if;

  if not public.is_booking_participant_profile_v1(
    p_booking_id,
    p_actor_profile_id
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
    and booking.status = 'confirmed';

  if not found then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  select therapy.name into v_therapy_name
  from public.therapist_services as service
  join public.therapies as therapy on therapy.id = service.therapy_id
  where service.id = v_booking.service_id;

  if not found then
    raise exception 'BOOKING_CANNOT_BE_RESCHEDULED' using errcode = 'P0001';
  end if;

  select coalesce(
    (select settings.max_days_ahead
      from public.therapist_service_booking_settings as settings
      where settings.service_id = v_booking.service_id),
    90
  ) into v_horizon_days;

  v_horizon_ends_at := now() + v_horizon_days * interval '1 day';

  if p_scope = 'day' then
    v_range_start := greatest(
      now(),
      p_anchor::timestamp at time zone v_booking.timezone
    );
    v_range_end := least(
      (p_anchor + 1)::timestamp at time zone v_booking.timezone,
      v_horizon_ends_at
    );
  elsif p_scope = 'month' then
    v_range_start := greatest(
      now(),
      date_trunc('month', p_anchor)::timestamp at time zone v_booking.timezone
    );
    v_range_end := least(
      (date_trunc('month', p_anchor) + interval '1 month')::timestamp
        at time zone v_booking.timezone,
      v_horizon_ends_at
    );
  else
    v_range_start := now();
    v_range_end := v_horizon_ends_at;
  end if;

  return pg_catalog.jsonb_build_object(
    'contractVersion', 1,
    'booking', pg_catalog.jsonb_build_object(
      'id', v_booking.id,
      'version', v_booking.version,
      'startsAt', v_booking.starts_at
    ),
    'service', pg_catalog.jsonb_build_object(
      'id', v_booking.service_id,
      'title', v_booking.service_title_snapshot,
      'therapyName', v_therapy_name,
      'durationMinutes', v_booking.service_duration_minutes_snapshot,
      'priceCents', v_booking.service_price_cents_snapshot,
      'currency', v_booking.currency_snapshot
    ),
    'timezone', v_booking.timezone,
    'horizonEndsAt', v_horizon_ends_at,
    'scope', p_scope,
    'range', pg_catalog.jsonb_build_object(
      'start', v_range_start,
      'end', v_range_end,
      'endExclusive', true
    ),
    'slots', case
      when v_range_start >= v_range_end then '[]'::jsonb
      else (
        select coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'startsAt', available.starts_at,
              'endsAt', available.ends_at
            ) order by available.starts_at
          ),
          '[]'::jsonb
        )
        from (
          select candidate.starts_at, candidate.ends_at
          from public.list_booking_reschedule_candidates_v1(
            v_booking.id,
            v_range_start,
            v_range_end,
            now(),
            5000
          ) as candidate
          where candidate.starts_at is distinct from v_booking.starts_at
            and not exists (
              select 1
              from public.bookings as conflict
              where conflict.therapist_profile_id = v_booking.therapist_profile_id
                and conflict.id <> v_booking.id
                and conflict.status in ('draft', 'pending_payment', 'confirmed')
                and conflict.occupied_during && candidate.occupied_during
            )
            and not exists (
              select 1
              from public.booking_holds as hold
              where hold.therapist_profile_id = v_booking.therapist_profile_id
                and hold.status = 'active'
                and hold.expires_at > now()
                and hold.occupied_during && candidate.occupied_during
            )
            and not public.patient_has_schedule_conflict_v1(
              v_booking.patient_profile_id,
              candidate.starts_at,
              candidate.ends_at,
              v_booking.id
            )
          order by candidate.starts_at
          limit p_limit
        ) as available
      )
    end
  );
end;
$$;

create or replace function public.validate_booking_reschedule_request_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
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
      'tes:patient-schedule:' || v_booking.patient_profile_id::text,
      0
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
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
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
    raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
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

drop trigger if exists validate_booking_reschedule_request
  on public.booking_reschedule_requests;
create trigger validate_booking_reschedule_request
before insert on public.booking_reschedule_requests
for each row execute function public.validate_booking_reschedule_request_v1();

create or replace function public.validate_applied_booking_reschedule_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is not distinct from old.starts_at
    or pg_catalog.current_setting('tes.booking_source', true)
      is distinct from 'reschedule_resolution'
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tes:patient-schedule:' || new.patient_profile_id::text,
      0
    )
  );

  if not exists (
    select 1
    from public.list_booking_reschedule_candidates_v1(
      old.id,
      new.starts_at,
      new.ends_at + interval '1 microsecond',
      now(),
      10
    ) as candidate
    where candidate.starts_at = new.starts_at
      and candidate.ends_at = new.ends_at
      and candidate.timezone = new.timezone
  ) then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists a20_validate_applied_booking_reschedule on public.bookings;
create trigger a20_validate_applied_booking_reschedule
before update of starts_at, ends_at, timezone on public.bookings
for each row execute function public.validate_applied_booking_reschedule_v1();

create or replace function public.invalidate_booking_reschedule_request_v1(
  p_reschedule_request_id uuid,
  p_actor_profile_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_request public.booking_reschedule_requests%rowtype;
begin
  if length(trim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_request
  from public.booking_reschedule_requests
  where id = p_reschedule_request_id
  for update;

  if not found then
    raise exception 'BOOKING_RESCHEDULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_booking from public.bookings where id = v_request.booking_id;

  if not public.is_booking_participant_profile_v1(
    v_request.booking_id,
    p_actor_profile_id
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_request.status = 'pending' then
    update public.booking_reschedule_requests
    set status = 'expired',
        resolved_by_profile_id = p_actor_profile_id,
        resolution_request_id = trim(p_request_id),
        resolved_at = now(),
        updated_at = now()
    where id = v_request.id
    returning * into v_request;

  end if;

  return pg_catalog.jsonb_build_object(
    'applied', false,
    'bookingId', v_booking.id,
    'bookingVersion', v_booking.version,
    'rescheduleRequestId', v_request.id,
    'status', v_request.status
  );
end;
$$;

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
  set status = 'expired', resolved_at = p_now, updated_at = p_now
  where status = 'pending' and expires_at <= p_now;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

create or replace function public.emit_expired_booking_reschedule_event_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.booking_status;
begin
  if old.status <> 'pending' or new.status <> 'expired' then
    return new;
  end if;

  select status into v_status
  from public.bookings
  where id = new.booking_id;

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, request_id, source,
    previous_status, next_status, payload
  ) values (
    new.booking_id, new.resolved_by_profile_id, 'booking_reschedule_resolved',
    'reschedule-expired:' || new.id::text,
    'agenda_a2_expiry', v_status, v_status,
    pg_catalog.jsonb_build_object(
      'rescheduleRequestId', new.id,
      'resolution', 'expired',
      'status', 'expired'
    )
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists emit_expired_booking_reschedule_event
  on public.booking_reschedule_requests;
create trigger emit_expired_booking_reschedule_event
after update of status on public.booking_reschedule_requests
for each row execute function public.emit_expired_booking_reschedule_event_v1();

create or replace function public.notify_booking_lifecycle_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_requester_user_id uuid;
  v_therapist_user_id uuid;
  v_status text;
begin
  if not (
    (new.event_type = 'booking_status_changed'
      and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded'))
    or new.event_type in ('booking_reschedule_requested', 'booking_reschedule_resolved')
  ) then
    return new;
  end if;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if new.event_type like 'booking_reschedule_%' then
    select requested_by_profile_id into v_requester_user_id
    from public.booking_reschedule_requests
    where id = (new.payload ->> 'rescheduleRequestId')::uuid;
  end if;

  if new.event_type = 'booking_status_changed' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_cancelled_patient', 'Seu encontro foi cancelado',
        'O cancelamento foi concluído. Consulte os detalhes atualizados.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_cancelled_therapist', 'Sessão cancelada',
        'O cancelamento foi concluído e sua agenda foi atualizada.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
    return new;
  end if;

  v_status := coalesce(new.payload ->> 'status', 'pending');

  if new.event_type = 'booking_reschedule_requested' then
    if v_requester_user_id = v_patient_user_id then
      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values (v_therapist_user_id, 'booking_reschedule_requested_therapist',
        'Nova proposta de reagendamento',
        'Uma pessoa propôs outro horário para a sessão. Revise a solicitação.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    else
      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values (v_patient_user_id, 'booking_reschedule_requested_patient',
        'Nova proposta de reagendamento',
        'Sua terapeuta propôs outro horário para o encontro. Revise a solicitação.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    end if;
  elsif v_status = 'applied' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_rescheduled_patient', 'Encontro reagendado',
        'O novo horário foi confirmado. Consulte os detalhes atualizados.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_rescheduled_therapist', 'Sessão reagendada',
        'O novo horário foi confirmado e sua agenda foi atualizada.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'rejected' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      v_requester_user_id,
      case when v_requester_user_id = v_patient_user_id
        then 'booking_reschedule_rejected_patient'
        else 'booking_reschedule_rejected_therapist' end,
      'Proposta de reagendamento recusada',
      'A proposta não foi aceita. O horário original permanece confirmado.',
      case when v_requester_user_id = v_patient_user_id
        then '/app/encontros/' || new.booking_id::text
        else '/terapeuta/sessoes/' || new.booking_id::text end,
      'booking-event:' || new.id::text || ':' || v_requester_user_id::text
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'cancelled' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values (
      case when v_requester_user_id = v_patient_user_id
        then v_therapist_user_id else v_patient_user_id end,
      case when v_requester_user_id = v_patient_user_id
        then 'booking_reschedule_withdrawn_therapist'
        else 'booking_reschedule_withdrawn_patient' end,
      'Proposta de reagendamento retirada',
      'A proposta foi retirada. O horário original permanece confirmado.',
      case when v_requester_user_id = v_patient_user_id
        then '/terapeuta/sessoes/' || new.booking_id::text
        else '/app/encontros/' || new.booking_id::text end,
      'booking-event:' || new.id::text || ':counterparty'
    ) on conflict (profile_id, event_key) where event_key is not null do nothing;
  elsif v_status = 'expired' then
    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (v_patient_user_id, 'booking_reschedule_expired_patient',
        'Proposta de reagendamento encerrada',
        'A proposta expirou ou o horário deixou de estar disponível. O horário original permanece confirmado.',
        '/app/encontros/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':patient'),
      (v_therapist_user_id, 'booking_reschedule_expired_therapist',
        'Proposta de reagendamento encerrada',
        'A proposta expirou ou o horário deixou de estar disponível. O horário original permanece confirmado.',
        '/terapeuta/sessoes/' || new.booking_id::text,
        'booking-event:' || new.id::text || ':therapist')
    on conflict (profile_id, event_key) where event_key is not null do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_booking_lifecycle on public.booking_events;
create trigger notify_booking_lifecycle
after insert on public.booking_events
for each row execute function public.notify_booking_lifecycle_v1();

insert into public.email_action_definitions (
  action_key, category, label, description, active, default_template_version
)
values
  ('booking_reschedule_requested_patient', 'bookings', 'Proposta recebida — pessoa', 'Avisa a pessoa sobre uma proposta de novo horário.', true, 'v1'),
  ('booking_reschedule_requested_therapist', 'bookings', 'Proposta recebida — terapeuta', 'Avisa a terapeuta sobre uma proposta de novo horário.', true, 'v1'),
  ('booking_reschedule_rejected_patient', 'bookings', 'Proposta recusada — pessoa', 'Avisa a pessoa solicitante sobre a recusa.', true, 'v1'),
  ('booking_reschedule_rejected_therapist', 'bookings', 'Proposta recusada — terapeuta', 'Avisa a terapeuta solicitante sobre a recusa.', true, 'v1'),
  ('booking_reschedule_withdrawn_patient', 'bookings', 'Proposta retirada — pessoa', 'Avisa a pessoa quando a contraparte retira a proposta.', true, 'v1'),
  ('booking_reschedule_withdrawn_therapist', 'bookings', 'Proposta retirada — terapeuta', 'Avisa a terapeuta quando a contraparte retira a proposta.', true, 'v1'),
  ('booking_reschedule_expired_patient', 'bookings', 'Proposta encerrada — pessoa', 'Avisa a pessoa quando a proposta expira ou perde disponibilidade.', true, 'v1'),
  ('booking_reschedule_expired_therapist', 'bookings', 'Proposta encerrada — terapeuta', 'Avisa a terapeuta quando a proposta expira ou perde disponibilidade.', true, 'v1')
on conflict (action_key) do update
set active = excluded.active,
    label = excluded.label,
    description = excluded.description,
    default_template_version = excluded.default_template_version;

create or replace function public.enqueue_booking_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_requester_user_id uuid;
  v_patient_action_key text;
  v_therapist_action_key text;
  v_status text;
begin
  if new.event_type = 'booking_created' and new.next_status::text = 'confirmed' then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    return new;
  end if;

  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = new.booking_id;

  if new.event_type like 'booking_reschedule_%' then
    select requested_by_profile_id into v_requester_user_id
    from public.booking_reschedule_requests
    where id = (new.payload ->> 'rescheduleRequestId')::uuid;
  end if;

  if new.event_type = 'booking_status_changed'
    and new.next_status::text = 'confirmed'
  then
    perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
    v_patient_action_key := 'booking_confirmed_patient';
    v_therapist_action_key := 'booking_confirmed_therapist';
  elsif new.event_type = 'booking_status_changed'
    and new.next_status::text in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
  then
    perform public.cancel_booking_reminder_jobs_v1(new.booking_id, 'booking_status_changed');
    v_patient_action_key := 'booking_cancelled_patient';
    v_therapist_action_key := 'booking_cancelled_therapist';
  elsif new.event_type = 'booking_reschedule_requested' then
    if v_requester_user_id = v_patient_user_id then
      v_therapist_action_key := 'booking_reschedule_requested_therapist';
    else
      v_patient_action_key := 'booking_reschedule_requested_patient';
    end if;
  elsif new.event_type = 'booking_reschedule_resolved' then
    v_status := new.payload ->> 'status';
    if v_status = 'applied' then
      perform public.cancel_booking_reminder_jobs_v1(new.booking_id, 'booking_rescheduled');
      perform public.schedule_booking_reminder_jobs_v1(new.booking_id);
      v_patient_action_key := 'booking_rescheduled_patient';
      v_therapist_action_key := 'booking_rescheduled_therapist';
    elsif v_status = 'rejected' then
      if v_requester_user_id = v_patient_user_id then
        v_patient_action_key := 'booking_reschedule_rejected_patient';
      else
        v_therapist_action_key := 'booking_reschedule_rejected_therapist';
      end if;
    elsif v_status = 'cancelled' then
      if v_requester_user_id = v_patient_user_id then
        v_therapist_action_key := 'booking_reschedule_withdrawn_therapist';
      else
        v_patient_action_key := 'booking_reschedule_withdrawn_patient';
      end if;
    elsif v_status = 'expired' then
      v_patient_action_key := 'booking_reschedule_expired_patient';
      v_therapist_action_key := 'booking_reschedule_expired_therapist';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_patient_action_key is not null and v_patient_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_patient_action_key, new.id, 'booking', new.booking_id,
      v_patient_user_id, 'profile:' || v_patient_user_id::text, '{}'::jsonb
    );
  end if;

  if v_therapist_action_key is not null and v_therapist_user_id is not null then
    perform public.enqueue_transactional_email_v1(
      v_therapist_action_key, new.id, 'booking', new.booking_id,
      v_therapist_user_id, 'profile:' || v_therapist_user_id::text, '{}'::jsonb
    );
  end if;

  return new;
end;
$$;

revoke all on function public.list_booking_reschedule_candidates_v1(
  uuid, timestamptz, timestamptz, timestamptz, integer
) from public, anon, authenticated;
revoke all on function public.get_booking_reschedule_availability_v1(
  uuid, uuid, text, date, integer
) from public, anon, authenticated;
revoke all on function public.invalidate_booking_reschedule_request_v1(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.validate_booking_reschedule_request_v1()
  from public, anon, authenticated;
revoke all on function public.validate_applied_booking_reschedule_v1()
  from public, anon, authenticated;
revoke all on function public.notify_booking_lifecycle_v1()
  from public, anon, authenticated;
revoke all on function public.emit_expired_booking_reschedule_event_v1()
  from public, anon, authenticated;

grant execute on function public.list_booking_reschedule_candidates_v1(
  uuid, timestamptz, timestamptz, timestamptz, integer
) to service_role;
grant execute on function public.get_booking_reschedule_availability_v1(
  uuid, uuid, text, date, integer
) to service_role;
grant execute on function public.invalidate_booking_reschedule_request_v1(
  uuid, uuid, text
) to service_role;

comment on function public.get_booking_reschedule_availability_v1(
  uuid, uuid, text, date, integer
) is 'Participant-authorized availability for one existing booking. It fixes the original service and booking snapshots while applying current schedule rules and patient/therapist conflicts.';
comment on function public.invalidate_booking_reschedule_request_v1(
  uuid, uuid, text
) is 'Closes a pending proposal whose slot became unavailable without moving or releasing the original booking.';
