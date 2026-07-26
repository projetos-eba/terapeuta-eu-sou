-- Agenda A2: authoritative booking snapshots, holds, conflict protection,
-- lifecycle invariants, and audit-ready reschedule requests.

create extension if not exists btree_gist;

do $$
begin
  create type public.booking_hold_status as enum (
    'active',
    'cancelled',
    'consumed',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.bookings
  add column if not exists service_title_snapshot text,
  add column if not exists service_duration_minutes_snapshot integer,
  add column if not exists service_price_cents_snapshot integer,
  add column if not exists currency_snapshot char(3),
  add column if not exists buffer_before_minutes_snapshot integer,
  add column if not exists buffer_after_minutes_snapshot integer,
  add column if not exists occupied_during tstzrange,
  add column if not exists snapshot_captured_at timestamptz,
  add column if not exists version integer not null default 1,
  add column if not exists last_transition_at timestamptz;

update public.bookings as booking
set service_title_snapshot = coalesce(
      booking.service_title_snapshot,
      service.title
    ),
    service_duration_minutes_snapshot = coalesce(
      booking.service_duration_minutes_snapshot,
      greatest(
        1,
        round(
          extract(epoch from (booking.ends_at - booking.starts_at)) / 60
        )::integer
      )
    ),
    service_price_cents_snapshot = coalesce(
      booking.service_price_cents_snapshot,
      (
        select session_payment.gross_amount_cents
        from public.session_payments as session_payment
        where session_payment.booking_id = booking.id
      ),
      service.price_cents
    ),
    currency_snapshot = coalesce(
      booking.currency_snapshot,
      (
        select session_payment.currency
        from public.session_payments as session_payment
        where session_payment.booking_id = booking.id
      ),
      service.currency
    ),
    buffer_before_minutes_snapshot = coalesce(
      booking.buffer_before_minutes_snapshot,
      booking_settings.buffer_before_minutes,
      10
    ),
    buffer_after_minutes_snapshot = coalesce(
      booking.buffer_after_minutes_snapshot,
      booking_settings.buffer_after_minutes,
      10
    ),
    occupied_during = coalesce(
      booking.occupied_during,
      pg_catalog.tstzrange(
        booking.starts_at
          - coalesce(
              booking.buffer_before_minutes_snapshot,
              booking_settings.buffer_before_minutes,
              10
            ) * interval '1 minute',
        booking.ends_at
          + coalesce(
              booking.buffer_after_minutes_snapshot,
              booking_settings.buffer_after_minutes,
              10
            ) * interval '1 minute',
        '[)'
      )
    ),
    snapshot_captured_at = coalesce(
      booking.snapshot_captured_at,
      booking.created_at,
      now()
    )
from public.therapist_services as service
left join public.therapist_service_booking_settings as booking_settings
  on booking_settings.service_id = service.id
where service.id = booking.service_id
  and (
    booking.service_title_snapshot is null
    or booking.service_duration_minutes_snapshot is null
    or booking.service_price_cents_snapshot is null
    or booking.currency_snapshot is null
    or booking.buffer_before_minutes_snapshot is null
    or booking.buffer_after_minutes_snapshot is null
    or booking.occupied_during is null
    or booking.snapshot_captured_at is null
  );

alter table public.bookings
  alter column service_title_snapshot set not null,
  alter column service_duration_minutes_snapshot set not null,
  alter column service_price_cents_snapshot set not null,
  alter column currency_snapshot set not null,
  alter column buffer_before_minutes_snapshot set not null,
  alter column buffer_after_minutes_snapshot set not null,
  alter column occupied_during set not null,
  alter column snapshot_captured_at set not null;

alter table public.bookings
  drop constraint if exists bookings_snapshot_values_valid;
alter table public.bookings
  add constraint bookings_snapshot_values_valid check (
    length(trim(service_title_snapshot)) > 0
    and service_duration_minutes_snapshot > 0
    and service_price_cents_snapshot >= 0
    and currency_snapshot = upper(currency_snapshot)
    and buffer_before_minutes_snapshot >= 0
    and buffer_after_minutes_snapshot >= 0
    and not isempty(occupied_during)
    and lower_inc(occupied_during)
    and not upper_inc(occupied_during)
    and version > 0
  );

create or replace function public.prepare_booking_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.therapist_services%rowtype;
  v_buffer_before integer;
  v_buffer_after integer;
begin
  select *
    into v_service
  from public.therapist_services
  where id = new.service_id;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_service.therapist_profile_id <> new.therapist_profile_id then
    raise exception 'SERVICE_THERAPIST_MISMATCH' using errcode = '23514';
  end if;

  select
    coalesce(settings.buffer_before_minutes, 10),
    coalesce(settings.buffer_after_minutes, 10)
  into v_buffer_before, v_buffer_after
  from (select 1) as anchor
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = v_service.id;

  new.service_title_snapshot := coalesce(
    nullif(trim(new.service_title_snapshot), ''),
    v_service.title
  );
  new.service_duration_minutes_snapshot := coalesce(
    new.service_duration_minutes_snapshot,
    v_service.duration_minutes
  );
  new.service_price_cents_snapshot := coalesce(
    new.service_price_cents_snapshot,
    v_service.price_cents
  );
  new.currency_snapshot := upper(
    coalesce(new.currency_snapshot, v_service.currency)
  );
  new.buffer_before_minutes_snapshot := coalesce(
    new.buffer_before_minutes_snapshot,
    v_buffer_before
  );
  new.buffer_after_minutes_snapshot := coalesce(
    new.buffer_after_minutes_snapshot,
    v_buffer_after
  );
  new.occupied_during := pg_catalog.tstzrange(
    new.starts_at
      - new.buffer_before_minutes_snapshot * interval '1 minute',
    new.ends_at
      + new.buffer_after_minutes_snapshot * interval '1 minute',
    '[)'
  );
  new.snapshot_captured_at := coalesce(new.snapshot_captured_at, now());
  new.version := coalesce(new.version, 1);

  return new;
end;
$$;

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
      'pending_payment',
      'cancelled_by_patient'
    )
    when 'pending_payment' then p_next in (
      'confirmed',
      'cancelled_by_patient',
      'refunded'
    )
    when 'confirmed' then p_next in (
      'completed',
      'cancelled_by_patient',
      'cancelled_by_therapist',
      'no_show_patient',
      'no_show_therapist',
      'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'no_show_patient' then p_next = 'refunded'
    when 'no_show_therapist' then p_next = 'refunded'
    when 'refunded' then false
    else false
  end;
$$;

create or replace function public.enforce_booking_lifecycle_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operational_change boolean;
begin
  if new.patient_profile_id <> old.patient_profile_id
    or new.therapist_profile_id <> old.therapist_profile_id
    or new.service_id <> old.service_id then
    raise exception 'BOOKING_PARTICIPANTS_IMMUTABLE' using errcode = '23514';
  end if;

  if new.service_title_snapshot <> old.service_title_snapshot
    or new.service_duration_minutes_snapshot <> old.service_duration_minutes_snapshot
    or new.service_price_cents_snapshot <> old.service_price_cents_snapshot
    or new.currency_snapshot <> old.currency_snapshot
    or new.buffer_before_minutes_snapshot <> old.buffer_before_minutes_snapshot
    or new.buffer_after_minutes_snapshot <> old.buffer_after_minutes_snapshot
    or new.snapshot_captured_at <> old.snapshot_captured_at then
    raise exception 'BOOKING_SNAPSHOT_IMMUTABLE' using errcode = '23514';
  end if;

  if new.status <> old.status
    and not public.is_booking_status_transition_allowed_v1(
      old.status,
      new.status
    ) then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  v_operational_change :=
    new.status <> old.status
    or new.starts_at <> old.starts_at
    or new.ends_at <> old.ends_at
    or new.timezone <> old.timezone;

  if new.starts_at <> old.starts_at or new.ends_at <> old.ends_at then
    new.occupied_during := pg_catalog.tstzrange(
      new.starts_at
        - new.buffer_before_minutes_snapshot * interval '1 minute',
      new.ends_at
        + new.buffer_after_minutes_snapshot * interval '1 minute',
      '[)'
    );
  elsif new.occupied_during <> old.occupied_during then
    raise exception 'BOOKING_OCCUPIED_RANGE_IMMUTABLE'
      using errcode = '23514';
  end if;

  new.version := case
    when v_operational_change then old.version + 1
    else old.version
  end;

  if new.status <> old.status then
    new.last_transition_at := now();
  else
    new.last_transition_at := old.last_transition_at;
  end if;

  if new.status in ('cancelled_by_patient', 'cancelled_by_therapist')
    and old.status <> new.status then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists a10_prepare_booking_snapshot
on public.bookings;
create trigger a10_prepare_booking_snapshot
before insert on public.bookings
for each row execute function public.prepare_booking_snapshot_v1();

drop trigger if exists a20_enforce_booking_lifecycle
on public.bookings;
create trigger a20_enforce_booking_lifecycle
before update on public.bookings
for each row execute function public.enforce_booking_lifecycle_v1();

create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid not null
    references public.patient_profiles (id) on delete restrict,
  therapist_profile_id uuid not null
    references public.therapist_profiles (id) on delete restrict,
  service_id uuid not null
    references public.therapist_services (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status public.booking_hold_status not null default 'active',
  idempotency_key text not null unique,
  consume_idempotency_key text unique,
  expires_at timestamptz not null,
  consumed_booking_id uuid unique
    references public.bookings (id) on delete set null,
  service_title_snapshot text not null,
  service_duration_minutes_snapshot integer not null,
  service_price_cents_snapshot integer not null,
  currency_snapshot char(3) not null,
  buffer_before_minutes_snapshot integer not null,
  buffer_after_minutes_snapshot integer not null,
  occupied_during tstzrange not null,
  snapshot_captured_at timestamptz not null default now(),
  cancelled_at timestamptz,
  consumed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_holds_valid_range check (starts_at < ends_at),
  constraint booking_holds_valid_expiry check (expires_at > created_at),
  constraint booking_holds_idempotency_key_not_blank check (
    length(trim(idempotency_key)) between 8 and 200
  ),
  constraint booking_holds_snapshot_values_valid check (
    length(trim(service_title_snapshot)) > 0
    and service_duration_minutes_snapshot > 0
    and service_price_cents_snapshot >= 0
    and currency_snapshot = upper(currency_snapshot)
    and buffer_before_minutes_snapshot >= 0
    and buffer_after_minutes_snapshot >= 0
    and not isempty(occupied_during)
    and lower_inc(occupied_during)
    and not upper_inc(occupied_during)
    and version > 0
  )
);

create index if not exists booking_holds_patient_created_idx
on public.booking_holds (patient_profile_id, created_at desc);

create index if not exists booking_holds_therapist_status_expiry_idx
on public.booking_holds (therapist_profile_id, status, expires_at);

create index if not exists booking_holds_active_expiry_idx
on public.booking_holds (expires_at)
where status = 'active';

drop trigger if exists set_booking_holds_updated_at
on public.booking_holds;
create trigger set_booking_holds_updated_at
before update on public.booking_holds
for each row execute function public.set_updated_at();

create or replace function public.prepare_booking_hold_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.therapist_services%rowtype;
  v_buffer_before integer;
  v_buffer_after integer;
begin
  select *
    into v_service
  from public.therapist_services
  where id = new.service_id;

  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_service.therapist_profile_id <> new.therapist_profile_id then
    raise exception 'SERVICE_THERAPIST_MISMATCH' using errcode = '23514';
  end if;

  select
    coalesce(settings.buffer_before_minutes, 10),
    coalesce(settings.buffer_after_minutes, 10)
  into v_buffer_before, v_buffer_after
  from (select 1) as anchor
  left join public.therapist_service_booking_settings as settings
    on settings.service_id = v_service.id;

  new.service_title_snapshot := coalesce(
    nullif(trim(new.service_title_snapshot), ''),
    v_service.title
  );
  new.service_duration_minutes_snapshot := coalesce(
    new.service_duration_minutes_snapshot,
    v_service.duration_minutes
  );
  new.service_price_cents_snapshot := coalesce(
    new.service_price_cents_snapshot,
    v_service.price_cents
  );
  new.currency_snapshot := upper(
    coalesce(new.currency_snapshot, v_service.currency)
  );
  new.buffer_before_minutes_snapshot := coalesce(
    new.buffer_before_minutes_snapshot,
    v_buffer_before
  );
  new.buffer_after_minutes_snapshot := coalesce(
    new.buffer_after_minutes_snapshot,
    v_buffer_after
  );
  new.occupied_during := pg_catalog.tstzrange(
    new.starts_at
      - new.buffer_before_minutes_snapshot * interval '1 minute',
    new.ends_at
      + new.buffer_after_minutes_snapshot * interval '1 minute',
    '[)'
  );
  new.snapshot_captured_at := coalesce(new.snapshot_captured_at, now());
  new.version := coalesce(new.version, 1);

  return new;
end;
$$;

create or replace function public.enforce_booking_hold_lifecycle_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.patient_profile_id <> old.patient_profile_id
    or new.therapist_profile_id <> old.therapist_profile_id
    or new.service_id <> old.service_id
    or new.starts_at <> old.starts_at
    or new.ends_at <> old.ends_at
    or new.timezone <> old.timezone
    or new.idempotency_key <> old.idempotency_key
    or new.expires_at <> old.expires_at
    or new.service_title_snapshot <> old.service_title_snapshot
    or new.service_duration_minutes_snapshot <> old.service_duration_minutes_snapshot
    or new.service_price_cents_snapshot <> old.service_price_cents_snapshot
    or new.currency_snapshot <> old.currency_snapshot
    or new.buffer_before_minutes_snapshot <> old.buffer_before_minutes_snapshot
    or new.buffer_after_minutes_snapshot <> old.buffer_after_minutes_snapshot
    or new.occupied_during <> old.occupied_during
    or new.snapshot_captured_at <> old.snapshot_captured_at then
    raise exception 'BOOKING_HOLD_IMMUTABLE' using errcode = '23514';
  end if;

  if new.status <> old.status and not (
    old.status = 'active'
    and new.status in ('cancelled', 'consumed', 'expired')
  ) then
    raise exception 'INVALID_HOLD_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  if new.status = 'consumed' and old.status <> 'consumed' then
    new.consumed_at := coalesce(new.consumed_at, now());
  end if;

  new.version := case
    when new.status <> old.status
      or new.consumed_booking_id is distinct from old.consumed_booking_id
      then old.version + 1
    else old.version
  end;

  return new;
end;
$$;

drop trigger if exists a10_prepare_booking_hold_snapshot
on public.booking_holds;
create trigger a10_prepare_booking_hold_snapshot
before insert on public.booking_holds
for each row execute function public.prepare_booking_hold_snapshot_v1();

drop trigger if exists a20_enforce_booking_hold_lifecycle
on public.booking_holds;
create trigger a20_enforce_booking_hold_lifecycle
before update on public.booking_holds
for each row execute function public.enforce_booking_hold_lifecycle_v1();

create or replace function public.validate_booking_against_active_holds_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'pending_payment', 'confirmed') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );

  update public.booking_holds
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now();

  if exists (
    select 1
    from public.booking_holds as hold
    where hold.therapist_profile_id = new.therapist_profile_id
      and hold.status = 'active'
      and hold.expires_at > now()
      and hold.occupied_during && new.occupied_during
  ) then
    raise exception 'SLOT_HELD_BY_ANOTHER_USER' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.validate_hold_against_active_bookings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.therapist_profile_id::text, 0)
  );

  update public.booking_holds
  set status = 'expired',
      updated_at = now()
  where therapist_profile_id = new.therapist_profile_id
    and status = 'active'
    and expires_at <= now()
    and id <> new.id;

  if exists (
    select 1
    from public.bookings as booking
    where booking.therapist_profile_id = new.therapist_profile_id
      and booking.status in ('draft', 'pending_payment', 'confirmed')
      and booking.occupied_during && new.occupied_during
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists a30_validate_booking_against_active_holds
on public.bookings;
create trigger a30_validate_booking_against_active_holds
before insert or update of
  therapist_profile_id,
  starts_at,
  ends_at,
  status,
  buffer_before_minutes_snapshot,
  buffer_after_minutes_snapshot
on public.bookings
for each row execute function public.validate_booking_against_active_holds_v1();

drop trigger if exists a30_validate_hold_against_active_bookings
on public.booking_holds;
create trigger a30_validate_hold_against_active_bookings
before insert or update of
  therapist_profile_id,
  starts_at,
  ends_at,
  status,
  buffer_before_minutes_snapshot,
  buffer_after_minutes_snapshot
on public.booking_holds
for each row execute function public.validate_hold_against_active_bookings_v1();

do $$
begin
  if exists (
    select 1
    from public.bookings as left_booking
    join public.bookings as right_booking
      on right_booking.therapist_profile_id = left_booking.therapist_profile_id
      and right_booking.id > left_booking.id
      and right_booking.status in ('draft', 'pending_payment', 'confirmed')
      and right_booking.occupied_during && left_booking.occupied_during
    where left_booking.status in ('draft', 'pending_payment', 'confirmed')
  ) then
    raise exception 'BOOKING_CONFLICT_EXISTING_DATA' using errcode = '23P01';
  end if;
end $$;

alter table public.bookings
  drop constraint if exists bookings_no_active_therapist_overlap;
alter table public.bookings
  add constraint bookings_no_active_therapist_overlap
  exclude using gist (
    therapist_profile_id with =,
    occupied_during with &&
  )
  where (status in ('draft', 'pending_payment', 'confirmed'))
  deferrable initially immediate;

alter table public.booking_holds
  drop constraint if exists booking_holds_no_active_therapist_overlap;
alter table public.booking_holds
  add constraint booking_holds_no_active_therapist_overlap
  exclude using gist (
    therapist_profile_id with =,
    occupied_during with &&
  )
  where (status = 'active')
  deferrable initially immediate;

alter table public.booking_events
  add column if not exists request_id text,
  add column if not exists source text not null default 'legacy',
  add column if not exists previous_status public.booking_status,
  add column if not exists next_status public.booking_status;

create unique index if not exists booking_events_request_id_unique_idx
on public.booking_events (booking_id, event_type, request_id)
where request_id is not null;

create or replace function public.audit_booking_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_reason text;
  v_request_id text;
  v_source text;
begin
  begin
    v_actor_profile_id := nullif(
      pg_catalog.current_setting('tes.booking_actor_profile_id', true),
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      v_actor_profile_id := null;
  end;

  v_reason := nullif(
    pg_catalog.current_setting('tes.booking_reason', true),
    ''
  );
  v_request_id := nullif(
    pg_catalog.current_setting('tes.booking_request_id', true),
    ''
  );
  v_source := coalesce(
    nullif(
      pg_catalog.current_setting('tes.booking_source', true),
      ''
    ),
    case
      when tg_op = 'UPDATE'
        and new.payment_status is distinct from old.payment_status
        then 'payment_state'
      else 'database'
    end
  );

  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id,
      actor_profile_id,
      event_type,
      request_id,
      source,
      previous_status,
      next_status,
      payload
    ) values (
      new.id,
      v_actor_profile_id,
      'booking_created',
      v_request_id,
      left(v_source, 80),
      null,
      new.status,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'reason', left(v_reason, 500),
          'version', new.version
        )
      )
    )
    on conflict do nothing;

    return new;
  end if;

  if new.status <> old.status then
    insert into public.booking_events (
      booking_id,
      actor_profile_id,
      event_type,
      request_id,
      source,
      previous_status,
      next_status,
      payload
    ) values (
      new.id,
      v_actor_profile_id,
      'booking_status_changed',
      v_request_id,
      left(v_source, 80),
      old.status,
      new.status,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'reason', left(v_reason, 500),
          'version', new.version
        )
      )
    )
    on conflict do nothing;
  end if;

  if new.starts_at <> old.starts_at
    or new.ends_at <> old.ends_at
    or new.timezone <> old.timezone then
    insert into public.booking_events (
      booking_id,
      actor_profile_id,
      event_type,
      request_id,
      source,
      previous_status,
      next_status,
      payload
    ) values (
      new.id,
      v_actor_profile_id,
      'booking_rescheduled',
      v_request_id,
      left(v_source, 80),
      old.status,
      new.status,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'previousStartsAt', old.starts_at,
          'previousEndsAt', old.ends_at,
          'previousTimezone', old.timezone,
          'startsAt', new.starts_at,
          'endsAt', new.ends_at,
          'timezone', new.timezone,
          'reason', left(v_reason, 500),
          'version', new.version
        )
      )
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists z90_audit_booking_insert
on public.bookings;
create trigger z90_audit_booking_insert
after insert on public.bookings
for each row execute function public.audit_booking_change_v1();

drop trigger if exists z90_audit_booking_update
on public.bookings;
create trigger z90_audit_booking_update
after update on public.bookings
for each row execute function public.audit_booking_change_v1();

alter table public.booking_reschedule_requests
  add column if not exists original_starts_at timestamptz,
  add column if not exists original_ends_at timestamptz,
  add column if not exists original_timezone text,
  add column if not exists proposed_timezone text,
  add column if not exists request_id text,
  add column if not exists resolution_request_id text,
  add column if not exists booking_version_at_request integer,
  add column if not exists expires_at timestamptz,
  add column if not exists applied_at timestamptz;

update public.booking_reschedule_requests as request
set original_starts_at = coalesce(
      request.original_starts_at,
      booking.starts_at
    ),
    original_ends_at = coalesce(
      request.original_ends_at,
      booking.ends_at
    ),
    original_timezone = coalesce(
      request.original_timezone,
      booking.timezone
    ),
    proposed_timezone = coalesce(
      request.proposed_timezone,
      booking.timezone
    ),
    booking_version_at_request = coalesce(
      request.booking_version_at_request,
      booking.version
    ),
    expires_at = coalesce(
      request.expires_at,
      request.created_at + interval '48 hours'
    )
from public.bookings as booking
where booking.id = request.booking_id
  and (
    request.original_starts_at is null
    or request.original_ends_at is null
    or request.original_timezone is null
    or request.proposed_timezone is null
    or request.booking_version_at_request is null
    or request.expires_at is null
  );

alter table public.booking_reschedule_requests
  alter column original_starts_at set not null,
  alter column original_ends_at set not null,
  alter column original_timezone set not null,
  alter column proposed_timezone set not null,
  alter column booking_version_at_request set not null,
  alter column expires_at set not null;

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_status;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_status check (
    status in (
      'pending',
      'accepted',
      'rejected',
      'cancelled',
      'expired',
      'applied'
    )
  );

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_original_range;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_original_range check (
    original_starts_at < original_ends_at
  );

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_version_positive;
alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_version_positive check (
    booking_version_at_request > 0
  );

create unique index if not exists booking_reschedule_requests_request_id_unique_idx
on public.booking_reschedule_requests (request_id)
where request_id is not null;

create unique index if not exists booking_reschedule_resolution_request_id_unique_idx
on public.booking_reschedule_requests (resolution_request_id)
where resolution_request_id is not null;

create unique index if not exists booking_reschedule_requests_one_pending_idx
on public.booking_reschedule_requests (booking_id)
where status = 'pending';

create index if not exists booking_reschedule_requests_pending_expiry_idx
on public.booking_reschedule_requests (expires_at)
where status = 'pending';

create or replace function public.prepare_booking_reschedule_request_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select *
    into v_booking
  from public.bookings
  where id = new.booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.patient_profiles as patient
    join public.therapist_profiles as therapist
      on therapist.id = v_booking.therapist_profile_id
    where patient.id = v_booking.patient_profile_id
      and new.requested_by_profile_id in (
        patient.user_id,
        therapist.user_id
      )
  ) then
    raise exception 'BOOKING_ACTOR_FORBIDDEN' using errcode = '42501';
  end if;

  new.original_starts_at := coalesce(
    new.original_starts_at,
    v_booking.starts_at
  );
  new.original_ends_at := coalesce(
    new.original_ends_at,
    v_booking.ends_at
  );
  new.original_timezone := coalesce(
    nullif(trim(new.original_timezone), ''),
    v_booking.timezone
  );
  new.proposed_timezone := coalesce(
    nullif(trim(new.proposed_timezone), ''),
    v_booking.timezone
  );
  new.booking_version_at_request := coalesce(
    new.booking_version_at_request,
    v_booking.version
  );
  new.expires_at := coalesce(
    new.expires_at,
    now() + interval '48 hours'
  );

  return new;
end;
$$;

drop trigger if exists a10_prepare_booking_reschedule_request
on public.booking_reschedule_requests;
create trigger a10_prepare_booking_reschedule_request
before insert on public.booking_reschedule_requests
for each row execute function public.prepare_booking_reschedule_request_v1();

alter table public.booking_holds enable row level security;

drop policy if exists "Patients can read own booking holds"
on public.booking_holds;
create policy "Patients can read own booking holds"
on public.booking_holds
for select
to authenticated
using (
  public.is_current_patient_profile(patient_profile_id)
);

drop policy if exists "Therapists can read own booking holds"
on public.booking_holds;
create policy "Therapists can read own booking holds"
on public.booking_holds
for select
to authenticated
using (
  public.is_current_therapist_profile(therapist_profile_id)
);

grant select on public.booking_holds to authenticated, service_role;
grant select on public.booking_reschedule_requests to service_role;

revoke insert, update, delete on public.booking_holds from anon, authenticated;
revoke insert, update, delete on public.booking_reschedule_requests
from anon, authenticated;

revoke all on function public.prepare_booking_snapshot_v1() from public;
revoke all on function public.is_booking_status_transition_allowed_v1(
  public.booking_status,
  public.booking_status
) from public;
revoke all on function public.enforce_booking_lifecycle_v1() from public;
revoke all on function public.prepare_booking_hold_snapshot_v1() from public;
revoke all on function public.enforce_booking_hold_lifecycle_v1() from public;
revoke all on function public.validate_booking_against_active_holds_v1()
from public;
revoke all on function public.validate_hold_against_active_bookings_v1()
from public;
revoke all on function public.audit_booking_change_v1() from public;
revoke all on function public.prepare_booking_reschedule_request_v1()
from public;

grant execute on function public.is_booking_status_transition_allowed_v1(
  public.booking_status,
  public.booking_status
) to authenticated, service_role;

comment on table public.booking_holds is
  'Short-lived, idempotent slot reservations. Holds are not bookings and never represent payment.';

comment on column public.bookings.service_price_cents_snapshot is
  'Service list price captured at reservation time. The charged amount remains canonical in session_payments.';

comment on constraint bookings_no_active_therapist_overlap
on public.bookings is
  'Prevents overlapping active bookings for one therapist across all services, including booking buffer snapshots.';

comment on function public.is_booking_status_transition_allowed_v1(
  public.booking_status,
  public.booking_status
) is
  'Canonical database guard matching the shared BookingStatus transition contract.';
