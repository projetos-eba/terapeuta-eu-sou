begin;
select no_plan();
-- Fixture isolation is transactional: the copied data is restored by rollback.
update public.bookings set status='cancelled_by_patient'
where therapist_profile_id='c1000000-0000-4000-8000-000000000001'
  and status in ('draft','pending_payment','confirmed')
  and id <> 'f2000000-0000-4000-8000-000000000002';
insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b1300000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2024-01-01 13:00:00+00', '2024-01-01 13:50:00+00',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents,
  financial_status, service_status, transfer_status, payment_flow_version,
  connect_account_id_snapshot, stripe_connect_account_id_snapshot,
  stripe_charge_id, stripe_payment_intent_id, paid_at, payment_due_at
)
select
  'b1300000-0000-4000-8000-000000000021',
  'b1300000-0000-4000-8000-000000000011',
  'b1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id, 10000, 1500, 1500, 8500,
  'paid', 'scheduled', 'transfer_pending', 'v10',
  account.id, account.stripe_account_id,
  'ch_test_v10_quality_130', 'pi_test_v10_quality_130',
  '2024-01-01 12:00:00+00', '2023-12-31 13:00:00+00'
from public.financial_policy_versions policy
cross join lateral (
  select id, stripe_account_id
  from public.therapist_connect_accounts
  where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
    and is_current
  order by created_at desc limit 1
) account
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer';

select public.ensure_video_session_for_paid_booking_v1('b1300000-0000-4000-8000-000000000011','development','quality-test');
select public.ensure_video_session_for_paid_booking_v1('f2000000-0000-4000-8000-000000000002','development','quality-test');
create temporary table quality_context as select booking.id,patient.user_id as patient_actor,
  therapist.user_id as therapist_actor,(select id from public.profiles where role='admin'
    and auth_deleted_at is null and anonymized_at is null limit 1) as admin_actor
from public.bookings booking join public.patient_profiles patient on patient.id=booking.patient_profile_id
join public.therapist_profiles therapist on therapist.id=booking.therapist_profile_id
where booking.id in ('b1300000-0000-4000-8000-000000000011','f2000000-0000-4000-8000-000000000002');
create function pg_temp.prepare_attempt(p_booking uuid,p_start timestamptz,p_patient boolean,p_therapist boolean)
returns void language plpgsql as $$
begin
  delete from public.video_session_control_jobs where booking_id=p_booking;
  delete from public.session_confirmation_incidents where booking_id=p_booking;
  update public.bookings set starts_at=p_start,ends_at=p_start+interval '20 minutes',
    status=case when status='completed' then status else 'confirmed'::public.booking_status end,
    payment_status='paid',meeting_provider='zoom' where id=p_booking;
  update public.booking_session_attempts set created_at=p_start-interval '1 day'
    where id=public.current_session_attempt_id_v1(p_booking);
  update public.session_payments set financial_status='paid',
    transfer_status='transferred' where booking_id=p_booking;
  update public.video_sessions set status='active',scheduled_starts_at=p_start,scheduled_ends_at=p_start+interval '20 minutes',
    termination_reason=null,termination_requested_at=null,termination_confirmed_at=null,actual_ended_at=null
    where booking_id=p_booking;
  if p_patient then
    insert into public.video_session_participations(video_session_id,booking_id,participant_correlation_key,participant_role,event_type,joined_at,metadata)
    select id,p_booking,'quality-test-patient','patient','session.user_joined',p_start+interval '1 minute','{}' from public.video_sessions where booking_id=p_booking;
  end if;
  if p_therapist then
    insert into public.video_session_participations(video_session_id,booking_id,participant_correlation_key,participant_role,event_type,joined_at,metadata)
    select id,p_booking,'quality-test-therapist','therapist','session.user_joined',p_start+interval '1 minute','{}' from public.video_sessions where booking_id=p_booking;
  end if;
end;
$$;
select pg_temp.prepare_attempt('b1300000-0000-4000-8000-000000000011',now()-interval '21 minutes',true,true);
select pg_temp.prepare_attempt('f2000000-0000-4000-8000-000000000002',now()-interval '2 days',true,true);
create temporary table financial_snapshot as
  select 'payments'::text as kind,md5(string_agg(to_jsonb(payment)::text,'' order by payment.id)) as fingerprint from public.session_payments payment
  union all select 'jobs',md5(string_agg(to_jsonb(job)::text,'' order by job.id)) from public.session_transfer_jobs job
  union all select 'transfers',md5(string_agg(to_jsonb(transfer)::text,'' order by transfer.id)) from public.stripe_transfers transfer;
select set_config('request.jwt.claim.sub',(select patient_actor::text from quality_context order by id limit 1),true);
select is(public.get_session_attempt_attendance_batch_v1(array['b1300000-0000-4000-8000-000000000011'::uuid])
  #>> '{b1300000-0000-4000-8000-000000000011,actorRealized}','false',
  'patient session remains pending before own private response');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->>'confirmationState','awaiting_both',
  'Transfer sent is not a participant confirmation');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->'policy'->>'transferSafetyHours','0','retired safety gate stays retired');
create temporary table positive_result as select public.submit_session_quality_feedback_v1(
  (select patient_actor from quality_context order by id limit 1),'b1300000-0000-4000-8000-000000000011',
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),true,5::smallint,null,'Teste positivo.',
  'f2000000-0000-4000-8000-000000000501') as result;
select is((select result->'feedback'->>'successful' from positive_result),'true','quality success stored separately');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),0,'positive quality does not record a participant confirmation');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->>'status','submitted','positive quality is no longer offered again to its author');
select is(public.get_session_attempt_attendance_batch_v1(array['b1300000-0000-4000-8000-000000000011'::uuid])
  #>> '{b1300000-0000-4000-8000-000000000011,actorRealized}','true',
  'own private response marks the patient encounter as realized without a public review');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->'actorConfirmation','null'::jsonb,'positive quality leaves internal confirmation untouched');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->'counterpartConfirmation','null'::jsonb,'positive quality does not affect the other participant confirmation');
select is(
  public.get_patient_therapist_review_v1('c1000000-0000-4000-8000-000000000001')->>'eligible',
  'true',
  'positive private quality makes the optional public review available without confirmation'
);
select set_config('request.jwt.claim.sub',(select therapist_actor::text from quality_context order by id limit 1),true);
select ok(exists(select 1 from public.therapist_pending_confirmation_rows_v1('c1000000-0000-4000-8000-000000000001')
  where booking_id='b1300000-0000-4000-8000-000000000011'),
  'therapist evaluation is pending before the own private response');
create temporary table negative_result as select public.submit_session_quality_feedback_v1(
  (select therapist_actor from quality_context order by id limit 1),'b1300000-0000-4000-8000-000000000011',
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),false,null::smallint,'internet_problem','Teste privado.',
  'f2000000-0000-4000-8000-000000000502') as result;
select is((select result->'feedback'->>'successful' from negative_result),'false','negative is quality, not non-performance');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),0,'negative quality does not record participant confirmation');
select set_config('request.jwt.claim.sub',(select therapist_actor::text from quality_context order by id limit 1),true);
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->>'status','submitted','negative quality is no longer offered again to its author');
select is(public.get_session_attempt_attendance_batch_v1(array['b1300000-0000-4000-8000-000000000011'::uuid])
  #>> '{b1300000-0000-4000-8000-000000000011,actorRealized}','true',
  'own private quality response marks the therapist session as realized');
select ok(not exists(select 1 from public.therapist_pending_confirmation_rows_v1('c1000000-0000-4000-8000-000000000001')
  where booking_id='b1300000-0000-4000-8000-000000000011'),
  'private therapist response removes the dashboard and reviews pending item');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->'actorConfirmation','null'::jsonb,'negative quality leaves internal confirmation untouched');
select is(public.get_session_feedback_v2('b1300000-0000-4000-8000-000000000011')->'counterpartConfirmation','null'::jsonb,'negative quality does not affect the other participant confirmation');
select is((select count(*)::integer from public.session_quality_reviews where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),1,'one negative creates one review');
select ok((select due_at=opened_at+interval '5 days' from public.session_quality_reviews order by opened_at desc limit 1),'SLA is five calendar days from server receipt');
select is(public.submit_session_quality_feedback_v1((select therapist_actor from quality_context order by id limit 1),
  'b1300000-0000-4000-8000-000000000011',public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),
  false,null::smallint,'internet_problem','Teste privado.','f2000000-0000-4000-8000-000000000502')->>'idempotentReplay','true','negative retry is idempotent');
select ok((select count(*)=1 from public.session_quality_reviews),'retry does not create a ticket or restart SLA');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),0,'quality retry leaves internal confirmations untouched');
select set_config('request.jwt.claim.sub',(select patient_actor::text from quality_context order by id limit 1),true);
select is(public.get_session_quality_feedback_v1('b1300000-0000-4000-8000-000000000011')->>'realizationStatus','performed','negative quality preserves performed classification');
select is(public.get_session_quality_feedback_v1('b1300000-0000-4000-8000-000000000011')->>'supportTicketId',null,'patient cannot read therapist ticket through quality API');
select is(public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),now())->>'automaticConfirmationPaused','false','private quality never pauses confirmation automation');
insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
select review.ticket_id,context.admin_actor,'admin','Nota interna não atende o relato.','internal',gen_random_uuid()
from public.session_quality_reviews review cross join (select * from quality_context order by id limit 1) context;
select ok((select answered_at is null from public.session_quality_reviews),'internal note is not an answer');
update public.support_tickets set status='resolved' where id in (select ticket_id from public.session_quality_reviews);
select ok((select answered_at is null from public.session_quality_reviews),'ticket status is not an answer');
insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
select review.ticket_id,context.admin_actor,'admin','Resposta pública ao relato.','requester',gen_random_uuid()
from public.session_quality_reviews review cross join (select * from quality_context order by id limit 1) context;
select ok((select answered_at is not null and response_message_id is not null from public.session_quality_reviews),'linked public TES reply answers report');
select is(public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'))->>'allAnswered','true','answered state is separate from participant confirmations');
select public.auto_confirm_sessions((select ends_at from public.bookings where id='b1300000-0000-4000-8000-000000000011')+interval '7 days'-interval '1 microsecond');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),0,'private quality does not create confirmations before the automatic deadline');
select public.auto_confirm_sessions((select ends_at from public.bookings where id='b1300000-0000-4000-8000-000000000011')+interval '7 days');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011') and participant_role='patient' and source='automatic'),1,'patient confirmation follows its independent automatic deadline');
select public.auto_confirm_sessions((select ends_at from public.bookings where id='b1300000-0000-4000-8000-000000000011')+interval '30 days');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),2,'therapist confirmation follows its independent thirty-day deadline');
select is(public.auto_confirm_sessions((select ends_at from public.bookings where id='b1300000-0000-4000-8000-000000000011')+interval '31 days'),0,'automatic confirmations are idempotent');
select ok(not exists(select 1 from public.session_quality_feedback where booking_id='f2000000-0000-4000-8000-000000000002'),'automatic confirmation creates no quality rating');
select results_eq($$select md5(string_agg(to_jsonb(payment)::text,'' order by payment.id)) from public.session_payments payment$$,
  $$select fingerprint from financial_snapshot where kind='payments'$$,'quality and automation do not write payment metadata');
select results_eq($$select md5(string_agg(to_jsonb(job)::text,'' order by job.id)) from public.session_transfer_jobs job$$,
  $$select fingerprint from financial_snapshot where kind='jobs'$$,'quality does not create or block transfer jobs');
select results_eq($$select md5(string_agg(to_jsonb(transfer)::text,'' order by transfer.id)) from public.stripe_transfers transfer$$,
  $$select fingerprint from financial_snapshot where kind='transfers'$$,'quality does not duplicate or reverse Transfers');
create temporary table old_attempt as select public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011') as id;
update public.bookings set status='completed' where id='b1300000-0000-4000-8000-000000000011';
select is(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')::text,(select id::text from old_attempt),'status change does not create an attempt');
select pg_temp.prepare_attempt('b1300000-0000-4000-8000-000000000011',now()-interval '2 hours',true,true);
select isnt(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')::text,(select id::text from old_attempt),'effective reschedule creates a new attempt');
select is(public.get_session_quality_feedback_v1('b1300000-0000-4000-8000-000000000011')->'feedback','null'::jsonb,'reschedule does not inherit quality');
select is(public.get_session_quality_feedback_v1('b1300000-0000-4000-8000-000000000011')->>'confirmationState','awaiting_both','reschedule does not inherit confirmations');
select is(public.get_session_attempt_attendance_batch_v1(array['b1300000-0000-4000-8000-000000000011'::uuid])
  #>> '{b1300000-0000-4000-8000-000000000011,actorRealized}','false',
  'rescheduled attempt does not inherit the prior realized badge');
select throws_ok($$select public.submit_session_quality_feedback_v1((select patient_actor from quality_context order by id limit 1),
  'b1300000-0000-4000-8000-000000000011',(select id from old_attempt),true,5::smallint,null,'','f2000000-0000-4000-8000-000000000503')$$,
  '40001','FEEDBACK_ATTEMPT_CHANGED','stale API attempt rejected');
select is((select count(*)::integer from public.session_quality_feedback where session_attempt_id=(select id from old_attempt)),2,'prior responses remain historical');
select pg_temp.prepare_attempt('f2000000-0000-4000-8000-000000000002',now()-interval '10 minutes',true,false);
select is(public.session_attempt_evidence_v1('f2000000-0000-4000-8000-000000000002',now())->>'classification',null,'exact T+10 remains inside tolerance');
select public.finalize_due_session_attendance_v1(now()+interval '1 microsecond',200);
select is((select status::text from public.bookings where id='f2000000-0000-4000-8000-000000000002'),'no_show_therapist','after T+10 absent therapist classified immediately');
select is(public.finalize_due_session_attendance_v1(now()+interval '1 second',200),0,'finalizer is idempotent and normal older sessions do not clog queue');
select set_config('request.jwt.claim.sub',(select patient_actor::text from quality_context where id='f2000000-0000-4000-8000-000000000002'),true);
select is(public.get_session_quality_feedback_v1('f2000000-0000-4000-8000-000000000002')->>'status','unavailable','non-performance never eligible for quality');
select public.auto_confirm_sessions(now()+interval '40 days');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
  public.current_session_attempt_id_v1('f2000000-0000-4000-8000-000000000002')),0,'non-performed cannot auto-confirm even after thirty days');
select ok(not exists(select 1 from jsonb_array_elements(public.get_patient_session_feedback_queue_v1()) item
  where item->>'bookingId'='f2000000-0000-4000-8000-000000000002'),'non-performed absent from pending ratings');
select set_config('request.jwt.claim.sub',(select admin_actor::text from quality_context order by id limit 1),true);
select throws_ok($$select public.admin_resolve_session_attendance_v1((select id from public.session_confirmation_incidents
  where booking_id='f2000000-0000-4000-8000-000000000002' order by created_at desc limit 1),
  'reschedule','Justificativa administrativa de teste.','f2000000-0000-4000-8000-000000000504')$$,
  '23514','SESSION_ATTENDANCE_FULL_REFUND_ONLY','therapist absence cannot authorize reschedule');
savepoint exclusive_patient;
select pg_temp.prepare_attempt('f2000000-0000-4000-8000-000000000002',now()-interval '12 minutes',false,true);
select public.finalize_due_session_attendance_v1(now(),200);
select is((select status::text from public.bookings where id='f2000000-0000-4000-8000-000000000002'),'no_show_patient','patient absence classified before physical closure');
rollback to savepoint exclusive_patient;
select pg_temp.prepare_attempt('f2000000-0000-4000-8000-000000000002',now()-interval '13 minutes',false,false);
select public.finalize_due_session_attendance_v1(now(),200);
select is((select status::text from public.bookings where id='f2000000-0000-4000-8000-000000000002'),'no_show_both','absence of both classified');
select * from finish();
rollback;
