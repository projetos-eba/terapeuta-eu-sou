create extension if not exists pgcrypto;

do $$
begin
  create type public.zoom_meeting_status as enum (
    'pending_provisioning',
    'provisioned',
    'updating',
    'scheduled',
    'in_progress',
    'ended',
    'cancel_pending',
    'canceled',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.zoom_job_operation as enum (
    'create',
    'update',
    'cancel',
    'reconcile'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.zoom_job_status as enum (
    'pending',
    'processing',
    'succeeded',
    'retry_scheduled',
    'failed',
    'dead_letter'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.zoom_webhook_processing_status as enum (
    'received',
    'processing',
    'processed',
    'ignored',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.zoom_meetings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  provider text not null default 'zoom',
  environment text not null,
  zoom_account_identifier text,
  zoom_meeting_id text,
  zoom_meeting_uuid text,
  zoom_host_user_id text not null,
  topic text not null,
  scheduled_starts_at timestamptz not null,
  scheduled_ends_at timestamptz not null,
  duration_minutes integer not null,
  timezone text not null default 'America/Sao_Paulo',
  status public.zoom_meeting_status not null default 'pending_provisioning',
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  passcode_encrypted text,
  passcode_key_version text,
  start_url_encrypted text,
  start_url_key_version text,
  provider_created_at timestamptz,
  provider_updated_at timestamptz,
  last_synced_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_meetings_provider_zoom check (provider = 'zoom'),
  constraint zoom_meetings_environment_check check (
    environment in ('development', 'production')
  ),
  constraint zoom_meetings_valid_range check (scheduled_starts_at < scheduled_ends_at),
  constraint zoom_meetings_duration_positive check (duration_minutes > 0),
  constraint zoom_meetings_error_message_limited check (
    last_error_message is null or char_length(last_error_message) <= 500
  )
);

create unique index if not exists zoom_meetings_provider_meeting_unique_idx
on public.zoom_meetings (environment, zoom_meeting_id)
where zoom_meeting_id is not null and status <> 'canceled';

create index if not exists zoom_meetings_status_idx
on public.zoom_meetings (status, scheduled_starts_at);

create index if not exists zoom_meetings_zoom_uuid_idx
on public.zoom_meetings (environment, zoom_meeting_uuid)
where zoom_meeting_uuid is not null;

create table if not exists public.zoom_meeting_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  zoom_meeting_id uuid references public.zoom_meetings (id) on delete set null,
  operation public.zoom_job_operation not null,
  status public.zoom_job_status not null default 'pending',
  idempotency_key text not null unique,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint zoom_meeting_jobs_attempts_check check (
    attempts >= 0 and max_attempts > 0
  ),
  constraint zoom_meeting_jobs_error_message_limited check (
    last_error_message is null or char_length(last_error_message) <= 500
  )
);

create index if not exists zoom_meeting_jobs_queue_idx
on public.zoom_meeting_jobs (status, available_at, created_at)
where status in ('pending', 'retry_scheduled');

create index if not exists zoom_meeting_jobs_booking_idx
on public.zoom_meeting_jobs (booking_id, created_at desc);

create table if not exists public.zoom_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  zoom_account_identifier text,
  zoom_meeting_id text,
  zoom_meeting_uuid text,
  request_id text,
  event_ts timestamptz,
  payload_sha256 text not null,
  payload_sanitized jsonb not null default '{}'::jsonb,
  processing_status public.zoom_webhook_processing_status not null default 'received',
  attempts integer not null default 0,
  processing_started_at timestamptz,
  processed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_webhook_events_error_message_limited check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists zoom_webhook_events_status_idx
on public.zoom_webhook_events (processing_status, created_at);

create index if not exists zoom_webhook_events_meeting_idx
on public.zoom_webhook_events (zoom_meeting_id, zoom_meeting_uuid);

create table if not exists public.zoom_meeting_participations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.zoom_meetings (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  participant_correlation_key text not null,
  zoom_participant_id text,
  zoom_participant_uuid text,
  participant_role text,
  event_type text not null,
  waiting_room_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer,
  provider_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_participations_role_check check (
    participant_role is null or participant_role in ('patient', 'therapist', 'unknown')
  ),
  constraint zoom_participations_duration_check check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create index if not exists zoom_participations_booking_idx
on public.zoom_meeting_participations (booking_id, created_at desc);

create index if not exists zoom_participations_correlation_idx
on public.zoom_meeting_participations (participant_correlation_key, created_at desc);

drop trigger if exists set_zoom_meetings_updated_at on public.zoom_meetings;
create trigger set_zoom_meetings_updated_at
before update on public.zoom_meetings
for each row execute function public.set_updated_at();

drop trigger if exists set_zoom_meeting_jobs_updated_at on public.zoom_meeting_jobs;
create trigger set_zoom_meeting_jobs_updated_at
before update on public.zoom_meeting_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_zoom_webhook_events_updated_at on public.zoom_webhook_events;
create trigger set_zoom_webhook_events_updated_at
before update on public.zoom_webhook_events
for each row execute function public.set_updated_at();

drop trigger if exists set_zoom_meeting_participations_updated_at
on public.zoom_meeting_participations;
create trigger set_zoom_meeting_participations_updated_at
before update on public.zoom_meeting_participations
for each row execute function public.set_updated_at();

alter table public.zoom_meetings enable row level security;
alter table public.zoom_meeting_jobs enable row level security;
alter table public.zoom_webhook_events enable row level security;
alter table public.zoom_meeting_participations enable row level security;

grant select (
  id,
  booking_id,
  provider,
  environment,
  zoom_meeting_id,
  topic,
  scheduled_starts_at,
  scheduled_ends_at,
  duration_minutes,
  timezone,
  status,
  actual_started_at,
  actual_ended_at,
  last_synced_at,
  created_at,
  updated_at
) on public.zoom_meetings to authenticated;
grant all on public.zoom_meetings to service_role;
grant all on public.zoom_meeting_jobs to service_role;
grant all on public.zoom_webhook_events to service_role;
grant all on public.zoom_meeting_participations to service_role;

drop policy if exists "Patients can read safe zoom meeting rows"
on public.zoom_meetings;
create policy "Patients can read safe zoom meeting rows"
on public.zoom_meetings
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meetings.booking_id
      and public.is_current_patient_profile(bookings.patient_profile_id)
  )
);

drop policy if exists "Therapists can read safe zoom meeting rows"
on public.zoom_meetings;
create policy "Therapists can read safe zoom meeting rows"
on public.zoom_meetings
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meetings.booking_id
      and public.is_current_therapist_profile(bookings.therapist_profile_id)
  )
);

drop policy if exists "Patients can read own zoom participation events"
on public.zoom_meeting_participations;
create policy "Patients can read own zoom participation events"
on public.zoom_meeting_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meeting_participations.booking_id
      and public.is_current_patient_profile(bookings.patient_profile_id)
  )
);

drop policy if exists "Therapists can read own zoom participation events"
on public.zoom_meeting_participations;
create policy "Therapists can read own zoom participation events"
on public.zoom_meeting_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meeting_participations.booking_id
      and public.is_current_therapist_profile(bookings.therapist_profile_id)
  )
);

create or replace view public.patient_zoom_meeting_summary_v
with (security_invoker = true)
as
select
  zm.id,
  zm.booking_id,
  zm.provider,
  zm.environment,
  zm.topic,
  zm.scheduled_starts_at,
  zm.scheduled_ends_at,
  zm.duration_minutes,
  zm.timezone,
  zm.status,
  zm.actual_started_at,
  zm.actual_ended_at,
  zm.last_synced_at
from public.zoom_meetings zm
join public.bookings b on b.id = zm.booking_id
where public.is_current_patient_profile(b.patient_profile_id);

create or replace view public.therapist_zoom_meeting_summary_v
with (security_invoker = true)
as
select
  zm.id,
  zm.booking_id,
  zm.provider,
  zm.environment,
  zm.zoom_meeting_id,
  zm.topic,
  zm.scheduled_starts_at,
  zm.scheduled_ends_at,
  zm.duration_minutes,
  zm.timezone,
  zm.status,
  zm.actual_started_at,
  zm.actual_ended_at,
  zm.last_synced_at
from public.zoom_meetings zm
join public.bookings b on b.id = zm.booking_id
where public.is_current_therapist_profile(b.therapist_profile_id);

grant select on public.patient_zoom_meeting_summary_v to authenticated;
grant select on public.therapist_zoom_meeting_summary_v to authenticated;

create or replace function public.enqueue_zoom_meeting_job_v1(
  p_booking_id uuid,
  p_operation public.zoom_job_operation,
  p_environment text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_job_id uuid;
  v_zoom_meeting_id uuid;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_environment' using errcode = '22023';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if p_operation in ('create', 'update', 'reconcile') then
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
  end if;

  insert into public.zoom_meetings (
    booking_id,
    environment,
    zoom_host_user_id,
    topic,
    scheduled_starts_at,
    scheduled_ends_at,
    duration_minutes,
    timezone,
    status,
    metadata
  )
  values (
    v_booking.id,
    p_environment,
    coalesce(p_payload->>'hostUserId', 'configured-host'),
    coalesce(
      nullif(p_payload->>'topic', ''),
      'Sessao Terapeuta Eu Sou - ' || left(replace(v_booking.id::text, '-', ''), 10)
    ),
    v_booking.starts_at,
    v_booking.ends_at,
    greatest(1, ceiling(extract(epoch from (v_booking.ends_at - v_booking.starts_at)) / 60)::integer),
    v_booking.timezone,
    case
      when p_operation = 'cancel' then 'cancel_pending'::public.zoom_meeting_status
      else 'pending_provisioning'::public.zoom_meeting_status
    end,
    jsonb_build_object('source', 'zoom_outbox')
  )
  on conflict (booking_id) do update
  set scheduled_starts_at = excluded.scheduled_starts_at,
      scheduled_ends_at = excluded.scheduled_ends_at,
      duration_minutes = excluded.duration_minutes,
      timezone = excluded.timezone,
      status = case
        when p_operation = 'cancel' then 'cancel_pending'::public.zoom_meeting_status
        when public.zoom_meetings.status in ('failed', 'pending_provisioning')
          then 'pending_provisioning'::public.zoom_meeting_status
        else 'updating'::public.zoom_meeting_status
      end,
      version = public.zoom_meetings.version + 1,
      updated_at = now()
  returning id into v_zoom_meeting_id;

  update public.bookings
  set meeting_provider = 'zoom',
      updated_at = now()
  where id = v_booking.id
    and coalesce(meeting_provider, '') <> 'zoom';

  insert into public.zoom_meeting_jobs (
    booking_id,
    zoom_meeting_id,
    operation,
    status,
    idempotency_key,
    payload
  )
  values (
    p_booking_id,
    v_zoom_meeting_id,
    p_operation,
    'pending',
    p_idempotency_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (idempotency_key) do update
  set zoom_meeting_id = coalesce(public.zoom_meeting_jobs.zoom_meeting_id, excluded.zoom_meeting_id),
      payload = public.zoom_meeting_jobs.payload || excluded.payload,
      updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.reserve_zoom_meeting_job_v1(
  p_worker_id text,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  booking_id uuid,
  zoom_meeting_id uuid,
  operation public.zoom_job_operation,
  attempts integer,
  max_attempts integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select zmj.id
    from public.zoom_meeting_jobs zmj
    where zmj.status in ('pending', 'retry_scheduled')
      and zmj.available_at <= p_now
      and zmj.attempts < zmj.max_attempts
    order by zmj.available_at, zmj.created_at
    limit 1
    for update skip locked
  )
  update public.zoom_meeting_jobs zmj
  set status = 'processing',
      attempts = zmj.attempts + 1,
      locked_at = p_now,
      locked_by = left(coalesce(p_worker_id, 'zoom-worker'), 120),
      updated_at = p_now
  from candidate
  where zmj.id = candidate.id
  returning
    zmj.id,
    zmj.booking_id,
    zmj.zoom_meeting_id,
    zmj.operation,
    zmj.attempts,
    zmj.max_attempts,
    zmj.payload;
end;
$$;

create or replace function public.complete_zoom_meeting_job_v1(
  p_job_id uuid,
  p_status public.zoom_job_status,
  p_error_code text default null,
  p_error_message text default null,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_status public.zoom_job_status := p_status;
begin
  if p_status = 'failed' and coalesce(p_retry_after_seconds, 0) > 0 then
    v_next_status := 'retry_scheduled';
  end if;

  update public.zoom_meeting_jobs
  set status = v_next_status,
      locked_at = null,
      locked_by = null,
      available_at = case
        when v_next_status = 'retry_scheduled'
          then now() + make_interval(secs => greatest(1, p_retry_after_seconds))
        else available_at
      end,
      completed_at = case when v_next_status = 'succeeded' then now() else completed_at end,
      last_error_code = left(nullif(p_error_code, ''), 120),
      last_error_message = left(nullif(p_error_message, ''), 500),
      updated_at = now()
  where id = p_job_id;

  update public.zoom_meeting_jobs
  set status = 'dead_letter',
      updated_at = now()
  where id = p_job_id
    and status = 'retry_scheduled'
    and attempts >= max_attempts;
end;
$$;

create or replace function public.reserve_zoom_webhook_event_v1(
  p_event_key text,
  p_event_type text,
  p_zoom_account_identifier text,
  p_zoom_meeting_id text,
  p_zoom_meeting_uuid text,
  p_request_id text,
  p_event_ts timestamptz,
  p_payload_sha256 text,
  p_payload_sanitized jsonb default '{}'::jsonb
)
returns table (
  processing_status public.zoom_webhook_processing_status,
  acquired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.zoom_webhook_events%rowtype;
begin
  insert into public.zoom_webhook_events (
    event_key,
    event_type,
    zoom_account_identifier,
    zoom_meeting_id,
    zoom_meeting_uuid,
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
    p_zoom_account_identifier,
    p_zoom_meeting_id,
    p_zoom_meeting_uuid,
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
  from public.zoom_webhook_events
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

  update public.zoom_webhook_events
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

create or replace function public.apply_zoom_webhook_transition_v1(
  p_event_key text,
  p_status public.zoom_webhook_processing_status,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.zoom_webhook_events
  set processing_status = p_status,
      processed_at = case when p_status in ('processed', 'ignored') then now() else processed_at end,
      error_code = left(nullif(p_error_code, ''), 120),
      error_message = left(nullif(p_error_message, ''), 500),
      updated_at = now()
  where event_key = p_event_key;
end;
$$;

create or replace function public.apply_zoom_meeting_event_v1(
  p_zoom_meeting_id text,
  p_zoom_meeting_uuid text,
  p_event_type text,
  p_event_at timestamptz,
  p_participant_correlation_key text default null,
  p_zoom_participant_id text default null,
  p_zoom_participant_uuid text default null,
  p_provider_user_id text default null,
  p_duration_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zoom_meeting public.zoom_meetings%rowtype;
  v_role text := 'unknown';
begin
  select *
    into v_zoom_meeting
  from public.zoom_meetings
  where (
      p_zoom_meeting_id is not null
      and zoom_meeting_id = p_zoom_meeting_id
    )
    or (
      p_zoom_meeting_uuid is not null
      and zoom_meeting_uuid = p_zoom_meeting_uuid
    )
  order by updated_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if p_event_type in ('meeting.started', 'meeting.started.v2') then
    update public.zoom_meetings
    set status = 'in_progress',
        actual_started_at = coalesce(actual_started_at, p_event_at),
        last_synced_at = now(),
        updated_at = now()
    where id = v_zoom_meeting.id;
  elsif p_event_type in ('meeting.ended', 'meeting.ended.v2') then
    update public.zoom_meetings
    set status = 'ended',
        actual_ended_at = coalesce(actual_ended_at, p_event_at),
        last_synced_at = now(),
        updated_at = now()
    where id = v_zoom_meeting.id;
  end if;

  if p_event_type like 'meeting.participant_%'
    or p_event_type like 'meeting.participant%'
  then
    insert into public.zoom_meeting_participations (
      meeting_id,
      booking_id,
      participant_correlation_key,
      zoom_participant_id,
      zoom_participant_uuid,
      participant_role,
      event_type,
      joined_at,
      left_at,
      duration_seconds,
      provider_user_id,
      metadata
    )
    values (
      v_zoom_meeting.id,
      v_zoom_meeting.booking_id,
      coalesce(
        nullif(p_participant_correlation_key, ''),
        encode(extensions.digest(coalesce(p_zoom_participant_uuid, p_zoom_participant_id, p_provider_user_id, p_event_type), 'sha256'::text), 'hex')
      ),
      nullif(p_zoom_participant_id, ''),
      nullif(p_zoom_participant_uuid, ''),
      v_role,
      p_event_type,
      case when p_event_type like '%joined%' then p_event_at else null end,
      case when p_event_type like '%left%' then p_event_at else null end,
      p_duration_seconds,
      nullif(p_provider_user_id, ''),
      jsonb_build_object('source', 'zoom_webhook')
    );
  end if;
end;
$$;

revoke all on function public.enqueue_zoom_meeting_job_v1(
  uuid,
  public.zoom_job_operation,
  text,
  text,
  jsonb
) from public;
revoke all on function public.reserve_zoom_meeting_job_v1(text, timestamptz) from public;
revoke all on function public.complete_zoom_meeting_job_v1(
  uuid,
  public.zoom_job_status,
  text,
  text,
  integer
) from public;
revoke all on function public.reserve_zoom_webhook_event_v1(
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
revoke all on function public.apply_zoom_webhook_transition_v1(
  text,
  public.zoom_webhook_processing_status,
  text,
  text
) from public;
revoke all on function public.apply_zoom_meeting_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  integer
) from public;

grant execute on function public.enqueue_zoom_meeting_job_v1(
  uuid,
  public.zoom_job_operation,
  text,
  text,
  jsonb
) to service_role;
grant execute on function public.reserve_zoom_meeting_job_v1(text, timestamptz) to service_role;
grant execute on function public.complete_zoom_meeting_job_v1(
  uuid,
  public.zoom_job_status,
  text,
  text,
  integer
) to service_role;
grant execute on function public.reserve_zoom_webhook_event_v1(
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
grant execute on function public.apply_zoom_webhook_transition_v1(
  text,
  public.zoom_webhook_processing_status,
  text,
  text
) to service_role;
grant execute on function public.apply_zoom_meeting_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  integer
) to service_role;

comment on table public.zoom_meetings is
  'Fonte canonica local para reunioes Zoom vinculadas a bookings. Nao armazena conteudo clinico.';
comment on column public.bookings.meeting_url is
  'Campo legado de compatibilidade. Nao gravar start_url do Zoom nem usar como fonte canonica.';
