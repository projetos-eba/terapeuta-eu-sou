begin;
select plan(10);
create temporary view target_booking as select * from public.bookings
where id = 'f2000000-0000-4000-8000-000000000002';
select public.ensure_video_session_for_paid_booking_v1((select id from target_booking), 'development', 'attendance-report-version');
delete from public.video_session_control_jobs where booking_id = (select id from target_booking);
delete from public.video_session_participations where booking_id = (select id from target_booking);
delete from public.booking_events where booking_id = (select id from target_booking) and event_type = 'zoom_waiting_room_entered';
delete from public.session_feedback where booking_id = (select id from target_booking);
delete from public.session_participant_confirmations where booking_id = (select id from target_booking);
delete from public.session_confirmation_incidents where booking_id = (select id from target_booking);
update public.bookings set starts_at = now() - interval '21 minutes', ends_at = now() - interval '1 minute',
  status = 'confirmed', payment_status = 'paid', meeting_provider = 'zoom' where id = (select id from target_booking);
update public.session_payments set financial_status = 'paid' where booking_id = (select id from target_booking);
create temporary table attendance_report_payment_before as
select to_jsonb(payment) as snapshot from public.session_payments payment
where booking_id = (select id from target_booking);
update public.video_sessions session set status = 'ready', scheduled_starts_at = booking.starts_at,
  scheduled_ends_at = booking.ends_at, termination_reason = null, termination_requested_at = null,
  termination_confirmed_at = null, actual_ended_at = null
from target_booking booking where session.booking_id = booking.id;
insert into public.booking_events (booking_id, event_type, request_id, source, payload, created_at)
select id, 'zoom_waiting_room_entered', 'attendance-report-patient', 'pgtap',
  jsonb_build_object('bookingVersion', version, 'scheduledStartsAt', starts_at, 'participantRole', 'patient'),
  starts_at + interval '1 minute' from target_booking;
select public.finalize_due_session_attendance_v1(now(), 50);
select is((select count(*)::integer from public.session_confirmation_incidents
  where booking_id = (select id from target_booking)), 1, 'classification opens one incident');
select throws_ok($$select public.submit_session_feedback_for_actor_v1(
  (select patient.user_id from target_booking booking join public.patient_profiles patient on patient.id = booking.patient_profile_id),
  (select id from target_booking), 'completed', 4::smallint, null, '',
  'f2000000-0000-4000-8000-000000000199'::uuid
)$$, '22023', 'FEEDBACK_CONTRACT_VERSION_REQUIRED', 'the old feedback contract cannot confirm a session');
select throws_ok($$select public.submit_session_feedback_for_actor_v1(
  (select patient.user_id from target_booking booking join public.patient_profiles patient on patient.id = booking.patient_profile_id),
  (select id from target_booking), 'not_performed', null::smallint, 'therapist_absent',
  'Aguardei, mas o terapeuta não compareceu.', 'f2000000-0000-4000-8000-000000000129'::uuid
)$$, '22023', 'FEEDBACK_CONTRACT_VERSION_REQUIRED', 'the old report contract cannot rewrite realization');
select is((select count(*)::integer from public.session_feedback where booking_id = (select id from target_booking)),
  0, 'the incompatible request creates no legacy feedback');
select is((select count(*)::integer from public.session_confirmation_incidents
  where booking_id = (select id from target_booking)), 1, 'the same classified incident remains');
select ok((select classification = 'no_show_therapist' and opened_by_feedback_id is null
  and booking_version = (select version - 1 from target_booking)
  from public.session_confirmation_incidents where booking_id = (select id from target_booking)),
  'the classified absence remains system evidence, not participant opinion');
select is((select to_jsonb(payment) from public.session_payments payment
  where booking_id = (select id from target_booking)),
  (select snapshot from attendance_report_payment_before),
  'classification and rejected old feedback leave payment unchanged');
select set_config('request.jwt.claim.sub', (select therapist.user_id::text from target_booking booking
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id), true);
select is((select "attendanceStatus" from public.therapist_session_read_model_v1
  where "bookingId" = (select id from target_booking)), 'therapist_no_show', 'therapist read model exposes the classified current encounter');
update public.bookings set status = 'confirmed', starts_at = '2040-01-16T21:00:00Z', ends_at = '2040-01-16T21:20:00Z'
where id = (select id from target_booking);
select is((select "attendanceStatus" from public.therapist_session_read_model_v1
  where "bookingId" = (select id from target_booking)), 'pending', 'rescheduled therapist view does not inherit old absence');
select is((select "attendanceIncidentId"::text from public.therapist_session_read_model_v1
  where "bookingId" = (select id from target_booking)), null, 'old incident stays historical instead of becoming the rescheduled incident');
select * from finish();
rollback;
