begin;
create or replace function public.get_patient_session_feedback_queue_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_patient uuid;
begin
  select id into v_patient from public.patient_profiles where user_id=v_actor;
  if v_patient is null then raise exception 'FEEDBACK_PATIENT_REQUIRED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'bookingId',booking.id,'sessionAttemptId',public.current_session_attempt_id_v1(booking.id),
    'startsAt',booking.starts_at,'endsAt',booking.ends_at,'timezone',booking.timezone,
    'serviceLabel',service.title,'therapyLabel',therapy.name,
    'therapist',jsonb_build_object('id',therapist.id,'name',therapist.public_name,'avatarUrl',therapist.photo_url),
    'actorConfirmation',public.get_session_quality_feedback_v1(booking.id)->'actorConfirmation',
    'counterpartConfirmation',public.get_session_quality_feedback_v1(booking.id)->'counterpartConfirmation',
    'confirmationState',public.get_session_quality_feedback_v1(booking.id)->'confirmationState',
    'eligibleAt',payment.eligible_at,'nextBatchAt',null,'serviceConfirmedAt',payment.service_confirmed_at
  ) order by booking.ends_at desc)
  from public.bookings booking join public.session_payments payment on payment.booking_id=booking.id
  join public.therapist_profiles therapist on therapist.id=booking.therapist_profile_id
  join public.therapist_services service on service.id=booking.service_id
  left join public.therapies therapy on therapy.id=service.therapy_id
  where booking.patient_profile_id=v_patient
    and public.get_session_quality_feedback_v1(booking.id)->>'status'='eligible'),'[]'::jsonb);
end;
$$;

create or replace function public.admin_get_session_feedback_v2(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_attempt uuid; v_evidence jsonb; v_incident public.session_confirmation_incidents;
  v_patient public.session_quality_feedback; v_therapist public.session_quality_feedback;
  v_pc public.session_participant_confirmations; v_tc public.session_participant_confirmations;
  v_payment public.session_payments; v_reviews jsonb; v_legacy jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin'
    and auth_deleted_at is null and anonymized_at is null) then
    raise exception 'SESSION_ATTENDANCE_ADMIN_REQUIRED' using errcode='42501'; end if;
  v_attempt:=public.current_session_attempt_id_v1(p_booking_id);
  if v_attempt is null then return null; end if;
  v_evidence:=public.session_attempt_evidence_v1(p_booking_id);
  select * into v_incident from public.session_confirmation_incidents where session_attempt_id=v_attempt order by created_at desc limit 1;
  select * into v_patient from public.session_quality_feedback where session_attempt_id=v_attempt and author_role='patient';
  select * into v_therapist from public.session_quality_feedback where session_attempt_id=v_attempt and author_role='therapist';
  select * into v_pc from public.session_participant_confirmations where session_attempt_id=v_attempt and participant_role='patient';
  select * into v_tc from public.session_participant_confirmations where session_attempt_id=v_attempt and participant_role='therapist';
  select * into v_payment from public.session_payments where booking_id=p_booking_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',review.id,'authorRole',feedback.author_role,
    'ticketId',review.ticket_id,'openedAt',review.opened_at,'dueAt',review.due_at,
    'answeredAt',review.answered_at,'overdue',review.answered_at is null and review.due_at<=now())
    order by review.opened_at),'[]'::jsonb) into v_reviews
    from public.session_quality_reviews review join public.session_quality_feedback feedback on feedback.id=review.feedback_id
    where review.session_attempt_id=v_attempt;
  select coalesce(jsonb_agg(public.session_feedback_payload(feedback) order by feedback.created_at),'[]'::jsonb)
    into v_legacy from public.session_feedback feedback where feedback.booking_id=p_booking_id;
  return jsonb_build_object('contractVersion',2,'sessionAttemptId',v_attempt,
    'patient',public.session_quality_feedback_payload_v1(v_patient),'therapist',public.session_quality_feedback_payload_v1(v_therapist),
    'divergent',false,'legacyFeedback',v_legacy,
    'attendance',v_evidence||jsonb_build_object('incidentId',v_incident.id,'classificationSource',v_incident.classification_source,
      'financialResolution',v_incident.financial_resolution,'resolution',v_incident.operational_resolution,
      'responsibility',v_incident.responsibility,'reviewDueAt',v_incident.review_due_at,
      'retentionAuthorized',false,'processingCostRecoveryAuthorized',false),
    'confirmation',jsonb_build_object('patient',public.session_confirmation_payload_v2(v_pc),'therapist',public.session_confirmation_payload_v2(v_tc)),
    'qualityReview',public.session_quality_review_state_v1(v_attempt),'qualityReports',v_reviews,
    'pendingRoles',case when (v_evidence->>'sessionClosed')::boolean and (v_evidence->>'bothJoined')::boolean
      and v_evidence->>'classification' is null then to_jsonb(array_remove(array[
        case when v_patient.id is null then 'patient' end,case when v_therapist.id is null then 'therapist' end],null))
      else '[]'::jsonb end,
    'financial',jsonb_build_object('eligibleAt',v_payment.eligible_at,'serviceConfirmedAt',v_payment.service_confirmed_at,
      'serviceStatus',v_payment.service_status,'transferStatus',v_payment.transfer_status));
end;
$$;
-- Old contracts may not silently classify quality as non-performance.
create or replace function public.submit_session_feedback_for_actor_v1(p_actor_user_id uuid,p_booking_id uuid,
  p_outcome text,p_rating smallint,p_not_performed_reason text,p_comment text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'FEEDBACK_CONTRACT_VERSION_REQUIRED' using errcode='22023'; end;
$$;
revoke all on function public.get_patient_session_feedback_queue_v1(),
 public.admin_get_session_feedback_v2(uuid) from public,anon;
grant execute on function public.get_patient_session_feedback_queue_v1(),
 public.admin_get_session_feedback_v2(uuid) to authenticated,service_role;
commit;

