begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'video_sessions'
      and column_name = 'therapist_access_issued_at'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'video_sessions'
      and column_name = 'therapist_token_issued_at'
  ) then
    alter table public.video_sessions
      rename column therapist_access_issued_at to therapist_token_issued_at;
  end if;
end $$;

alter table public.video_sessions
  add column if not exists hard_ends_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists termination_requested_at timestamptz,
  add column if not exists termination_confirmed_at timestamptz,
  add column if not exists last_maintenance_at timestamptz,
  add column if not exists therapist_first_joined_at timestamptz,
  add column if not exists therapist_last_joined_at timestamptz,
  add column if not exists therapist_last_left_at timestamptz,
  add column if not exists therapist_present boolean not null default false,
  add column if not exists participant_count integer not null default 0,
  add column if not exists last_participant_left_at timestamptz,
  add column if not exists last_provider_event_at timestamptz;

alter table public.video_sessions
  drop constraint if exists video_sessions_termination_reason_check,
  add constraint video_sessions_termination_reason_check check (
    termination_reason is null
    or termination_reason in (
      'host_left',
      'hard_timeout',
      'therapist_absent',
      'provider_ended',
      'manual_end',
      'reconcile_orphan'
    )
  ),
  drop constraint if exists video_sessions_participant_count_check,
  add constraint video_sessions_participant_count_check check (
    participant_count >= 0
  );

create index if not exists video_sessions_hard_end_idx
on public.video_sessions (environment, status, hard_ends_at)
where hard_ends_at is not null
  and termination_confirmed_at is null;

create index if not exists video_sessions_therapist_absence_idx
on public.video_sessions (environment, status, therapist_present, therapist_last_left_at)
where termination_confirmed_at is null;

create index if not exists video_sessions_termination_requested_idx
on public.video_sessions (environment, termination_requested_at)
where termination_requested_at is not null
  and termination_confirmed_at is null;

do $$
begin
  create type public.video_session_control_operation as enum (
    'end_hard_timeout',
    'end_therapist_absent',
    'reconcile_orphan',
    'confirm_end'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.video_session_control_job_status as enum (
    'queued',
    'processing',
    'retry',
    'done',
    'dead_letter'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.video_session_control_jobs (
  id uuid primary key default gen_random_uuid(),
  video_session_id uuid not null references public.video_sessions (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  environment text not null,
  operation public.video_session_control_operation not null,
  status public.video_session_control_job_status not null default 'queued',
  idempotency_key text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_run_at timestamptz not null default now(),
  locked_until_at timestamptz,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_session_control_jobs_environment_check check (
    environment in ('development', 'production')
  ),
  constraint video_session_control_jobs_attempts_check check (
    attempts >= 0 and max_attempts between 1 and 10
  ),
  constraint video_session_control_jobs_idempotency_limited check (
    char_length(idempotency_key) between 12 and 160
  )
);

create unique index if not exists video_session_control_jobs_idempotency_idx
on public.video_session_control_jobs (environment, idempotency_key);

create index if not exists video_session_control_jobs_queue_idx
on public.video_session_control_jobs (
  environment,
  status,
  next_run_at,
  locked_until_at
)
where status in ('queued', 'retry', 'processing');

create index if not exists video_session_control_jobs_session_idx
on public.video_session_control_jobs (video_session_id, operation, status);

drop trigger if exists set_video_session_control_jobs_updated_at
on public.video_session_control_jobs;
create trigger set_video_session_control_jobs_updated_at
before update on public.video_session_control_jobs
for each row
execute function public.set_updated_at();

alter table public.video_session_control_jobs enable row level security;

drop policy if exists "No direct authenticated access to video session control jobs"
on public.video_session_control_jobs;
create policy "No direct authenticated access to video session control jobs"
on public.video_session_control_jobs
for all
to authenticated
using (false)
with check (false);

grant all on public.video_session_control_jobs to service_role;

drop view if exists public.patient_video_session_summary_v;
drop view if exists public.therapist_video_session_summary_v;

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
  vs.hard_ends_at,
  vs.therapist_first_joined_at,
  vs.therapist_present,
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
  vs.therapist_token_issued_at,
  vs.hard_ends_at,
  vs.therapist_first_joined_at,
  vs.therapist_last_joined_at,
  vs.therapist_last_left_at,
  vs.therapist_present,
  vs.last_synced_at
from public.video_sessions vs
join public.bookings b on b.id = vs.booking_id
where public.is_current_therapist_profile(b.therapist_profile_id);

grant select on public.patient_video_session_summary_v to authenticated;
grant select on public.therapist_video_session_summary_v to authenticated;

drop function if exists public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer
);

create or replace function public.apply_zoom_video_session_event_v1(
  p_session_name text,
  p_provider_session_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_provider_user_id text default null,
  p_provider_user_key text default null,
  p_duration_seconds integer default null,
  p_max_duration_minutes integer default null,
  p_after_ends_minutes integer default 30
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
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_inserted integer := 0;
  v_hard_ends_at timestamptz;
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

  if p_max_duration_minutes is not null then
    if p_max_duration_minutes < 1 or p_max_duration_minutes > 240 then
      raise exception 'invalid_zoom_video_session_max_duration_minutes'
        using errcode = '22023';
    end if;

    v_hard_ends_at := least(
      greatest(
        coalesce(v_session.actual_started_at, v_event_at),
        v_session.scheduled_starts_at
      ) + make_interval(mins => p_max_duration_minutes),
      v_session.scheduled_ends_at + make_interval(mins => p_after_ends_minutes)
    );
  end if;

  if p_provider_user_key like 'tes-v1-t-%' then
    v_role := 'therapist'::public.video_session_participant_role;
  elsif p_provider_user_key like 'tes-v1-p-%' then
    v_role := 'patient'::public.video_session_participant_role;
  end if;

  if p_event_type = 'session.started' then
    update public.video_sessions
    set status = 'active',
        actual_started_at = coalesce(actual_started_at, v_event_at),
        hard_ends_at = coalesce(hard_ends_at, v_hard_ends_at),
        provider_session_id = coalesce(provider_session_id, p_provider_session_id),
        last_provider_event_at = greatest(
          coalesce(last_provider_event_at, '-infinity'::timestamptz),
          v_event_at
        ),
        last_synced_at = now(),
        updated_at = now()
    where id = v_session.id
      and status not in ('ended', 'canceled');
  elsif p_event_type = 'session.ended' then
    update public.video_sessions
    set status = 'ended',
        actual_ended_at = coalesce(actual_ended_at, v_event_at),
        provider_session_id = coalesce(provider_session_id, p_provider_session_id),
        therapist_present = false,
        participant_count = 0,
        termination_reason = coalesce(termination_reason, 'provider_ended'),
        termination_confirmed_at = coalesce(termination_confirmed_at, v_event_at),
        last_provider_event_at = greatest(
          coalesce(last_provider_event_at, '-infinity'::timestamptz),
          v_event_at
        ),
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
    select
      v_session.id,
      v_session.booking_id,
      v_correlation,
      nullif(p_provider_user_id, ''),
      nullif(p_provider_user_key, ''),
      v_role,
      p_event_type,
      case when p_event_type = 'session.user_joined' then v_event_at else null end,
      case when p_event_type = 'session.user_left' then v_event_at else null end,
      p_duration_seconds,
      jsonb_build_object('source', 'zoom_video_webhook')
    where not exists (
      select 1
      from public.video_session_participations existing
      where existing.video_session_id = v_session.id
        and existing.participant_correlation_key = v_correlation
        and existing.event_type = p_event_type
        and coalesce(existing.joined_at, existing.left_at) = v_event_at
    );

    get diagnostics v_inserted = row_count;

    if v_role = 'therapist' and p_event_type = 'session.user_joined' then
      update public.video_sessions
      set status = 'active',
          actual_started_at = coalesce(actual_started_at, v_event_at),
          hard_ends_at = coalesce(hard_ends_at, v_hard_ends_at),
          provider_session_id = coalesce(provider_session_id, p_provider_session_id),
          therapist_first_joined_at = coalesce(therapist_first_joined_at, v_event_at),
          therapist_last_joined_at = greatest(
            coalesce(therapist_last_joined_at, '-infinity'::timestamptz),
            v_event_at
          ),
          therapist_present = true,
          participant_count = case
            when v_inserted > 0 then participant_count + 1
            else participant_count
          end,
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status not in ('ended', 'canceled');
    elsif v_role = 'therapist' and p_event_type = 'session.user_left' then
      update public.video_sessions
      set provider_session_id = coalesce(provider_session_id, p_provider_session_id),
          therapist_last_left_at = greatest(
            coalesce(therapist_last_left_at, '-infinity'::timestamptz),
            v_event_at
          ),
          therapist_present = case
            when v_event_at >= coalesce(therapist_last_joined_at, v_event_at)
              then false
            else therapist_present
          end,
          participant_count = greatest(
            participant_count - case when v_inserted > 0 then 1 else 0 end,
            0
          ),
          last_participant_left_at = greatest(
            coalesce(last_participant_left_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status not in ('ended', 'canceled');
    elsif v_inserted > 0 and p_event_type = 'session.user_joined' then
      update public.video_sessions
      set provider_session_id = coalesce(provider_session_id, p_provider_session_id),
          participant_count = participant_count + 1,
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status not in ('ended', 'canceled');
    elsif v_inserted > 0 and p_event_type = 'session.user_left' then
      update public.video_sessions
      set provider_session_id = coalesce(provider_session_id, p_provider_session_id),
          participant_count = greatest(participant_count - 1, 0),
          last_participant_left_at = greatest(
            coalesce(last_participant_left_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_provider_event_at = greatest(
            coalesce(last_provider_event_at, '-infinity'::timestamptz),
            v_event_at
          ),
          last_synced_at = now(),
          updated_at = now()
      where id = v_session.id
        and status not in ('ended', 'canceled');
    end if;
  end if;
end;
$$;

create or replace function public.enqueue_video_session_control_job_v1(
  p_video_session_id uuid,
  p_operation public.video_session_control_operation,
  p_idempotency_key text,
  p_next_run_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.video_sessions%rowtype;
  v_job_id uuid;
begin
  select *
    into v_session
  from public.video_sessions
  where id = p_video_session_id;

  if not found then
    raise exception 'video_session_not_found' using errcode = 'P0002';
  end if;

  insert into public.video_session_control_jobs (
    video_session_id,
    booking_id,
    environment,
    operation,
    idempotency_key,
    next_run_at,
    metadata
  )
  values (
    v_session.id,
    v_session.booking_id,
    v_session.environment,
    p_operation,
    left(p_idempotency_key, 160),
    coalesce(p_next_run_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (environment, idempotency_key) do update
  set next_run_at = least(public.video_session_control_jobs.next_run_at, excluded.next_run_at),
      metadata = public.video_session_control_jobs.metadata || excluded.metadata,
      updated_at = now()
  where public.video_session_control_jobs.status in ('queued', 'retry', 'processing')
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.enqueue_due_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 50,
  p_therapist_absence_grace_seconds integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_session record;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and hard_ends_at is not null
      and hard_ends_at <= now()
      and termination_confirmed_at is null
    order by hard_ends_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'end_hard_timeout',
      'hard-timeout:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and therapist_present = false
      and therapist_last_left_at is not null
      and therapist_last_left_at
        <= now() - make_interval(secs => greatest(30, least(coalesce(p_therapist_absence_grace_seconds, 120), 600)))
      and termination_confirmed_at is null
    order by therapist_last_left_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'end_therapist_absent',
      'therapist-absent:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and provider_session_id is null
      and actual_started_at < now() - interval '10 minutes'
      and termination_confirmed_at is null
    order by actual_started_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'reconcile_orphan',
      'reconcile-orphan:' || v_session.id::text,
      now(),
      jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.reserve_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 10,
  p_lock_seconds integer default 60
)
returns table (
  id uuid,
  video_session_id uuid,
  booking_id uuid,
  provider_session_id text,
  operation public.video_session_control_operation,
  attempts integer,
  max_attempts integer
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select j.id
    from public.video_session_control_jobs j
    join public.video_sessions vs on vs.id = j.video_session_id
    where j.environment = p_environment
      and j.status in ('queued', 'retry')
      and j.next_run_at <= now()
      and coalesce(j.locked_until_at, '-infinity'::timestamptz) <= now()
      and j.attempts < j.max_attempts
      and vs.termination_confirmed_at is null
    order by j.next_run_at, j.created_at
    for update of j skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs j
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))),
        updated_at = now()
    from candidates
    where j.id = candidates.id
    returning j.id, j.video_session_id, j.booking_id, j.operation, j.attempts, j.max_attempts
  )
  select
    updated.id,
    updated.video_session_id,
    updated.booking_id,
    vs.provider_session_id,
    updated.operation,
    updated.attempts,
    updated.max_attempts
  from updated
  join public.video_sessions vs on vs.id = updated.video_session_id;
$$;

create or replace function public.complete_video_session_control_job_v1(
  p_job_id uuid,
  p_success boolean,
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
  v_job_exists boolean;
begin
  select exists (
    select 1
    from public.video_session_control_jobs
    where id = p_job_id
  )
  into v_job_exists;

  if not v_job_exists then
    raise exception 'video_session_control_job_not_found' using errcode = 'P0002';
  end if;

  if p_success then
    update public.video_session_control_jobs
    set status = 'done',
        completed_at = now(),
        locked_until_at = null,
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    where id = p_job_id;
    return;
  end if;

  update public.video_session_control_jobs
  set status = case
        when attempts >= max_attempts then 'dead_letter'::public.video_session_control_job_status
        else 'retry'::public.video_session_control_job_status
      end,
      next_run_at = now() + make_interval(
        secs => greatest(
          15,
          least(coalesce(p_retry_after_seconds, 30 * attempts), 900)
        )
      ),
      locked_until_at = null,
      last_error_code = left(nullif(p_error_code, ''), 120),
      last_error_message = left(nullif(p_error_message, ''), 500),
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.mark_video_session_termination_requested_v1(
  p_video_session_id uuid,
  p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.video_sessions
  set termination_reason = case
        when p_reason in (
          'hard_timeout',
          'therapist_absent',
          'manual_end',
          'reconcile_orphan',
          'provider_ended'
        ) then p_reason
        else 'manual_end'
      end,
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(),
      updated_at = now()
  where id = p_video_session_id
    and termination_confirmed_at is null;
$$;

create or replace function public.mark_video_session_termination_confirmed_v1(
  p_video_session_id uuid,
  p_reason text default 'provider_ended'
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.video_sessions
  set status = 'ended',
      actual_ended_at = coalesce(actual_ended_at, now()),
      therapist_present = false,
      participant_count = 0,
      termination_reason = coalesce(
        termination_reason,
        case
          when p_reason in (
            'hard_timeout',
            'therapist_absent',
            'manual_end',
            'reconcile_orphan',
            'provider_ended'
          ) then p_reason
          else 'provider_ended'
        end
      ),
      termination_confirmed_at = coalesce(termination_confirmed_at, now()),
      last_maintenance_at = now(),
      last_synced_at = now(),
      updated_at = now()
  where id = p_video_session_id
    and status <> 'canceled';
$$;

revoke all on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) from public;
revoke all on function public.enqueue_video_session_control_job_v1(
  uuid,
  public.video_session_control_operation,
  text,
  timestamptz,
  jsonb
) from public;
revoke all on function public.enqueue_due_video_session_control_jobs_v1(
  text,
  integer,
  integer
) from public;
revoke all on function public.reserve_video_session_control_jobs_v1(
  text,
  integer,
  integer
) from public;
revoke all on function public.complete_video_session_control_job_v1(
  uuid,
  boolean,
  text,
  text,
  integer
) from public;
revoke all on function public.mark_video_session_termination_requested_v1(
  uuid,
  text
) from public;
revoke all on function public.mark_video_session_termination_confirmed_v1(
  uuid,
  text
) from public;

grant execute on function public.apply_zoom_video_session_event_v1(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;
grant execute on function public.enqueue_video_session_control_job_v1(
  uuid,
  public.video_session_control_operation,
  text,
  timestamptz,
  jsonb
) to service_role;
grant execute on function public.enqueue_due_video_session_control_jobs_v1(
  text,
  integer,
  integer
) to service_role;
grant execute on function public.reserve_video_session_control_jobs_v1(
  text,
  integer,
  integer
) to service_role;
grant execute on function public.complete_video_session_control_job_v1(
  uuid,
  boolean,
  text,
  text,
  integer
) to service_role;
grant execute on function public.mark_video_session_termination_requested_v1(
  uuid,
  text
) to service_role;
grant execute on function public.mark_video_session_termination_confirmed_v1(
  uuid,
  text
) to service_role;

comment on column public.video_sessions.therapist_token_issued_at is
  'Auditoria de JWT emitido para terapeuta. Nao significa presenca confirmada no provedor.';
comment on column public.video_sessions.therapist_first_joined_at is
  'Primeiro session.user_joined confiavel do webhook Zoom para o terapeuta.';
comment on column public.video_sessions.hard_ends_at is
  'Limite operacional efetivo: min(inicio efetivo + max env, fim agendado + tolerancia existente).';
comment on table public.video_session_control_jobs is
  'Jobs duraveis idempotentes para encerramento e reconciliacao de sessoes Zoom Video SDK.';

commit;
