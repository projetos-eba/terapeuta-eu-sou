begin;

select plan(13);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-same-provider-reentry'
);

update public.video_sessions
set status = 'ready',
    provider_session_id = null,
    actual_started_at = null,
    hard_ends_at = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    therapist_present = false,
    participant_count = 0,
    metadata = '{}',
    scheduled_starts_at = now() - interval '15 minutes',
    scheduled_ends_at = now() + interval '45 minutes'
where booking_id = 'f2000000-0000-4000-8000-000000000001';

delete from public.video_session_participations
where booking_id = 'f2000000-0000-4000-8000-000000000001';

create temporary view target_video as
select *
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

create function pg_temp.emit(
  p_event text,
  p_age_seconds integer,
  p_role_key text default null
)
returns void
language sql
as $$
  select public.apply_zoom_video_session_event_v1(
    session_name,
    'provider-reused-by-zoom',
    p_event,
    now() - make_interval(secs => p_age_seconds),
    'development',
    p_role_key,
    p_role_key,
    null,
    240,
    30
  )
  from target_video;
$$;

select pg_temp.emit('session.user_joined', 600, 'tes-v1-t-host');
select ok(
  (select therapist_present and provider_session_id = 'provider-reused-by-zoom' from target_video),
  'first trusted host join establishes provider presence'
);
select is(
  (select metadata ->> 'zoom_provider_epoch' from target_video),
  '1',
  'first provider lifecycle uses epoch one'
);

select pg_temp.emit('session.user_joined', 590, 'tes-v1-p-patient');
select is(
  (select participant_count from target_video),
  2,
  'first epoch includes both participants'
);

select pg_temp.emit('session.ended', 300);
select ok(
  (select status = 'active' and not therapist_present and provider_session_id is null from target_video),
  'technical close clears only current presence before the scheduled end'
);

-- Zoom may reuse the same provider session ID after the empty room closes.
select pg_temp.emit('session.user_joined', 180, 'tes-v1-t-host');
select ok(
  (select therapist_present and provider_session_id = 'provider-reused-by-zoom' from target_video),
  'host reentry with the same provider ID restores current presence'
);
select is(
  (select metadata ->> 'zoom_provider_epoch' from target_video),
  '2',
  'same provider ID opens a distinct reentry epoch'
);
select is(
  (select participant_count from target_video),
  1,
  'new epoch never revives the patient from the prior provider lifecycle'
);

-- A delayed close from epoch one cannot clear the host who is back in epoch two.
select pg_temp.emit('session.ended', 250);
select ok(
  (select therapist_present and provider_session_id = 'provider-reused-by-zoom' from target_video),
  'late close from the prior epoch is ignored after same-ID reentry'
);

select pg_temp.emit('session.user_joined', 170, 'tes-v1-p-patient');
select is(
  (select participant_count from target_video),
  2,
  'patient may join the restored current epoch'
);
select is(
  (select count(*) from public.video_session_participations where booking_id = 'f2000000-0000-4000-8000-000000000001' and metadata ->> 'provider_epoch' = '2'),
  2::bigint,
  'participations retain the active provider epoch for audit'
);

select pg_temp.emit('session.user_left', 160, 'tes-v1-t-host');
select ok(
  (select not therapist_present from target_video),
  'host leave still clears presence inside the active epoch'
);
select pg_temp.emit('session.user_joined', 150, 'tes-v1-t-host');
select ok(
  (select therapist_present from target_video),
  'ordinary reconnect inside the active epoch remains reentrant'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_zoom_video_session_event_v1(text,text,text,timestamptz,text,text,text,integer,integer,integer)',
    'EXECUTE'
  ),
  'same-provider reentry handler remains unavailable to authenticated users'
);

select * from finish();
rollback;
