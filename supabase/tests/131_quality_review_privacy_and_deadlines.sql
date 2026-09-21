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

select pg_temp.prepare_attempt('b1300000-0000-4000-8000-000000000011',now()-interval '40 days',true,true);
select public.submit_session_quality_feedback_v1((select patient_actor from quality_context order by id limit 1),
 'b1300000-0000-4000-8000-000000000011',public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),
 false,null::smallint,'internet_problem','Relato privado do cliente.','f2000000-0000-4000-8000-000000000601');
select public.submit_session_quality_feedback_v1((select therapist_actor from quality_context order by id limit 1),
 'b1300000-0000-4000-8000-000000000011',public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),
 false,null::smallint,'audio_video_problem','Relato privado do terapeuta.','f2000000-0000-4000-8000-000000000602');
select is((select count(distinct ticket_id)::integer from public.session_quality_reviews),2,'participants have separate private tickets');
select set_config('request.jwt.claim.sub',(select therapist_actor::text from quality_context order by id limit 1),true);
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(public.get_therapist_reviews_v1()->'privateFeedback') item
  where item->>'id'=(select id::text from public.session_quality_feedback
    where booking_id='b1300000-0000-4000-8000-000000000011' and author_role='therapist')),
  'therapist can read own attempt-scoped private quality response');
select ok(not exists(select 1 from jsonb_array_elements(public.get_therapist_reviews_v1()->'privateFeedback') item
  where item->>'id'=(select id::text from public.session_quality_feedback
    where booking_id='b1300000-0000-4000-8000-000000000011' and author_role='patient')),
  'therapist review page cannot read the patient private quality response');
select is(has_function_privilege('authenticated','public.private_get_therapist_reviews_v1_legacy()','EXECUTE'),
  false,'legacy reader containing patient private answers is not directly callable');
reset role;
update public.session_quality_reviews set opened_at=opened_at-interval '1 day',due_at=due_at-interval '1 day'
 where requester_profile_id=(select patient_actor from quality_context order by id limit 1);
select public.auto_confirm_sessions(now()+interval '4 days');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
 public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),2,'private quality reviews do not pause automatic confirmations');
select set_config('request.jwt.claim.sub',(select patient_actor::text from quality_context order by id limit 1),true);
set local role authenticated;
select is((select count(*)::integer from public.session_quality_feedback),1,'RLS shows only own private quality response');
select is((select count(*)::integer from public.session_quality_reviews),1,'RLS shows only own review and ticket');
reset role;
select public.auto_confirm_sessions(now()+interval '5 days');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
 public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),2,'both overdue original deadlines run at exact SLA expiry without restarting');
select is(public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),
 now()+interval '5 days')->>'isOpen','true','overdue audit stays open after automatic confirmations');
select is((select count(*)::integer from public.notifications where kind='session_quality_review_overdue'),
  (select count(*)::integer * 2 from public.profiles where role='admin' and auth_deleted_at is null and anonymized_at is null),
  'each overdue private report alerts each active Admin once');
select public.auto_confirm_sessions(now()+interval '5 days');
select is((select count(*)::integer from public.notifications where kind='session_quality_review_overdue'),
  (select count(*)::integer * 2 from public.profiles where role='admin' and auth_deleted_at is null and anonymized_at is null),
  'overdue notification is idempotent');
create temporary table confirmations_before_reply as select md5(string_agg(to_jsonb(confirmation)::text,'' order by id)) as fingerprint
 from public.session_participant_confirmations confirmation where session_attempt_id=
 public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011');
insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
 select ticket_id,(select admin_actor from quality_context order by id limit 1),'admin','Resposta ao cliente.','requester',gen_random_uuid()
 from public.session_quality_reviews where requester_profile_id=(select patient_actor from quality_context order by id limit 1);
select is(public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'))->>'isOpen','true','answering one ticket does not answer the other');
insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
 select ticket_id,(select admin_actor from quality_context order by id limit 1),'admin','Resposta ao terapeuta.','requester',gen_random_uuid()
 from public.session_quality_reviews where requester_profile_id=(select therapist_actor from quality_context order by id limit 1);
select is(public.session_quality_review_state_v1(public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'))->>'allAnswered','true','both public replies clear analysis warning');
select is((select md5(string_agg(to_jsonb(confirmation)::text,'' order by id)) from public.session_participant_confirmations confirmation
 where session_attempt_id=public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),
 (select fingerprint from confirmations_before_reply),'later public reply does not rewrite confirmations');
select pg_temp.prepare_attempt('b1300000-0000-4000-8000-000000000011',now()-interval '1 hour',false,false);
select set_config('request.jwt.claim.sub',(select therapist_actor::text from quality_context order by id limit 1),true);
select ok(not exists(select 1 from jsonb_array_elements(public.get_therapist_reviews_v1()->'privateFeedback') item
 where item->>'bookingId'='b1300000-0000-4000-8000-000000000011' and item->>'historical' is distinct from 'true'),
 'rescheduled quality answers remain explicitly historical on the therapist review page');
insert into public.booking_events(booking_id,event_type,request_id,source,payload,created_at)
 select id,'zoom_waiting_room_entered','quality-technical-'||role,'pgtap',
 jsonb_build_object('bookingVersion',version,'scheduledStartsAt',starts_at,'participantRole',role),starts_at+interval '5 minutes'
 from public.bookings cross join (values('patient'),('therapist')) actor(role) where id='b1300000-0000-4000-8000-000000000011';
select is(public.session_attempt_evidence_v1('b1300000-0000-4000-8000-000000000011')->>'classification','requires_review','both arrivals without bilateral joins require technical review');
select throws_ok($$select public.submit_session_quality_feedback_v1((select patient_actor from quality_context order by id limit 1),
 'b1300000-0000-4000-8000-000000000011',public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011'),
 true,5::smallint,null,'','f2000000-0000-4000-8000-000000000603')$$,'42501','FEEDBACK_ATTENDANCE_REQUIRED','technical access review cannot rate a non-performed session');
select public.finalize_due_session_attendance_v1(now(),100);
select set_config('request.jwt.claim.sub',(select admin_actor::text from quality_context order by id limit 1),true);
select throws_ok($$select public.admin_resolve_session_attendance_v1(
 (select id from public.session_confirmation_incidents where booking_id='b1300000-0000-4000-8000-000000000011'
  and session_attempt_id=public.current_session_attempt_id_v1(booking_id)),
 'performed','Análise técnica sem evidência bilateral confiável.','f2000000-0000-4000-8000-000000000604')$$,
 '23514','SESSION_ATTENDANCE_PERFORMED_NOT_ALLOWED','Admin cannot turn waiting-room arrivals into a performed session');
create temporary table technical_payment_before as select to_jsonb(payment) as snapshot
 from public.session_payments payment where booking_id='b1300000-0000-4000-8000-000000000011';
insert into public.video_session_participations(video_session_id,booking_id,participant_correlation_key,participant_role,event_type,joined_at,metadata)
 select id,booking_id,'technical-late-webhook-'||role,role::public.video_session_participant_role,
 'session.user_joined',scheduled_starts_at+interval '6 minutes','{}'
 from public.video_sessions cross join (values('patient'),('therapist')) actor(role)
 where booking_id='b1300000-0000-4000-8000-000000000011';
select public.admin_resolve_session_attendance_v1(
 (select id from public.session_confirmation_incidents where booking_id='b1300000-0000-4000-8000-000000000011'
  and session_attempt_id=public.current_session_attempt_id_v1(booking_id)),
 'performed','Entradas confiáveis recuperadas dos registros da sala.','f2000000-0000-4000-8000-000000000605');
select is(public.session_attempt_evidence_v1('b1300000-0000-4000-8000-000000000011')->>'classification',
 null::text,'resolved technical review permits performed evidence only after both trusted joins');
select is((select to_jsonb(payment) from public.session_payments payment where booking_id='b1300000-0000-4000-8000-000000000011'),
 (select snapshot from technical_payment_before),'technical attendance resolution does not mutate payment or Transfer state');
select is((select count(*)::integer from public.session_participant_confirmations where session_attempt_id=
 public.current_session_attempt_id_v1('b1300000-0000-4000-8000-000000000011')),0,'technical resolution does not fabricate participant confirmations');
select * from finish();
rollback;
