-- Forward-only recovery: HML previously recorded version 20260918210000 with
-- the verification-queue migration contents. Reapply this contract under a
-- unique version so migration history and the deployed function converge.
begin;

-- A completed, attended attempt can be confirmed at the independent 7/30-day
-- deadlines even when the booking was subsequently fully refunded.
-- This worker writes participant confirmations and scheduler audit only; the
-- financial status and refund history remain authoritative and unchanged.
create or replace function public.auto_confirm_sessions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_evidence jsonb;
  v_count integer := 0;
  v_inserted integer;
  v_run uuid;
  v_patient_count integer := 0;
  v_therapist_count integer := 0;
begin
  if p_now is null then
    raise exception 'SESSION_CONFIRMATION_VALIDATION_ERROR';
  end if;
  insert into public.session_confirmation_scheduler_runs(scheduled_for,status)
    values(date_trunc('hour',p_now),'running')
  on conflict(scheduled_for) do update
    set status='running',attempts=public.session_confirmation_scheduler_runs.attempts+1,
      started_at=now(),finished_at=null,error_code=null
  returning id into v_run;

  for v_row in
    select booking.id, attempt.id as attempt_id, attempt.ends_at, deadline.role,
      attempt.ends_at + make_interval(days => deadline.days) as due_at
    from public.bookings booking
    join public.booking_session_attempts attempt
      on attempt.id = public.current_session_attempt_id_v1(booking.id)
    cross join lateral (values
      ('patient'::public.user_role,7),
      ('therapist'::public.user_role,30)
    ) deadline(role,days)
    where booking.status in ('confirmed','completed','refunded')
      and attempt.ends_at + make_interval(days => deadline.days) <= p_now
      and not exists (
        select 1 from public.session_participant_confirmations confirmation
        where confirmation.session_attempt_id = attempt.id
          and confirmation.participant_role = deadline.role
      )
    order by due_at, booking.id, deadline.role
    for update of booking skip locked
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(v_row.id::text,0)
    ) then continue; end if;
    if public.current_session_attempt_id_v1(v_row.id) is distinct from v_row.attempt_id
    then continue; end if;
    v_evidence := public.session_attempt_evidence_v1(v_row.id,p_now);
    if coalesce((v_evidence->>'bothJoined')::boolean,false) = false
      or coalesce((v_evidence->>'sessionClosed')::boolean,false) = false
      or v_evidence->>'classification' is not null then continue; end if;
    insert into public.session_participant_confirmations(
      booking_id,session_attempt_id,participant_role,outcome,source,request_id,
      payload_hash,due_at,confirmed_at,policy_version_id
    )
    select v_row.id,v_row.attempt_id,v_row.role,'completed','automatic',gen_random_uuid(),
      encode(extensions.digest(
        v_row.attempt_id::text || ':' || v_row.role::text || ':automatic','sha256'
      ),'hex'),v_row.due_at,p_now,payment.policy_version_id
    from public.session_payments payment
    where payment.booking_id = v_row.id
    on conflict (session_attempt_id,participant_role)
      where session_attempt_id is not null do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
    if v_row.role='patient' then v_patient_count:=v_patient_count+v_inserted;
    else v_therapist_count:=v_therapist_count+v_inserted; end if;
  end loop;

  insert into public.notifications(profile_id,kind,title,body,href,event_key)
  select admin.id,'session_quality_review_overdue','Análise de sessão com prazo vencido',
    'O prazo de 5 dias terminou. Responda à pessoa pela Central de Suporte.',
    '/admin/suporte/' || review.ticket_id::text,'quality-review-overdue:' || review.id::text
  from public.session_quality_reviews review
  cross join public.profiles admin
  where admin.role = 'admin' and admin.auth_deleted_at is null and admin.anonymized_at is null
    and review.answered_at is null and review.due_at <= p_now
  on conflict (profile_id,event_key) where event_key is not null do nothing;

  update public.session_confirmation_scheduler_runs
  set status='completed',finished_at=now(),patient_confirmations=v_patient_count,
    therapist_confirmations=v_therapist_count,finalized_sessions=0
  where id=v_run;
  return v_count;
end;
$$;

-- A legacy manual confirmation on the current attended attempt already came
-- from a participant response. Keep its historical feedback separate while
-- closing the duplicate private-quality prompt for that participant only.
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
    when v_actor_confirmation.id is not null
      and v_actor_confirmation.outcome = 'completed'
      and v_actor_confirmation.source = 'manual'
      and coalesce((v_evidence->>'bothJoined')::boolean, false)
      and coalesce((v_evidence->>'sessionClosed')::boolean, false)
      and v_evidence->>'classification' is null
      then 'previously_recorded'
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
      when v_status = 'previously_recorded' then 'manual_confirmation_recorded'
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

commit;
