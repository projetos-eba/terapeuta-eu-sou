begin;

select plan(21);

select has_column(
  'public',
  'video_sessions',
  'hard_ends_at',
  'video_sessions stores server-side hard end'
);

select has_column(
  'public',
  'video_sessions',
  'therapist_first_joined_at',
  'video_sessions stores provider-confirmed therapist presence'
);

select has_column(
  'public',
  'video_sessions',
  'therapist_token_issued_at',
  'video_sessions distinguishes token issuance from presence'
);

select has_table(
  'public',
  'video_session_control_jobs',
  'video session control jobs are durable'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.video_session_control_jobs',
    'SELECT'
  ),
  'authenticated clients cannot read control jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_video_session_control_jobs_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'service_role can reserve control jobs'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-lifecycle'
);

-- Keep this lifecycle scenario inside an active scheduled window. The shared
-- seed date is intentionally historical and would now exercise end_scheduled
-- before the therapist-absence branch introduced by the newer watchdog policy.
update public.video_sessions
set scheduled_starts_at = now() - interval '15 minutes',
    scheduled_ends_at = now() + interval '45 minutes'
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap',
  'session.user_joined',
  now() - interval '15 minutes',
  'provider-user-therapist',
  'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa',
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'true',
  'therapist presence is unlocked by provider user_joined'
);

select isnt(
  (
    select therapist_first_joined_at::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'therapist first join timestamp is persisted'
);

select isnt(
  (
    select hard_ends_at::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'hard end is computed from max duration during provider event'
);

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap',
  'session.user_joined',
  now() - interval '15 minutes',
  'provider-user-therapist',
  'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa',
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::text
    from public.video_session_participations
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
      and participant_role = 'therapist'
      and event_type = 'session.user_joined'
      and participant_correlation_key = 'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  '1',
  'duplicate provider join does not duplicate participation audit'
);

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap',
  'session.user_left',
  now() - interval '10 minutes',
  'provider-user-therapist',
  'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa',
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'false',
  'therapist leaving locks patient access again'
);

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap',
  'session.ended',
  now() - interval '9 minutes',
  null,
  null,
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select status::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'active',
  'early provider end preserves the logical session for reentry'
);

select is(
  (
    select provider_session_id
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'early provider end clears the remote instance identifier'
);

select is(
  (
    select termination_confirmed_at::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'early provider end does not confirm a terminal session'
);

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap-rejoin',
  'session.user_joined',
  now() - interval '8 minutes',
  'provider-user-therapist',
  'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa',
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select therapist_present::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'true',
  'therapist rejoin restores provider-confirmed presence'
);

select is(
  (
    select provider_session_id
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'provider-session-pgtap-rejoin',
  'therapist rejoin stores the new remote instance identifier'
);

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap-rejoin',
  'session.user_left',
  now() - interval '7 minutes',
  'provider-user-therapist',
  'tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa',
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 30),
  0,
  'temporary therapist absence does not enqueue logical termination'
);

select is(
  (
    select count(*)::text
    from public.video_session_control_jobs
    where video_session_id = (
      select id
      from public.video_sessions
      where booking_id = 'f2000000-0000-4000-8000-000000000001'
    )
      and operation = 'end_therapist_absent'
  ),
  '0',
  'therapist absence remains reentrant throughout the scheduled window'
);

select is(
  (
    select count(*)::integer
    from public.reserve_video_session_control_jobs_v1('development', 10, 60)
  ),
  0,
  'maintenance does not reserve a terminal job for temporary absence'
);

update public.video_sessions
set termination_reason = 'manual_end',
    termination_requested_at = now()
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select public.apply_zoom_video_session_event_v1(
  session_name,
  'provider-session-pgtap-rejoin',
  'session.ended',
  now(),
  null,
  null,
  null,
  45,
  30
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select status::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'ended',
  'authorized final end remains terminal'
);

select isnt(
  (
    select termination_confirmed_at::text
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  null,
  'authorized final end is confirmed by the provider event'
);

select * from finish();

rollback;
