create extension if not exists pgcrypto;

do $$
begin
  create type public.video_session_status as enum (
    'ready',
    'active',
    'ended',
    'canceled',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.video_session_participant_role as enum (
    'patient',
    'therapist',
    'unknown'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.zoom_video_webhook_processing_status as enum (
    'received',
    'processing',
    'processed',
    'ignored',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.video_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  provider text not null default 'zoom_video_sdk',
  environment text not null,
  session_name text not null,
  session_key text,
  provider_session_id text,
  status public.video_session_status not null default 'ready',
  scheduled_starts_at timestamptz not null,
  scheduled_ends_at timestamptz not null,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  therapist_access_issued_at timestamptz,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_sessions_provider_check check (provider = 'zoom_video_sdk'),
  constraint video_sessions_environment_check check (
    environment in ('development', 'production')
  ),
  constraint video_sessions_valid_range check (scheduled_starts_at < scheduled_ends_at),
  constraint video_sessions_name_limited check (
    char_length(session_name) between 16 and 150
  ),
  constraint video_sessions_key_limited check (
    session_key is null or char_length(session_key) <= 36
  ),
  constraint video_sessions_error_message_limited check (
    last_error_message is null or char_length(last_error_message) <= 500
  )
);

create unique index if not exists video_sessions_environment_name_idx
on public.video_sessions (environment, lower(session_name));

create unique index if not exists video_sessions_environment_key_idx
on public.video_sessions (environment, session_key)
where session_key is not null;

create index if not exists video_sessions_status_idx
on public.video_sessions (status, scheduled_starts_at);

create index if not exists video_sessions_provider_session_idx
on public.video_sessions (environment, provider_session_id)
where provider_session_id is not null;

create table if not exists public.video_session_participations (
  id uuid primary key default gen_random_uuid(),
  video_session_id uuid not null references public.video_sessions (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  participant_correlation_key text not null,
  provider_user_id text,
  provider_user_key text,
  participant_role public.video_session_participant_role not null default 'unknown',
  event_type text not null,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_participations_user_key_limited check (
    provider_user_key is null or char_length(provider_user_key) <= 36
  ),
  constraint video_participations_duration_check check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create index if not exists video_participations_booking_idx
on public.video_session_participations (booking_id, created_at desc);

create index if not exists video_participations_correlation_idx
on public.video_session_participations (
  video_session_id,
  participant_correlation_key,
  created_at desc
);

create table if not exists public.zoom_video_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  account_identifier text,
  provider_session_id text,
  session_name_hash text,
  provider_user_id text,
  provider_user_key text,
  request_id text,
  event_ts timestamptz,
  payload_sha256 text not null,
  payload_sanitized jsonb not null default '{}'::jsonb,
  processing_status public.zoom_video_webhook_processing_status not null default 'received',
  attempts integer not null default 0,
  processing_started_at timestamptz,
  processed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_video_webhook_events_error_message_limited check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists zoom_video_webhook_events_status_idx
on public.zoom_video_webhook_events (processing_status, created_at);

create index if not exists zoom_video_webhook_events_session_idx
on public.zoom_video_webhook_events (provider_session_id, session_name_hash);

drop trigger if exists set_video_sessions_updated_at on public.video_sessions;
create trigger set_video_sessions_updated_at
before update on public.video_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_video_participations_updated_at
on public.video_session_participations;
create trigger set_video_participations_updated_at
before update on public.video_session_participations
for each row execute function public.set_updated_at();

drop trigger if exists set_zoom_video_webhook_events_updated_at
on public.zoom_video_webhook_events;
create trigger set_zoom_video_webhook_events_updated_at
before update on public.zoom_video_webhook_events
for each row execute function public.set_updated_at();

alter table public.video_sessions enable row level security;
alter table public.video_session_participations enable row level security;
alter table public.zoom_video_webhook_events enable row level security;

grant select (
  id,
  booking_id,
  provider,
  environment,
  status,
  scheduled_starts_at,
  scheduled_ends_at,
  actual_started_at,
  actual_ended_at,
  last_synced_at,
  created_at,
  updated_at
) on public.video_sessions to authenticated;
grant select (
  id,
  video_session_id,
  booking_id,
  participant_role,
  event_type,
  joined_at,
  left_at,
  duration_seconds,
  created_at,
  updated_at
) on public.video_session_participations to authenticated;
grant all on public.video_sessions to service_role;
grant all on public.video_session_participations to service_role;
grant all on public.zoom_video_webhook_events to service_role;

drop policy if exists "Booking participants can read safe video sessions"
on public.video_sessions;
create policy "Booking participants can read safe video sessions"
on public.video_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = video_sessions.booking_id
      and (
        public.is_current_patient_profile(bookings.patient_profile_id)
        or public.is_current_therapist_profile(bookings.therapist_profile_id)
      )
  )
);

drop policy if exists "Booking participants can read video participations"
on public.video_session_participations;
create policy "Booking participants can read video participations"
on public.video_session_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = video_session_participations.booking_id
      and (
        public.is_current_patient_profile(bookings.patient_profile_id)
        or public.is_current_therapist_profile(bookings.therapist_profile_id)
      )
  )
);

drop policy if exists "No direct authenticated access to zoom video webhooks"
on public.zoom_video_webhook_events;
create policy "No direct authenticated access to zoom video webhooks"
on public.zoom_video_webhook_events
for all
to authenticated
using (false)
with check (false);

create or replace view public.patient_video_session_summary_v
with (security_invoker = true)
as
select
  vs.id,
  vs.booking_id,
  vs.provider,
  vs.environment,
  vs.status,
  vs.scheduled_starts_at,
  vs.scheduled_ends_at,
  vs.actual_started_at,
  vs.actual_ended_at,
  vs.last_synced_at
from public.video_sessions vs
join public.bookings b on b.id = vs.booking_id
where public.is_current_patient_profile(b.patient_profile_id);

create or replace view public.therapist_video_session_summary_v
with (security_invoker = true)
as
select
  vs.id,
  vs.booking_id,
  vs.provider,
  vs.environment,
  vs.status,
  vs.scheduled_starts_at,
  vs.scheduled_ends_at,
  vs.actual_started_at,
  vs.actual_ended_at,
  vs.therapist_access_issued_at,
  vs.last_synced_at
from public.video_sessions vs
join public.bookings b on b.id = vs.booking_id
where public.is_current_therapist_profile(b.therapist_profile_id);

grant select on public.patient_video_session_summary_v to authenticated;
grant select on public.therapist_video_session_summary_v to authenticated;

create or replace function public.create_zoom_video_session_name_v1(
  p_booking_id uuid,
  p_environment text
)
returns text
language sql
volatile
set search_path = ''
as $$
  select lower(
    'tesvs-' ||
    left(
      encode(
        extensions.digest(
          p_environment || ':' || p_booking_id::text || ':' || gen_random_uuid()::text,
          'sha256'::text
        ),
        'hex'
      ),
      32
    )
  );
$$;

create or replace function public.create_zoom_video_session_key_v1(
  p_booking_id uuid,
  p_environment text
)
returns text
language sql
stable
set search_path = ''
as $$
  select left(
    encode(
      extensions.digest(
        'key:' || p_environment || ':' || p_booking_id::text,
        'sha256'::text
      ),
      'hex'
    ),
    36
  );
$$;

create or replace function public.ensure_video_session_for_paid_booking_v1(
  p_booking_id uuid,
  p_environment text,
  p_source text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_session_id uuid;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.session_payments sp
    where sp.booking_id = p_booking_id
      and sp.financial_status = 'paid'
  ) then
    raise exception 'booking_payment_not_confirmed' using errcode = 'P0001';
  end if;

  if v_booking.status in (
    'cancelled_by_patient',
    'cancelled_by_therapist',
    'refunded'
  ) then
    raise exception 'booking_closed' using errcode = 'P0001';
  end if;

  insert into public.video_sessions (
    booking_id,
    environment,
    session_name,
    session_key,
    scheduled_starts_at,
    scheduled_ends_at,
    status,
    metadata
  )
  values (
    v_booking.id,
    p_environment,
    public.create_zoom_video_session_name_v1(v_booking.id, p_environment),
    public.create_zoom_video_session_key_v1(v_booking.id, p_environment),
    v_booking.starts_at,
    v_booking.ends_at,
    'ready',
    jsonb_build_object('source', left(coalesce(p_source, 'system'), 80))
  )
  on conflict (booking_id) do update
  set scheduled_starts_at = excluded.scheduled_starts_at,
      scheduled_ends_at = excluded.scheduled_ends_at,
      status = case
        when public.video_sessions.status in ('canceled', 'failed')
          then public.video_sessions.status
        when public.video_sessions.status = 'ended'
          then 'ended'::public.video_session_status
        else 'ready'::public.video_session_status
      end,
      metadata = public.video_sessions.metadata || excluded.metadata,
      version = public.video_sessions.version + 1,
      updated_at = now()
  returning id into v_session_id;

  update public.bookings
  set meeting_provider = 'zoom_video_sdk',
      meeting_url = null,
      updated_at = now()
  where id = v_booking.id
    and (
      meeting_provider is distinct from 'zoom_video_sdk'
      or meeting_url is not null
    );

  return v_session_id;
end;
$$;

create or replace function public.cancel_video_session_for_booking_v1(
  p_booking_id uuid,
  p_source text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  update public.video_sessions
  set status = case
        when status in ('active', 'ended') then status
        else 'canceled'::public.video_session_status
      end,
      metadata = metadata || jsonb_build_object(
        'cancelSource',
        left(coalesce(p_source, 'system'), 80)
      ),
      version = version + 1,
      updated_at = now()
  where booking_id = p_booking_id
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.sync_booking_video_session_v1(
  p_booking_id uuid,
  p_operation text,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_environment text := coalesce(
    nullif(current_setting('request.jwt.claim.zoom_environment', true), ''),
    'development'
  );
  v_session_id uuid;
begin
  if p_operation not in ('create', 'update', 'cancel') then
    raise exception 'invalid_video_session_sync_operation' using errcode = '22023';
  end if;

  if p_operation = 'cancel' then
    return public.cancel_video_session_for_booking_v1(
      p_booking_id,
      coalesce(p_request_id, 'booking_sync')
    );
  end if;

  select public.ensure_video_session_for_paid_booking_v1(
    p_booking_id,
    v_environment,
    coalesce(p_request_id, 'booking_sync')
  )
  into v_session_id;

  return v_session_id;
exception
  when raise_exception then
    return null;
end;
$$;

create or replace function public.reserve_zoom_video_webhook_event_v1(
  p_event_key text,
  p_event_type text,
  p_account_identifier text,
  p_provider_session_id text,
  p_session_name_hash text,
  p_provider_user_id text,
  p_provider_user_key text,
  p_request_id text,
  p_event_ts timestamptz,
  p_payload_sha256 text,
  p_payload_sanitized jsonb default '{}'::jsonb
)
returns table (
  processing_status public.zoom_video_webhook_processing_status,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.zoom_video_webhook_events%rowtype;
begin
  insert into public.zoom_video_webhook_events (
    event_key,
    event_type,
    account_identifier,
    provider_session_id,
    session_name_hash,
    provider_user_id,
    provider_user_key,
    request_id,
    event_ts,
    payload_sha256,
    payload_sanitized,
    processing_status,
    attempts,
    processing_started_at,
    updated_at
  ) values (
    p_event_key,
    p_event_type,
    p_account_identifier,
    p_provider_session_id,
    p_session_name_hash,
    p_provider_user_id,
    p_provider_user_key,
    p_request_id,
    p_event_ts,
    p_payload_sha256,
    coalesce(p_payload_sanitized, '{}'::jsonb),
    'processing',
    1,
    now(),
    now()
  )
  on conflict (event_key) do nothing
  returning * into v_event;

  if v_event.id is not null then
    return query select v_event.processing_status, true;
    return;
  end if;

  select *
    into v_event
  from public.zoom_video_webhook_events
  where event_key = p_event_key
  for update;

  if v_event.processing_status in ('processed', 'ignored')
    or (
      v_event.processing_status = 'processing'
      and v_event.processing_started_at > now() - interval '5 minutes'
    ) then
    return query select v_event.processing_status, false;
    return;
  end if;

  update public.zoom_video_webhook_events
  set processing_status = 'processing',
      processing_started_at = now(),
      processed_at = null,
      attempts = attempts + 1,
      error_code = null,
      error_message = null,
      updated_at = now()
  where id = v_event.id
  returning * into v_event;

  return query select v_event.processing_status, true;
end;
$$;

create or replace function public.apply_zoom_video_webhook_transition_v1(
  p_event_key text,
  p_status public.zoom_video_webhook_processing_status,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.zoom_video_webhook_events
  set processing_status = p_status,
      processed_at = case when p_status in ('processed', 'ignored') then now() else processed_at end,
      error_code = left(nullif(p_error_code, ''), 120),
      error_message = left(nullif(p_error_message, ''), 500),
      updated_at = now()
  where event_key = p_event_key;
end;
$$;

create or replace function public.apply_zoom_video_session_event_v1(
  p_session_name text,
  p_provider_session_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_provider_user_id text default null,
  p_provider_user_key text default null,
  p_duration_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.video_sessions%rowtype;
  v_role public.video_session_participant_role :=
    'unknown'::public.video_session_participant_role;
  v_correlation text;
begin
  select *
    into v_session
  from public.video_sessions
  where lower(session_name) = lower(p_session_name)
    or (
      p_provider_session_id is not null
      and provider_session_id = p_provider_session_id
    )
  order by updated_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if p_provider_user_key like 'tes-v1-t-%' then
    v_role := 'therapist'::public.video_session_participant_role;
  elsif p_provider_user_key like 'tes-v1-p-%' then
    v_role := 'patient'::public.video_session_participant_role;
  end if;

  if p_event_type = 'session.started' then
    update public.video_sessions
    set status = 'active',
        actual_started_at = coalesce(actual_started_at, p_event_at),
        provider_session_id = coalesce(provider_session_id, p_provider_session_id),
        last_synced_at = now(),
        updated_at = now()
    where id = v_session.id
      and status not in ('ended', 'canceled');
  elsif p_event_type = 'session.ended' then
    update public.video_sessions
    set status = 'ended',
        actual_ended_at = coalesce(actual_ended_at, p_event_at),
        provider_session_id = coalesce(provider_session_id, p_provider_session_id),
        last_synced_at = now(),
        updated_at = now()
    where id = v_session.id
      and status <> 'canceled';
  end if;

  if p_event_type in ('session.user_joined', 'session.user_left') then
    v_correlation := coalesce(
      nullif(p_provider_user_key, ''),
      nullif(p_provider_user_id, ''),
      encode(extensions.digest(v_session.id::text || p_event_type, 'sha256'::text), 'hex')
    );

    insert into public.video_session_participations (
      video_session_id,
      booking_id,
      participant_correlation_key,
      provider_user_id,
      provider_user_key,
      participant_role,
      event_type,
      joined_at,
      left_at,
      duration_seconds,
      metadata
    )
    values (
      v_session.id,
      v_session.booking_id,
      v_correlation,
      nullif(p_provider_user_id, ''),
      nullif(p_provider_user_key, ''),
      v_role,
      p_event_type,
      case when p_event_type = 'session.user_joined' then p_event_at else null end,
      case when p_event_type = 'session.user_left' then p_event_at else null end,
      p_duration_seconds,
      jsonb_build_object('source', 'zoom_video_webhook')
    );
  end if;
end;
$$;

revoke all on function public.create_zoom_video_session_name_v1(uuid, text)
from public;
revoke all on function public.create_zoom_video_session_key_v1(uuid, text)
from public;
revoke all on function public.ensure_video_session_for_paid_booking_v1(
  uuid,
  text,
  text
) from public;
revoke all on function public.cancel_video_session_for_booking_v1(uuid, text)
from public;
revoke all on function public.sync_booking_video_session_v1(uuid, text, text)
from public;
revoke all on function public.reserve_zoom_video_webhook_event_v1(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  jsonb
) from public;
revoke all on function public.apply_zoom_video_webhook_transition_v1(
  text,
  public.zoom_video_webhook_processing_status,
  text,
  text
) from public;
revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer
) from public;

grant execute on function public.ensure_video_session_for_paid_booking_v1(
  uuid,
  text,
  text
) to service_role;
grant execute on function public.cancel_video_session_for_booking_v1(uuid, text)
to service_role;
grant execute on function public.sync_booking_video_session_v1(uuid, text, text)
to service_role;
grant execute on function public.reserve_zoom_video_webhook_event_v1(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  jsonb
) to service_role;
grant execute on function public.apply_zoom_video_webhook_transition_v1(
  text,
  public.zoom_video_webhook_processing_status,
  text,
  text
) to service_role;
grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer
) to service_role;

comment on table public.video_sessions is
  'Sessao logica local de Video SDK por booking. Nao armazena JWT, senha, URL ou conteudo clinico.';
comment on table public.video_session_participations is
  'Eventos operacionais minimos de entrada e saida em sessoes Video SDK.';
comment on table public.zoom_video_webhook_events is
  'Idempotencia e auditoria sanitizada de webhooks do Zoom Video SDK.';
comment on column public.bookings.meeting_url is
  'Campo legado sem uso no Video SDK. Nao gravar token, session name, URL ou segredo.';
