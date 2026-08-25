begin;

select plan(9);

select ok(
  'end_scheduled' = any(enum_range(null::public.video_session_control_operation)::text[]),
  'scheduled termination is a durable control operation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.synchronize_video_session_watchdog_v1(text,text,text,integer)',
    'EXECUTE'
  ),
  'service_role can synchronize the internal watchdog'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.synchronize_video_session_watchdog_v1(text,text,text,integer)',
    'EXECUTE'
  ),
  'authenticated users cannot manipulate the watchdog'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-schedule-watchdog'
);

update public.video_sessions
set status = 'active',
    actual_started_at = date_trunc('second', now() - interval '10 minutes'),
    scheduled_starts_at = now() - interval '10 minutes',
    scheduled_ends_at = now() + interval '40 minutes',
    provider_session_id = 'provider-schedule-watchdog',
    therapist_present = true,
    hard_ends_at = null,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select public.synchronize_video_session_watchdog_v1(
  session_name,
  provider_session_id,
  environment,
  240
)
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  (
    select hard_ends_at
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  (
    select actual_started_at + interval '240 minutes'
    from public.video_sessions
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'watchdog is calculated from actual start plus runtime duration'
);

select is(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  0,
  'normal session is not ended before scheduled end or watchdog'
);

update public.video_sessions
set scheduled_ends_at = now() - interval '1 second'
where booking_id = 'f2000000-0000-4000-8000-000000000001';

select cmp_ok(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  '>=',
  1,
  'scheduled end scan enqueues the normal termination'
);

select is(
  (
    select count(*)::integer
    from public.video_session_control_jobs
    where video_session_id = (
      select id
      from public.video_sessions
      where booking_id = 'f2000000-0000-4000-8000-000000000001'
    )
      and operation = 'end_scheduled'
  ),
  1,
  'scheduled end job is stored idempotently'
);

select is(
  (
    select count(*)::integer
    from public.video_session_control_jobs
    where video_session_id = (
      select id
      from public.video_sessions
      where booking_id = 'f2000000-0000-4000-8000-000000000001'
    )
      and operation = 'end_hard_timeout'
  ),
  0,
  'scheduled end does not masquerade as watchdog timeout'
);

select lives_ok(
  $$select public.enqueue_due_video_session_control_jobs_v1('development', 10, 120)$$,
  'repeated due scan preserves idempotency'
);

select * from finish();
rollback;
