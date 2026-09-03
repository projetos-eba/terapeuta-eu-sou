begin;

select plan(13);

select ok(
  has_function_privilege(
    'service_role',
    'public.enqueue_due_video_session_control_jobs_v1(text,integer,integer)',
    'EXECUTE'
  ),
  'service role can enqueue patient no-show maintenance'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.enqueue_due_video_session_control_jobs_v1(text,integer,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot enqueue patient no-show maintenance'
);

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001',
  'development',
  'pgtap-patient-no-show'
);

create temporary view target_booking as
select * from public.bookings
where id = 'f2000000-0000-4000-8000-000000000001';

create temporary view target_session as
select * from public.video_sessions
where booking_id = (select id from target_booking);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_session);
delete from public.video_session_participations
where video_session_id = (select id from target_session);
delete from public.booking_events
where booking_id = (select id from target_booking)
  and event_type = 'zoom_waiting_room_entered';

update public.bookings
set starts_at = now() - interval '10 minutes 1 millisecond',
    ends_at = now() + interval '40 minutes',
    status = 'confirmed',
    payment_status = 'paid',
    meeting_provider = 'zoom',
    version = 71
where id = (select id from target_booking);

update public.session_payments
set financial_status = 'paid'
where booking_id = (select id from target_booking);

update public.video_sessions
set status = 'active',
    scheduled_starts_at = (select starts_at from target_booking),
    scheduled_ends_at = (select ends_at from target_booking),
    provider_session_id = 'provider-patient-no-show',
    therapist_present = true,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    actual_ended_at = null
where id = (select id from target_session);

select cmp_ok(
  public.enqueue_due_video_session_control_jobs_v1('development', 10, 120),
  '>=',
  1,
  'absence after T+10 queues terminal work'
);

select ok(
  exists (
    select 1 from public.video_session_control_jobs
    where video_session_id = (select id from target_session)
      and operation = 'end_patient_no_show'
      and status in ('queued', 'retry')
  ),
  'patient no-show is represented by its own durable operation'
);

create temporary table no_show_jobs as
select * from public.reserve_video_session_control_jobs_v1('development', 10, 60)
where video_session_id = (select id from target_session);

select is(
  (select operation::text from no_show_jobs limit 1),
  'end_patient_no_show',
  'no-show work is reservable after revalidation'
);

select ok(
  (select termination_reason = 'patient_no_show' and termination_requested_at is not null from target_session),
  'reserved no-show work creates its dedicated terminal fence'
);

select public.mark_video_session_termination_confirmed_v1(
  (select id from target_session), 'patient_no_show'
);

select ok(
  (select status = 'ended' and termination_reason = 'patient_no_show' and termination_confirmed_at is not null from target_session),
  'confirmed patient no-show ends only the logical video session'
);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_session);
delete from public.video_session_participations
where video_session_id = (select id from target_session);
delete from public.booking_events
where booking_id = (select id from target_booking)
  and event_type = 'zoom_waiting_room_entered';

update public.bookings
set starts_at = now() - interval '10 minutes',
    ends_at = now() + interval '40 minutes',
    version = 72
where id = (select id from target_booking);

update public.video_sessions
set status = 'active',
    scheduled_starts_at = (select starts_at from target_booking),
    scheduled_ends_at = (select ends_at from target_booking),
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    actual_ended_at = null
where id = (select id from target_session);

select public.enqueue_due_video_session_control_jobs_v1('development', 10, 120);

select is(
  (select count(*)::integer from public.video_session_control_jobs
    where video_session_id = (select id from target_session)
      and operation = 'end_patient_no_show'),
  0,
  'T+10 exact does not queue a patient no-show'
);

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    (select id from target_booking),
    (select patient_profile_id from target_booking),
    now()
  )->>'entitled',
  'true',
  'patient arrival remains accepted exactly at T+10'
);

select public.enqueue_due_video_session_control_jobs_v1('development', 10, 120);

select is(
  (select count(*)::integer from public.video_session_control_jobs
    where video_session_id = (select id from target_session)
      and operation = 'end_patient_no_show'),
  0,
  'a current-version waiting-room arrival prevents no-show work for a late therapist'
);

delete from public.video_session_control_jobs
where video_session_id = (select id from target_session);
delete from public.booking_events
where booking_id = (select id from target_booking)
  and event_type = 'zoom_waiting_room_entered';

insert into public.video_session_participations (
  video_session_id, booking_id, participant_correlation_key,
  participant_role, event_type, joined_at, metadata
)
values (
  (select id from target_session), (select id from target_booking),
  'tes-v1-p-patient-no-show-pgtap', 'patient', 'session.user_joined',
  now() - interval '1 minute', '{}'::jsonb
);

update public.bookings
set starts_at = now() - interval '10 minutes 1 millisecond',
    ends_at = now() + interval '40 minutes',
    version = 73
where id = (select id from target_booking);

update public.video_sessions
set scheduled_starts_at = (select starts_at from target_booking),
    scheduled_ends_at = (select ends_at from target_booking)
where id = (select id from target_session);

select public.enqueue_due_video_session_control_jobs_v1('development', 10, 120);

select is(
  (select count(*)::integer from public.video_session_control_jobs
    where video_session_id = (select id from target_session)
      and operation = 'end_patient_no_show'),
  0,
  'a trusted patient video join preserves reentry until the scheduled end'
);

select public.enqueue_video_session_control_job_v1(
  (select id from target_session),
  'end_patient_no_show',
  'patient-no-show-stale-version-pgtap',
  now(),
  jsonb_build_object('bookingVersion', 72, 'scheduledStartsAt', '2000-01-01 00:00:00+00')
);
select public.enqueue_due_video_session_control_jobs_v1('development', 10, 120);

select is(
  (select status::text from public.video_session_control_jobs
    where idempotency_key = 'patient-no-show-stale-version-pgtap'),
  'done',
  'a stale patient no-show job is superseded after a booking version change'
);

select is(
  (select count(*)::integer from public.reserve_video_session_control_jobs_v1('development', 10, 60)
    where video_session_id = (select id from target_session)),
  0,
  'trusted patient participation cannot be fenced by stale no-show work'
);

select * from finish();
rollback;
