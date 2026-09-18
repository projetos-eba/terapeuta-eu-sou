-- A single authenticated quality response also records the author's participation.
-- Quality and participation remain separate records; neither changes money.
begin;

alter function public.submit_session_quality_feedback_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) rename to submit_session_quality_feedback_only_v1;

create function public.submit_session_quality_feedback_v1(
  p_actor_user_id uuid, p_booking_id uuid, p_session_attempt_id uuid,
  p_successful boolean, p_rating smallint, p_quality_reason text,
  p_comment text, p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_role public.user_role;
  v_existing public.session_participant_confirmations%rowtype;
  v_confirmation jsonb;
begin
  -- Both commands execute in the same transaction, under the quality writer's
  -- booking advisory lock. A failure in either command rolls both back.
  v_result := public.submit_session_quality_feedback_only_v1(
    p_actor_user_id, p_booking_id, p_session_attempt_id, p_successful,
    p_rating, p_quality_reason, p_comment, p_request_id
  );

  if public.current_session_attempt_id_v1(p_booking_id) is distinct from p_session_attempt_id then
    raise exception 'FEEDBACK_ATTEMPT_CHANGED' using errcode = '40001';
  end if;

  select case
    when patient.user_id = p_actor_user_id then 'patient'::public.user_role
    when therapist.user_id = p_actor_user_id then 'therapist'::public.user_role
  end into v_role
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;

  if v_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select * into v_existing from public.session_participant_confirmations
  where session_attempt_id = p_session_attempt_id and participant_role = v_role
  for update;

  if v_existing.id is not null then
    if v_existing.outcome <> 'completed' then
      raise exception 'SESSION_CONFIRMATION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    v_confirmation := public.session_confirmation_payload_v2(v_existing);
  else
    v_confirmation := public.record_session_participant_confirmation_v1(
      p_actor_user_id, p_booking_id, 'completed', p_request_id, 'manual', now()
    )->'confirmation';
  end if;

  return v_result || jsonb_build_object('confirmation', v_confirmation);
end;
$$;

revoke all on function public.submit_session_quality_feedback_only_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.submit_session_quality_feedback_only_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) to service_role;

revoke all on function public.submit_session_quality_feedback_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.submit_session_quality_feedback_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) to service_role;

-- Repair only persisted feedback on the current attempt, with verified bilateral
-- attendance, a closed room and no adverse classification or open incident.
do $$
declare
  v_feedback record;
  v_evidence jsonb;
begin
  for v_feedback in
    select feedback.booking_id, feedback.session_attempt_id,
      feedback.author_profile_id, feedback.author_role, feedback.request_id,
      feedback.created_at
    from public.session_quality_feedback feedback
    join public.session_payments payment on payment.booking_id = feedback.booking_id
    where payment.financial_status in ('paid', 'partially_refunded')
      and feedback.session_attempt_id = public.current_session_attempt_id_v1(feedback.booking_id)
      and not exists (
        select 1 from public.session_participant_confirmations confirmation
        where confirmation.session_attempt_id = feedback.session_attempt_id
          and confirmation.participant_role = feedback.author_role
      )
      and not exists (
        select 1 from public.session_confirmation_incidents incident
        where incident.booking_id = feedback.booking_id and incident.status = 'open'
      )
  loop
    v_evidence := public.session_attempt_evidence_v1(v_feedback.booking_id);
    if coalesce((v_evidence->>'bothJoined')::boolean, false)
      and coalesce((v_evidence->>'sessionClosed')::boolean, false)
      and v_evidence->>'classification' is null then
      perform public.record_session_participant_confirmation_v1(
        v_feedback.author_profile_id, v_feedback.booking_id, 'completed',
        v_feedback.request_id, 'manual', v_feedback.created_at
      );
    end if;
  end loop;
end;
$$;

commit;
