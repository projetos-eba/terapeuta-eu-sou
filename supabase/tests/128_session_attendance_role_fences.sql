begin;
select plan(7);
select public.ensure_video_session_for_paid_booking_v1(
  'f2000000-0000-4000-8000-000000000001', 'development', 'attendance-role-fences'
);
create temporary view target_booking as select * from public.bookings
where id = 'f2000000-0000-4000-8000-000000000001';
create temporary view target_session as select * from public.video_sessions
where booking_id = (select id from target_booking);
delete from public.video_session_control_jobs where booking_id = (select id from target_booking);
delete from public.video_session_participations where booking_id = (select id from target_booking);
delete from public.booking_events where booking_id = (select id from target_booking)
  and event_type = 'zoom_waiting_room_entered';
update public.bookings set starts_at = now() - interval '12 minutes',
  ends_at = now() + interval '8 minutes', status = 'confirmed',
  payment_status = 'paid', meeting_provider = 'zoom', version = 121
where id = (select id from target_booking);
update public.session_payments set financial_status = 'paid'
where booking_id = (select id from target_booking);
update public.video_sessions set status = 'active',
  scheduled_starts_at = (select starts_at from target_booking),
  scheduled_ends_at = (select ends_at from target_booking),
  provider_session_id = 'attendance-role-fence-exact-id',
  termination_reason = null, termination_requested_at = null,
  termination_confirmed_at = null, actual_ended_at = null
where id = (select id from target_session);
insert into public.booking_events (booking_id, event_type, request_id, source, payload, created_at)
select id, 'zoom_waiting_room_entered', 'attendance-role-therapist', 'pgtap',
  jsonb_build_object('bookingVersion', version, 'scheduledStartsAt', starts_at,
    'participantRole', 'therapist'), starts_at + interval '1 minute' from target_booking;
-- A trusted join from a previous schedule must not count for this encounter.
insert into public.video_session_participations (video_session_id, booking_id,
  participant_correlation_key, participant_role, event_type, joined_at, metadata)
select id, booking_id, 'attendance-role-old-patient', 'patient',
  'session.user_joined', now() - interval '1 day', '{}'::jsonb from target_session;
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select is((select count(*)::integer from public.video_session_control_jobs
  where booking_id = (select id from target_booking) and operation = 'end_patient_no_show'
    and status = 'queued'), 1, 'therapist arrival and old patient join do not prevent patient-no-show work');
select public.enqueue_due_video_session_control_jobs_v1('development', 50, 120);
select is((select status::text from public.video_session_control_jobs
  where booking_id = (select id from target_booking) and operation = 'end_patient_no_show'),
  'queued', 'a repeated scan does not supersede patient absence with therapist evidence');
select is((select count(*)::integer from public.reserve_video_session_control_jobs_v1('development', 50, 60)
  where booking_id = (select id from target_booking) and operation = 'end_patient_no_show'),
  1, 'patient-no-show work remains reservable with only the therapist present');
select ok((select termination_reason = 'patient_no_show' and termination_requested_at is not null
  from target_session), 'role-specific reserve sets the terminal fence');
select public.mark_video_session_termination_confirmed_v1((select id from target_session), 'patient_no_show');
update public.video_session_control_jobs set status = 'done'
where booking_id = (select id from target_booking) and operation = 'end_patient_no_show';
select public.finalize_due_session_attendance_v1(now(), 50);
select is((select status::text from target_booking), 'no_show_patient', 'therapist-only arrival classifies patient absence');
-- Legacy late arrivals cannot restore access entitlement even when an event exists.
create or replace temporary view target_booking as select * from public.bookings
where id = 'f2000000-0000-4000-8000-000000000002';
delete from public.booking_events where booking_id = (select id from target_booking)
  and event_type = 'zoom_waiting_room_entered';
delete from public.video_session_participations where booking_id = (select id from target_booking);
update public.bookings set starts_at = now() - interval '12 minutes',
  ends_at = now() + interval '8 minutes', status = 'confirmed',
  payment_status = 'paid', meeting_provider = 'zoom' where id = (select id from target_booking);
update public.session_payments set financial_status = 'paid'
where booking_id = (select id from target_booking);
insert into public.booking_events (booking_id, event_type, request_id, source, payload, created_at)
select id, 'zoom_waiting_room_entered', 'attendance-role-late-therapist', 'pgtap',
  jsonb_build_object('bookingVersion', version, 'scheduledStartsAt', starts_at,
    'participantRole', 'therapist'), starts_at + interval '11 minutes' from target_booking;
select is(public.record_zoom_waiting_room_arrival_v2((select id from target_booking),
  (select therapist_profile_id from target_booking), 'therapist', now())->>'entitled',
  'false', 'late therapist event does not renew entitlement');
select is(public.session_attendance_state_v1((select id from target_booking))->>'therapistPresentAtTolerance',
  'false', 'late and previous-version therapist events do not count as timely presence');
select * from finish();
rollback;
