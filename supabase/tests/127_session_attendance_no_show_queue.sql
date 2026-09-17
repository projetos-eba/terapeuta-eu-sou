begin;

select plan(23);

update public.bookings set status = 'cancelled_by_patient'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status in ('draft','pending_payment','confirmed')
  and id not in (
    'f2000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000002'
  );

select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001', 'development', 'pgtap-attendance-queue'
);
select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000002', 'development', 'pgtap-attendance-queue'
);

delete from public.video_session_control_jobs
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);
delete from public.video_session_participations
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);
delete from public.booking_events
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
)
  and event_type = 'zoom_waiting_room_entered';

update public.bookings
set starts_at = now() - interval '2 hours',
    ends_at = now() - interval '90 minutes',
    status = 'confirmed', payment_status = 'paid',
    meeting_provider = 'zoom', version = 81
where id = 'f2000000-0000-4000-8000-000000000001';
update public.bookings
set starts_at = now() - interval '12 minutes',
    ends_at = now() - interval '1 minute',
    status = 'confirmed', payment_status = 'paid',
    meeting_provider = 'zoom', version = 82
where id = 'f2000000-0000-4000-8000-000000000002';
-- Backdated test sessions must retain the creation time of their attempt.
update public.booking_session_attempts attempt
set created_at = booking.starts_at - interval '1 day'
from public.bookings booking
where attempt.id = public.current_session_attempt_id_v1(booking.id)
  and booking.id in (
    'f2000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000002'
  );
update public.session_payments
set financial_status = 'paid'
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);
create temporary table attendance_queue_payment_before as
select booking_id, to_jsonb(payment) as payment_snapshot
from public.session_payments payment
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);
update public.video_sessions session
set status = 'ready',
    scheduled_starts_at = booking.starts_at,
    scheduled_ends_at = booking.ends_at,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null,
    actual_ended_at = null
from public.bookings booking
where session.booking_id = booking.id
  and booking.id in (
    'f2000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000002'
  );

insert into public.video_session_participations (
  video_session_id, booking_id, participant_correlation_key,
  participant_role, event_type, joined_at, metadata
)
select session.id, session.booking_id, 'attendance-queue-' || role.role,
  role.role::public.video_session_participant_role,
  'session.user_joined', booking.starts_at + interval '1 minute', '{}'::jsonb
from public.video_sessions session
join public.bookings booking on booking.id = session.booking_id
cross join (values ('patient'), ('therapist')) as role(role)
where session.booking_id = 'f2000000-0000-4000-8000-000000000001';

select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000001')->>'bothJoined',
  'true',
  'an old normal encounter has two trusted entries'
);

insert into public.booking_events (
  booking_id, event_type, request_id, source, payload, created_at
)
select booking.id, 'zoom_waiting_room_entered', 'attendance-queue-stale',
  'pgtap', jsonb_build_object(
    'bookingVersion', booking.version - 1,
    'scheduledStartsAt', booking.starts_at,
    'participantRole', 'patient'
  ), booking.starts_at + interval '1 minute'
from public.bookings booking
where booking.id = 'f2000000-0000-4000-8000-000000000002';

select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'patientPresentAtTolerance',
  'false',
  'an arrival from an older booking version does not count'
);

insert into public.booking_events (
  booking_id, event_type, request_id, source, payload, created_at
)
select booking.id, 'zoom_waiting_room_entered', 'attendance-queue-current',
  'pgtap', jsonb_build_object(
    'bookingVersion', booking.version,
    'scheduledStartsAt', booking.starts_at,
    'participantRole', 'patient'
  ), booking.starts_at + interval '5 minutes'
from public.bookings booking
where booking.id = 'f2000000-0000-4000-8000-000000000002';

select public.finalize_due_session_attendance_v1(
    (select starts_at + interval '10 minutes' from public.bookings
      where id = 'f2000000-0000-4000-8000-000000000002'), 1
  );
select is(
  (select status::text from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000002'),
  'confirmed',
  'the exact T+10 boundary does not finalize attendance'
);

select is(
  public.finalize_due_session_attendance_v1(
    (select starts_at + interval '10 minutes 1 millisecond' from public.bookings
      where id = 'f2000000-0000-4000-8000-000000000002'), 1
  ),
  1,
  'a normal old encounter does not starve a later therapist absence at limit one'
);

select is(
  (select status::text from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000002'),
  'no_show_therapist',
  'patient-only arrival is classified as therapist no-show'
);
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'classification',
  'no_show_therapist',
  'the incident remains visible after the status transition increments the booking version'
);
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'patientPresentAtTolerance',
  'true',
  'the current attendance view retains the patient arrival from before the status increment'
);
select set_config('request.jwt.claim.sub',
  (select patient.user_id::text from public.bookings booking
   join public.patient_profiles patient on patient.id = booking.patient_profile_id
   where booking.id = 'f2000000-0000-4000-8000-000000000002'), true);
select is(
  public.get_session_feedback_v2('f2000000-0000-4000-8000-000000000002')->>'status',
  'unavailable',
  'the participant cannot rate a session without bilateral entry'
);
select throws_ok(
  $$select public.record_session_participant_confirmation_v1(
    (select patient.user_id from public.bookings booking
      join public.patient_profiles patient on patient.id = booking.patient_profile_id
      where booking.id = 'f2000000-0000-4000-8000-000000000002'),
    'f2000000-0000-4000-8000-000000000002',
    'completed', 'f2000000-0000-4000-8000-000000000099', 'manual', now()
  )$$,
  '42501', 'SESSION_CONFIRMATION_ATTENDANCE_REQUIRED',
  'the server rejects completed confirmation for therapist absence'
);
select is(
  (select status::text from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000001'),
  'confirmed',
  'the normal old encounter remains unchanged'
);
select is(
  (select to_jsonb(payment) from public.session_payments payment
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  (select payment_snapshot from attendance_queue_payment_before
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  'no-show classification does not change payment or Transfer state'
);
select is(
  (select count(*)::integer from public.video_session_control_jobs
   where booking_id = 'f2000000-0000-4000-8000-000000000002'
     and operation = 'end_attendance_no_show'),
  1,
  'the absent therapist queues a version-fenced room shutdown'
);

create temporary table attendance_reserved as
select * from public.reserve_video_session_control_jobs_v1('development', 50, 60)
where booking_id = 'f2000000-0000-4000-8000-000000000002';
select is(
  (select operation::text from attendance_reserved limit 1),
  'end_attendance_no_show',
  'the ready room can be reserved for a safely fenced shutdown'
);
select ok(
  (select termination_reason = 'attendance_no_show'
    and termination_requested_at is not null
   from public.video_sessions
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  'reservation blocks further access before the provider is contacted'
);

select public.mark_video_session_termination_confirmed_v1(
  (select video_session_id from attendance_reserved limit 1),
  'attendance_no_show'
);
select is(
  (select status::text from public.video_sessions
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  'ended',
  'a confirmed provider closure ends the logical room'
);
select is(
  (select to_jsonb(payment) from public.session_payments payment
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  (select payment_snapshot from attendance_queue_payment_before
   where booking_id = 'f2000000-0000-4000-8000-000000000002'),
  'physical closure also leaves payment and Transfer state unchanged'
);
select is(
  public.finalize_due_session_attendance_v1(now(), 1),
  0,
  'repeating the classifier after closure is idempotent'
);

update public.bookings
set status = 'confirmed', version = 83,
    starts_at = '2040-01-16T21:00:00Z',
    ends_at = '2040-01-16T21:20:00Z'
where id = 'f2000000-0000-4000-8000-000000000002';
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'classification',
  null,
  'rescheduling to a new version does not inherit the old incident'
);
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'patientPresentAtTolerance',
  'false',
  'rescheduling does not inherit old waiting-room evidence'
);
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'sessionClosed',
  'false', 'an ended room from the old schedule cannot prematurely close the rescheduled encounter'
);

update public.bookings
set starts_at = now() - interval '4 hours',
    ends_at = now() - interval '3 hours'
where id = 'f2000000-0000-4000-8000-000000000002';
update public.video_sessions session
set scheduled_starts_at = booking.starts_at,
    scheduled_ends_at = booking.ends_at,
    actual_ended_at = booking.ends_at
from public.bookings booking
where session.booking_id = booking.id
  and booking.id = 'f2000000-0000-4000-8000-000000000002';
insert into public.booking_events (
  booking_id, event_type, request_id, source, payload, created_at
)
select booking.id, 'zoom_waiting_room_entered', 'attendance-review-' || role.role,
  'pgtap', jsonb_build_object(
    'bookingVersion', booking.version,
    'scheduledStartsAt', booking.starts_at,
    'participantRole', role.role
  ), booking.starts_at + interval '1 minute'
from public.bookings booking
cross join (values ('patient'), ('therapist')) as role(role)
where booking.id = 'f2000000-0000-4000-8000-000000000002';

-- A different, older patient no-show is waiting for safe provider closure.
-- That pending work must not consume the one-item classification page.
delete from public.video_session_participations
where booking_id = 'f2000000-0000-4000-8000-000000000001'
  and participant_role = 'patient';
select public.enqueue_video_session_control_job_v1(
  (select id from public.video_sessions
   where booking_id = 'f2000000-0000-4000-8000-000000000001'),
  'end_patient_no_show', 'attendance-pending-closure-pgtap', now(),
  (select jsonb_build_object(
    'bookingVersion', booking.version,
    'scheduledStartsAt', booking.starts_at::text
  ) from public.bookings booking
   where booking.id = 'f2000000-0000-4000-8000-000000000001')
);
select is(
  public.finalize_due_session_attendance_v1(now(), 1),
  1,
  'pending provider closure on an older booking does not starve later review'
);
select is(
  public.session_attendance_state_v1('f2000000-0000-4000-8000-000000000002')->>'classification',
  'requires_review',
  'two timely arrivals without bilateral trusted joins require Admin review after the end'
);
select is(
  public.get_session_feedback_v2('f2000000-0000-4000-8000-000000000002')->>'status',
  'unavailable',
  'incomplete bilateral entry cannot offer a quality form'
);

select * from finish();
rollback;
