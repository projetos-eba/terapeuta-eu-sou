begin;

-- The participant-facing state is complete after that participant either
-- submits the private quality form or reaches the independent automatic
-- confirmation deadline. Public therapist reviews are deliberately unrelated.
create or replace function public.get_session_attempt_attendance_batch_v1(
  p_booking_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scoped as (
    select
      booking.id as booking_id,
      case
        when patient.user_id = auth.uid() then 'patient'::public.user_role
        when therapist.user_id = auth.uid() then 'therapist'::public.user_role
      end as actor_role
    from public.bookings booking
    join public.patient_profiles patient
      on patient.id = booking.patient_profile_id
    join public.therapist_profiles therapist
      on therapist.id = booking.therapist_profile_id
    where booking.id = any(coalesce(p_booking_ids, '{}'::uuid[]))
      and (patient.user_id = auth.uid() or therapist.user_id = auth.uid())
  ), attended as (
    select scoped.booking_id, scoped.actor_role,
      public.session_attempt_evidence_v1(scoped.booking_id) as evidence
    from scoped
  )
  select coalesce(
    jsonb_object_agg(
      attended.booking_id::text,
      attended.evidence ||
      jsonb_build_object(
        'actorRealized',
        coalesce((attended.evidence->>'bothJoined')::boolean, false)
        and coalesce((attended.evidence->>'sessionClosed')::boolean, false)
        and attended.evidence->>'classification' is null
        and (exists (
          select 1
          from public.session_quality_feedback feedback
          where feedback.session_attempt_id = public.current_session_attempt_id_v1(attended.booking_id)
            and feedback.author_role = attended.actor_role
        ) or exists (
          select 1
          from public.session_participant_confirmations confirmation
          where confirmation.session_attempt_id = public.current_session_attempt_id_v1(attended.booking_id)
            and confirmation.participant_role = attended.actor_role
            and confirmation.outcome = 'completed'
        ))
      )
    ),
    '{}'::jsonb
  )
  from attended;
$$;

revoke all on function public.get_session_attempt_attendance_batch_v1(uuid[])
  from public, anon;
grant execute on function public.get_session_attempt_attendance_batch_v1(uuid[])
  to authenticated, service_role;

create or replace function public.get_session_quality_feedback_v1(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_feedback public.session_quality_feedback;
  v_patient public.session_participant_confirmations;
  v_therapist public.session_participant_confirmations;
  v_actor_confirmation public.session_participant_confirmations;
  v_evidence jsonb;
  v_review jsonb;
  v_status text;
  v_state text;
  v_attempt uuid;
  v_payment public.session_payments;
  v_ticket uuid;
begin
  select case when patient.user_id = auth.uid() then 'patient'::public.user_role
    when therapist.user_id = auth.uid() then 'therapist'::public.user_role end into v_role
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;
  if v_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  v_evidence := public.session_attempt_evidence_v1(p_booking_id);
  v_attempt := (v_evidence->>'sessionAttemptId')::uuid;
  v_review := public.session_quality_review_state_v1(v_attempt);
  select * into v_feedback
  from public.session_quality_feedback
  where session_attempt_id = v_attempt and author_role = v_role;
  select * into v_patient
  from public.session_participant_confirmations
  where session_attempt_id = v_attempt and participant_role = 'patient';
  select * into v_therapist
  from public.session_participant_confirmations
  where session_attempt_id = v_attempt and participant_role = 'therapist';
  if v_role = 'patient' then
    v_actor_confirmation := v_patient;
  else
    v_actor_confirmation := v_therapist;
  end if;
  select ticket_id into v_ticket
  from public.session_quality_reviews
  where feedback_id = v_feedback.id;
  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id;

  v_status := case
    when v_feedback.id is not null then 'submitted'
    when v_actor_confirmation.id is not null
      and v_actor_confirmation.outcome = 'completed'
      and v_actor_confirmation.source = 'automatic'
      and coalesce((v_evidence->>'bothJoined')::boolean, false)
      and coalesce((v_evidence->>'sessionClosed')::boolean, false)
      and v_evidence->>'classification' is null
      then 'automatically_confirmed'
    when v_evidence->>'classification' is not null then 'unavailable'
    when (v_evidence->>'sessionClosed')::boolean = false then 'before_session'
    when (v_evidence->>'bothJoined')::boolean = true
      and v_evidence->>'classification' is null then 'eligible'
    else 'unavailable'
  end;
  v_state := case
    when v_patient.id is null and v_therapist.id is null then 'awaiting_both'
    when v_patient.id is null then 'awaiting_patient'
    when v_therapist.id is null then 'awaiting_therapist'
    else 'completed'
  end;

  return jsonb_build_object(
    'contractVersion', 2,
    'sessionAttemptId', v_attempt,
    'actorRole', v_role,
    'attendance', v_evidence,
    'qualityReview', v_review,
    'supportTicketId', v_ticket,
    'realizationStatus', case
      when (v_evidence->>'bothJoined')::boolean
        and (v_evidence->>'sessionClosed')::boolean
        and v_evidence->>'classification' is null then 'performed'
      when v_evidence->>'classification' like 'no_show_%' then 'not_performed'
      else 'pending'
    end,
    'feedback', public.session_quality_feedback_payload_v1(v_feedback),
    'status', v_status,
    'reason', case
      when v_status = 'eligible' then 'post_session_available'
      when v_status = 'automatically_confirmed' then 'automatic_confirmation_recorded'
      else 'attendance_incomplete'
    end,
    'confirmation', public.session_confirmation_payload_v2(v_actor_confirmation),
    'actorConfirmation', public.session_confirmation_payload_v2(v_actor_confirmation),
    'counterpartConfirmation', public.session_confirmation_payload_v2(
      case when v_role = 'patient' then v_therapist else v_patient end
    ),
    'patientConfirmation', public.session_confirmation_payload_v2(v_patient),
    'therapistConfirmation', public.session_confirmation_payload_v2(v_therapist),
    'confirmationState', v_state,
    'policy', jsonb_build_object(
      'patientAutoConfirmationDays', 7,
      'therapistAutoConfirmationDays', 30,
      'transferSafetyHours', 0
    ),
    'financial', jsonb_build_object(
      'transferStatus', v_payment.transfer_status,
      'serviceStatus', v_payment.service_status,
      'serviceConfirmedAt', v_payment.service_confirmed_at,
      'eligibleAt', v_payment.eligible_at,
      'transferBlockedReason', v_payment.transfer_blocked_reason,
      'nextBatchAt', null
    )
  );
end;
$$;

revoke all on function public.get_session_quality_feedback_v1(uuid)
  from public, anon;
grant execute on function public.get_session_quality_feedback_v1(uuid)
  to authenticated, service_role;

create or replace function public.therapist_pending_confirmation_rows_v1(
  p_therapist_profile_id uuid
)
returns table(
  booking_id uuid,
  patient_name text,
  service_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  due_at timestamptz,
  remaining_seconds bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select booking.id, patient.display_name, service.title,
    booking.starts_at, booking.ends_at,
    booking.ends_at + interval '30 days',
    greatest(0, extract(epoch from (
      booking.ends_at + interval '30 days' - now()
    ))::bigint)
  from public.bookings booking
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  left join public.therapist_services service on service.id = booking.service_id
  where booking.therapist_profile_id = p_therapist_profile_id
    and booking.status in ('confirmed', 'completed')
    and exists (
      select 1 from public.therapist_profiles therapist
      where therapist.id = p_therapist_profile_id
        and therapist.user_id = auth.uid()
    )
    and public.session_attempt_evidence_v1(booking.id)->>'classification' is null
    and (public.session_attempt_evidence_v1(booking.id)->>'bothJoined')::boolean
    and (public.session_attempt_evidence_v1(booking.id)->>'sessionClosed')::boolean
    and not exists (
      select 1 from public.session_quality_feedback feedback
      where feedback.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
        and feedback.author_role = 'therapist'
    )
    and not exists (
      select 1 from public.session_participant_confirmations confirmation
      where confirmation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
        and confirmation.participant_role = 'therapist'
        and confirmation.outcome = 'completed'
    )
  order by booking.ends_at desc, booking.id desc;
$$;

revoke all on function public.therapist_pending_confirmation_rows_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.therapist_pending_confirmation_rows_v1(uuid)
  to service_role;

comment on function public.get_session_attempt_attendance_batch_v1(uuid[]) is
  'Participant-scoped attempt evidence plus own realized state from private quality feedback or automatic/manual confirmation.';
comment on function public.therapist_pending_confirmation_rows_v1(uuid) is
  'Therapist-facing pending evaluation rows; private feedback hides the UI item while independent automatic confirmation continues.';

commit;
