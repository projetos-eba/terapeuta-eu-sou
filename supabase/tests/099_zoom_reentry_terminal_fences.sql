begin;

select plan(14);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-reentry-terminal-fences'
);

create temporary view target_video as
select *
from public.video_sessions
where booking_id = 'f2000000-0000-4000-8000-000000000001';

update public.video_sessions
set status = 'active',
    scheduled_starts_at = now() - interval '15 minutes',
    scheduled_ends_at = now() + interval '45 minutes',
    hard_ends_at = now() + interval '240 minutes',
    provider_session_id = 'provider-reentry-fences',
    therapist_present = false,
    therapist_last_left_at = now() - interval '10 minutes',
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    actual_ended_at = null
where id = (select id from target_video);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_video);

select public.enqueue_video_session_control_job_v1(
  (select id from target_video),
  'end_therapist_absent',
  'test-reentry-legacy-absence',
  now(),
  '{}'
);
select public.enqueue_video_session_control_job_v1(
  (select id from target_video),
  'reconcile_orphan',
  'test-reentry-legacy-orphan',
  now(),
  '{}'
);

select is(
  (select count(*)::integer from public.reserve_video_session_control_jobs_v1('development', 10, 60)),
  0,
  'already queued legacy jobs are not reservable'
);
select ok(
  (select status = 'active' and termination_requested_at is null from target_video),
  'legacy jobs do not fence a reentrant encounter'
);

select public.mark_video_session_termination_requested_v1((select id from target_video), 'therapist_absent');
select public.mark_video_session_termination_requested_v1((select id from target_video), 'reconcile_orphan');
select ok(
  (select termination_requested_at is null and termination_reason is null from target_video),
  'legacy request reasons are defensive no-ops'
);

select public.mark_video_session_termination_confirmed_v1((select id from target_video), 'therapist_absent');
select public.mark_video_session_termination_confirmed_v1((select id from target_video), 'reconcile_orphan');
select ok(
  (select status = 'active' and termination_confirmed_at is null from target_video),
  'legacy confirmation reasons cannot end the encounter'
);
select is(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  0,
  'absence past the former grace enqueues no terminal work'
);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_video);
update public.video_sessions
set scheduled_ends_at = now() - interval '1 second',
    hard_ends_at = now() + interval '180 minutes'
where id = (select id from target_video);

select cmp_ok(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  '>=',
  1,
  'scheduled end enqueues terminal work'
);
select ok(
  exists(select 1 from public.video_session_control_jobs where video_session_id = (select id from target_video) and operation = 'end_scheduled'),
  'scheduled end job is present'
);
create temporary table scheduled_jobs as
select * from public.reserve_video_session_control_jobs_v1('development', 10, 60);
select is(
  (select operation::text from scheduled_jobs limit 1),
  'end_scheduled',
  'scheduled end job is reservable'
);
select ok(
  (select termination_requested_at is not null and termination_reason = 'scheduled_end' from target_video),
  'scheduled reservation creates the authorized fence'
);
select public.mark_video_session_termination_confirmed_v1((select id from target_video), 'scheduled_end');
select ok(
  (select status = 'ended' and termination_reason = 'scheduled_end' and termination_confirmed_at is not null from target_video),
  'scheduled end remains terminal'
);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_video);
update public.video_sessions
set status = 'active',
    scheduled_ends_at = now() + interval '45 minutes',
    hard_ends_at = now() - interval '1 second',
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    actual_ended_at = null
where id = (select id from target_video);

select cmp_ok(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  '>=',
  1,
  'hard timeout enqueues terminal work'
);
create temporary table hard_timeout_jobs as
select * from public.reserve_video_session_control_jobs_v1('development', 10, 60);
select is(
  (select operation::text from hard_timeout_jobs limit 1),
  'end_hard_timeout',
  'hard timeout job is reservable'
);
select public.mark_video_session_termination_confirmed_v1((select id from target_video), 'hard_timeout');
select ok(
  (select status = 'ended' and termination_reason = 'hard_timeout' and termination_confirmed_at is not null from target_video),
  'hard timeout remains terminal'
);

update public.video_sessions
set status = 'active',
    scheduled_ends_at = now() + interval '4 minutes',
    hard_ends_at = now() + interval '180 minutes',
    termination_reason = 'manual_end',
    termination_requested_at = now(),
    termination_confirmed_at = null,
    actual_ended_at = null
where id = (select id from target_video);
select public.mark_video_session_termination_confirmed_v1((select id from target_video), 'manual_end');
select ok(
  (select status = 'ended' and termination_reason = 'manual_end' and termination_confirmed_at is not null from target_video),
  'previously authorized manual end remains terminal'
);

select * from finish();
rollback;
