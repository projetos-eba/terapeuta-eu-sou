begin;

select plan(14);

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

select cmp_ok(
  (
    select public.enqueue_due_video_session_control_jobs_v1(
      'development',
      10,
      30
    )
  ),
  '>=',
  1,
  'maintenance enqueue detects therapist absence'
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
  '1',
  'therapist absence job is idempotently stored'
);

select cmp_ok(
  (
    select count(*)::integer
    from public.reserve_video_session_control_jobs_v1(
      'development',
      10,
      60
    )
  ),
  '>=',
  1,
  'maintenance can reserve queued lifecycle jobs'
);

select * from finish();

rollback;
