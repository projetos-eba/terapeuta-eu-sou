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
    where (
      (
        zmj.status in ('pending', 'retry_scheduled')
        and zmj.available_at <= p_now
      )
      or (
        zmj.status = 'processing'
        and zmj.locked_at < p_now - interval '5 minutes'
      )
    )
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
      completed_at = case when v_next_status in ('succeeded', 'failed', 'dead_letter') then now() else completed_at end,
      last_error_code = left(nullif(p_error_code, ''), 120),
      last_error_message = left(nullif(p_error_message, ''), 500),
      updated_at = now()
  where id = p_job_id;

  update public.zoom_meeting_jobs
  set status = 'dead_letter',
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'retry_scheduled'
    and attempts >= max_attempts;
end;
$$;

drop policy if exists "Patients can read safe zoom meeting rows"
on public.zoom_meetings;
drop policy if exists "Therapists can read safe zoom meeting rows"
on public.zoom_meetings;
create policy "Booking participants can read safe zoom meeting rows"
on public.zoom_meetings
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meetings.booking_id
      and (
        public.is_current_patient_profile(bookings.patient_profile_id)
        or public.is_current_therapist_profile(bookings.therapist_profile_id)
      )
  )
);

drop policy if exists "Patients can read own zoom participation events"
on public.zoom_meeting_participations;
drop policy if exists "Therapists can read own zoom participation events"
on public.zoom_meeting_participations;
create policy "Booking participants can read own zoom participation events"
on public.zoom_meeting_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = zoom_meeting_participations.booking_id
      and (
        public.is_current_patient_profile(bookings.patient_profile_id)
        or public.is_current_therapist_profile(bookings.therapist_profile_id)
      )
  )
);

drop policy if exists "No direct authenticated access to zoom meeting jobs"
on public.zoom_meeting_jobs;
create policy "No direct authenticated access to zoom meeting jobs"
on public.zoom_meeting_jobs
for all
to authenticated
using (false)
with check (false);

drop policy if exists "No direct authenticated access to zoom webhook events"
on public.zoom_webhook_events;
create policy "No direct authenticated access to zoom webhook events"
on public.zoom_webhook_events
for all
to authenticated
using (false)
with check (false);

comment on function public.reserve_zoom_meeting_job_v1(text, timestamptz) is
  'Reserva atomica de jobs Zoom com recuperacao de locks processing expirados apos 5 minutos.';

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
    where id = v_zoom_meeting.id
      and status not in ('ended', 'canceled', 'failed');
  elsif p_event_type in ('meeting.ended', 'meeting.ended.v2') then
    update public.zoom_meetings
    set status = 'ended',
        actual_ended_at = coalesce(actual_ended_at, p_event_at),
        last_synced_at = now(),
        updated_at = now()
    where id = v_zoom_meeting.id
      and status <> 'canceled';
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
      waiting_room_at,
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
      case when p_event_type like '%waiting%' or p_event_type like '%admitted%' then p_event_at else null end,
      case when p_event_type like '%joined%' then p_event_at else null end,
      case when p_event_type like '%left%' then p_event_at else null end,
      p_duration_seconds,
      nullif(p_provider_user_id, ''),
      jsonb_build_object('source', 'zoom_webhook')
    );
  end if;
end;
$$;
