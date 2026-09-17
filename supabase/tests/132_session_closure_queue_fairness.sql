begin;
select no_plan();
-- All fixture preparation, including copied rows, is restored by rollback.
update public.bookings set status='cancelled_by_patient'
where therapist_profile_id='c1000000-0000-4000-8000-000000000001'
  and status in ('draft','pending_payment','confirmed')
  and id not in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
select public.ensure_video_session_for_paid_booking_v1('f2000000-0000-4000-8000-000000000001','development','queue-fairness');
select public.ensure_video_session_for_paid_booking_v1('f2000000-0000-4000-8000-000000000002','development','queue-fairness');
-- Isolate the selection queue, not the original database.
delete from public.video_session_control_jobs;
update public.video_sessions set status='ended',termination_confirmed_at=now()
where booking_id not in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
delete from public.booking_events where event_type='zoom_waiting_room_entered'
 and booking_id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
delete from public.video_session_participations
 where booking_id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
delete from public.session_confirmation_incidents
 where booking_id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
update public.bookings set starts_at=now()-interval '2 hours',ends_at=now()-interval '90 minutes',
 status='confirmed',payment_status='paid',meeting_provider='zoom',version=221
 where id='f2000000-0000-4000-8000-000000000001';
update public.bookings set starts_at=now()-interval '30 minutes',ends_at=now()-interval '10 minutes',
 status='confirmed',payment_status='paid',meeting_provider='zoom',version=222
 where id='f2000000-0000-4000-8000-000000000002';
update public.session_payments set financial_status='paid'
 where booking_id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
update public.video_sessions session set status='active',scheduled_starts_at=booking.starts_at,
 scheduled_ends_at=booking.ends_at,hard_ends_at=null,
 provider_session_id='queue-exact-'||booking.id::text,
 termination_reason=null,termination_requested_at=null,termination_confirmed_at=null,actual_ended_at=null
 from public.bookings booking where booking.id=session.booking_id
 and booking.id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
select public.enqueue_video_session_control_job_v1(
 (select id from public.video_sessions where booking_id='f2000000-0000-4000-8000-000000000001'),
 'end_scheduled','old-queue-recovery',now()+interval '1 hour','{}');
update public.video_session_control_jobs set status='retry',attempts=2;
select public.enqueue_due_video_session_control_jobs_v1('development',1,120);
select is((select count(*)::integer from public.video_session_control_jobs
 where booking_id='f2000000-0000-4000-8000-000000000002' and operation='end_scheduled'),
 1,'old recovery job ahead of limit does not prevent new scheduled closure');
select is((select next_run_at from public.video_session_control_jobs where idempotency_key='old-queue-recovery'),
 now()+interval '1 hour','scanner preserves the old retry recovery interval');
select public.enqueue_due_video_session_control_jobs_v1('development',1,120);
select is((select count(*)::integer from public.video_session_control_jobs where operation='end_scheduled'),
 2,'repeated queue selection is idempotent');
select is((select booking_id from public.reserve_video_session_control_jobs_v1('development',1,60)),
 'f2000000-0000-4000-8000-000000000002'::uuid,'new due closure is reserved despite older recovery job');
select is((select provider_session_id from public.video_sessions where booking_id='f2000000-0000-4000-8000-000000000002'),
 'queue-exact-f2000000-0000-4000-8000-000000000002','reservation preserves the exact provider room identifier');
update public.video_session_control_jobs set status='dead_letter' where idempotency_key='old-queue-recovery';
delete from public.video_session_control_jobs where booking_id='f2000000-0000-4000-8000-000000000002';
update public.video_sessions set termination_reason=null,termination_requested_at=null
 where booking_id='f2000000-0000-4000-8000-000000000002';
select public.enqueue_due_video_session_control_jobs_v1('development',1,120);
select is((select count(*)::integer from public.video_session_control_jobs
 where booking_id='f2000000-0000-4000-8000-000000000002' and operation='end_scheduled'),
 1,'persistent old failure does not starve a new room');
-- A timezone-only edit is not an effective reschedule.
create temporary table current_attempt_before as select public.current_session_attempt_id_v1(
 'f2000000-0000-4000-8000-000000000002') as id;
update public.bookings set timezone='UTC' where id='f2000000-0000-4000-8000-000000000002';
select is(public.current_session_attempt_id_v1('f2000000-0000-4000-8000-000000000002'),
 (select id from current_attempt_before),'timezone metadata alone does not create another attendance attempt');
-- Operational refund authorization must not cancel pending physical closure.
delete from public.video_session_control_jobs;
select public.finalize_due_session_attendance_v1(now(),100);
select set_config('request.jwt.claim.sub',(select id::text from public.profiles
 where role='admin' and auth_deleted_at is null and anonymized_at is null limit 1),true);
select public.admin_resolve_session_attendance_v1(
 (select id from public.session_confirmation_incidents where booking_id='f2000000-0000-4000-8000-000000000002'
  and session_attempt_id=public.current_session_attempt_id_v1(booking_id)),
 'refund','Ausência constatada; reembolso integral autorizado pelo Admin.',
 'f2000000-0000-4000-8000-000000000701');
select is((select count(*)::integer from public.reserve_video_session_control_jobs_v1('development',50,60)
 where booking_id='f2000000-0000-4000-8000-000000000002' and operation='end_attendance_no_show'),
 1,'resolved non-performance/refund incident still permits exact room closure');
update public.video_sessions set termination_requested_at=null,termination_reason=null
 where booking_id='f2000000-0000-4000-8000-000000000002';
select public.mark_video_session_termination_requested_v1(
 (select id from public.video_sessions where booking_id='f2000000-0000-4000-8000-000000000002'),'attendance_no_show');
select is((select termination_reason from public.video_sessions where booking_id='f2000000-0000-4000-8000-000000000002'),
 'attendance_no_show','termination fencing remains available after Admin resolution');
delete from public.video_session_control_jobs;
select public.enqueue_video_session_control_job_v1(
 (select id from public.video_sessions where booking_id='f2000000-0000-4000-8000-000000000002'),
 'confirm_end','no-show-confirm-end',now(),'{}');
select is((select count(*)::integer from public.reserve_video_session_control_jobs_v1('development',50,60)),
 1,'provider confirmation retry recognizes absence termination');
-- Booking schedule changes invalidate pending work for the previous exact room.
update public.video_session_control_jobs set status='queued',locked_until_at=null;
update public.bookings set starts_at=now()+interval '3 days',ends_at=now()+interval '3 days 20 minutes'
 where id='f2000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.reserve_video_session_control_jobs_v1('development',50,60)),
 0,'absence confirmation cannot target a room after concurrent rescheduling');
select * from finish();
rollback;
