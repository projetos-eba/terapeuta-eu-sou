-- A completed encounter requires bilateral trusted entry and no unresolved no-show.
begin;
create or replace function public.get_session_feedback_v2(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_booking record;
  v_feedback public.session_feedback;
  v_patient public.session_participant_confirmations;
  v_therapist public.session_participant_confirmations;
  v_attendance jsonb;
  v_status text;
  v_reason text;
  v_confirmation_state text;
  v_next_batch_at timestamptz;
  v_incident_status text;
begin
  if v_actor_id is null then
    raise exception 'FEEDBACK_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_booking_id is null then
    raise exception 'FEEDBACK_BOOKING_REQUIRED' using errcode = '22023';
  end if;

  select
    booking.starts_at,
    booking.ends_at,
    booking.version,
    booking.status::text as booking_status,
    payment.financial_status::text as financial_status,
    payment.service_status::text as service_status,
    payment.service_confirmed_at,
    payment.eligible_at,
    payment.transfer_status::text as transfer_status,
    payment.transfer_blocked_reason,
    payment.admin_blocked_at,
    payment.internal_contested_at,
    policy.patient_auto_confirmation_days,
    policy.therapist_auto_confirmation_days,
    case
      when patient.user_id = v_actor_id then 'patient'::public.user_role
      when therapist.user_id = v_actor_id then 'therapist'::public.user_role
      else null
    end as actor_role
  into v_booking
  from public.bookings booking
  join public.session_payments payment on payment.booking_id = booking.id
  join public.financial_policy_versions policy on policy.id = payment.policy_version_id
  join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;

  v_actor_role := v_booking.actor_role;
  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select feedback.* into v_feedback
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role;
  select confirmation.* into v_patient
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'patient'::public.user_role;
  select confirmation.* into v_therapist
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'therapist'::public.user_role;
  select incident.status into v_incident_status
  from public.session_confirmation_incidents incident
  where incident.booking_id = p_booking_id
    and incident.booking_version = case
      when v_booking.booking_status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
        then v_booking.version - 1
      else v_booking.version
    end;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());

  if v_feedback.id is not null then
    v_status := 'submitted';
    v_reason := 'submitted';
  elsif v_booking.financial_status not in ('paid', 'partially_refunded') then
    v_status := 'unavailable';
    v_reason := 'payment_pending';
  elsif now() < v_booking.ends_at then
    v_status := 'before_session';
    v_reason := 'session_not_ended';
  elsif v_booking.booking_status in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded') then
    v_status := 'unavailable';
    v_reason := 'session_cancelled';
  elsif v_booking.booking_status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
    or (v_attendance ->> 'classification') in ('no_show_patient', 'no_show_therapist', 'no_show_both', 'requires_review')
    or coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false then
    v_status := 'incident_only';
    v_reason := 'attendance_incomplete';
  else
    v_status := 'eligible';
    v_reason := 'post_session_available';
  end if;

  if v_incident_status = 'open'
    or v_booking.internal_contested_at is not null
    or v_booking.admin_blocked_at is not null then
    v_confirmation_state := 'blocked_for_review';
  elsif v_booking.transfer_status = 'transferred' then
    v_confirmation_state := 'completed';
  elsif v_booking.service_confirmed_at is not null
    and v_booking.eligible_at is not null
    and now() < v_booking.eligible_at then
    v_confirmation_state := 'safety_period';
  elsif v_booking.service_confirmed_at is not null then
    v_confirmation_state := 'next_batch';
  elsif v_patient.id is null and v_therapist.id is null then
    v_confirmation_state := 'awaiting_both';
  elsif v_patient.id is null then
    v_confirmation_state := 'awaiting_patient';
  elsif v_therapist.id is null then
    v_confirmation_state := 'awaiting_therapist';
  else
    v_confirmation_state := 'blocked_for_review';
  end if;

  v_next_batch_at := public.next_weekly_payout_cutoff_v1(v_booking.eligible_at, now());

  return jsonb_build_object(
    'actorRole', v_actor_role,
    'attendance', v_attendance,
    'confirmation', case when v_actor_role = 'patient'::public.user_role
      then public.session_confirmation_payload_v2(v_patient)
      else public.session_confirmation_payload_v2(v_therapist) end,
    'actorConfirmation', case when v_actor_role = 'patient'::public.user_role
      then public.session_confirmation_payload_v2(v_patient)
      else public.session_confirmation_payload_v2(v_therapist) end,
    'counterpartConfirmation', case when v_actor_role = 'patient'::public.user_role
      then public.session_confirmation_payload_v2(v_therapist)
      else public.session_confirmation_payload_v2(v_patient) end,
    'patientConfirmation', public.session_confirmation_payload_v2(v_patient),
    'therapistConfirmation', public.session_confirmation_payload_v2(v_therapist),
    'confirmationState', v_confirmation_state,
    'feedback', case when v_feedback.id is null then null
      else public.session_feedback_payload(v_feedback) end,
    'financial', jsonb_build_object(
      'eligibleAt', v_booking.eligible_at,
      'nextBatchAt', v_next_batch_at,
      'serviceConfirmedAt', v_booking.service_confirmed_at,
      'serviceStatus', v_booking.service_status,
      'transferBlockedReason', v_booking.transfer_blocked_reason,
      'transferStatus', v_booking.transfer_status
    ),
    'policy', jsonb_build_object(
      'patientAutoConfirmationDays', v_booking.patient_auto_confirmation_days,
      'therapistAutoConfirmationDays', v_booking.therapist_auto_confirmation_days,
      'transferSafetyHours', 24
    ),
    'reason', v_reason,
    'status', v_status
  );
end;
$$;

create or replace function public.record_session_participant_confirmation_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_outcome text,
  p_request_id uuid,
  p_source text default 'manual',
  p_confirmed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_ends_at timestamptz;
  v_policy public.financial_policy_versions%rowtype;
  v_existing public.session_participant_confirmations;
  v_hash text;
  v_confirmation public.session_participant_confirmations;
  v_due_at timestamptz;
  v_attendance jsonb;
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null
    or p_outcome not in ('completed', 'not_performed')
    or p_source not in ('manual', 'automatic') then
    raise exception 'SESSION_CONFIRMATION_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select case
      when patient_profiles.user_id = p_actor_user_id then 'patient'::public.user_role
      when therapist_profiles.user_id = p_actor_user_id then 'therapist'::public.user_role
      else null
    end,
    bookings.ends_at
  into v_actor_role, v_ends_at
  from public.bookings
  left join public.patient_profiles on patient_profiles.id = bookings.patient_profile_id
  left join public.therapist_profiles on therapist_profiles.id = bookings.therapist_profile_id
  join public.session_payments payment on payment.booking_id = bookings.id
  where bookings.id = p_booking_id
    and payment.financial_status in ('paid', 'partially_refunded');

  if v_actor_role is null then
    raise exception 'SESSION_CONFIRMATION_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select policy.* into v_policy
  from public.session_payments payment
  join public.financial_policy_versions policy on policy.id = payment.policy_version_id
  where payment.booking_id = p_booking_id;

  if v_policy.id is null then
    raise exception 'SESSION_CONFIRMATION_POLICY_REQUIRED';
  end if;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());
  if coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
    raise exception 'SESSION_CONFIRMATION_NOT_CLOSED' using errcode = '42501';
  end if;
  if p_outcome = 'completed' and (
    coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false
    or (v_attendance ->> 'classification') in (
      'no_show_patient', 'no_show_therapist', 'no_show_both', 'requires_review'
    )
    or exists (
      select 1 from public.session_confirmation_incidents incident
      join public.bookings booking on booking.id = incident.booking_id
      where incident.booking_id = p_booking_id
        and incident.booking_version = case
          when booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
            then booking.version - 1
          else booking.version
        end
        and incident.status = 'open'
    )
  ) then
    raise exception 'SESSION_CONFIRMATION_ATTENDANCE_REQUIRED' using errcode = '42501';
  end if;

  v_due_at := v_ends_at + make_interval(
    days => case v_actor_role
      when 'patient'::public.user_role then v_policy.patient_auto_confirmation_days
      else v_policy.therapist_auto_confirmation_days
    end
  );
  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome, p_source),
      'sha256'
    ),
    'hex'
  );

  select confirmation.* into v_existing
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'SESSION_CONFIRMATION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'confirmation', jsonb_build_object(
        'confirmedAt', v_existing.confirmed_at,
        'dueAt', v_existing.due_at,
        'outcome', v_existing.outcome,
        'source', v_existing.source
      ),
      'idempotentReplay', true
    );
  end if;

  insert into public.session_participant_confirmations (
    booking_id, participant_role, outcome, source, confirmed_by_profile_id,
    request_id, payload_hash, due_at, confirmed_at, policy_version_id
  ) values (
    p_booking_id, v_actor_role, p_outcome, p_source,
    case when p_source = 'manual' then p_actor_user_id else null end,
    p_request_id, v_hash, v_due_at, p_confirmed_at, v_policy.id
  )
  returning * into v_confirmation;

  return jsonb_build_object(
    'confirmation', jsonb_build_object(
      'confirmedAt', v_confirmation.confirmed_at,
      'dueAt', v_confirmation.due_at,
      'outcome', v_confirmation.outcome,
      'source', v_confirmation.source
    ),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select confirmation.* into v_existing
    from public.session_participant_confirmations confirmation
    where confirmation.booking_id = p_booking_id
      and confirmation.participant_role = v_actor_role
    limit 1;
    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'confirmation', jsonb_build_object(
          'confirmedAt', v_existing.confirmed_at,
          'dueAt', v_existing.due_at,
          'outcome', v_existing.outcome,
          'source', v_existing.source
        ),
        'idempotentReplay', true
      );
    end if;
    raise exception 'SESSION_CONFIRMATION_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

create or replace function public.submit_session_feedback_for_actor_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_outcome text,
  p_rating smallint,
  p_not_performed_reason text,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.user_role;
  v_existing public.session_feedback;
  v_feedback public.session_feedback;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_hash text;
  v_confirmation jsonb;
  v_participant_confirmation public.session_participant_confirmations;
  v_ends_at timestamptz;
  v_attendance jsonb;
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null
    or p_outcome not in ('completed', 'not_performed')
    or char_length(v_comment) > 500
  then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if p_outcome = 'completed' then
    if p_rating is null or p_rating not between 1 and 5
      or p_not_performed_reason is not null then
      raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
    end if;
  elsif p_rating is not null
    or p_not_performed_reason is null
    or p_not_performed_reason not in (
      'patient_absent', 'therapist_absent', 'internet_problem',
      'audio_video_problem', 'rescheduled', 'late_cancellation', 'other'
    ) then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select case
      when patient.user_id = p_actor_user_id then 'patient'::public.user_role
      when therapist.user_id = p_actor_user_id then 'therapist'::public.user_role
      else null
    end,
    booking.ends_at
  into v_actor_role, v_ends_at
  from public.bookings as booking
  left join public.patient_profiles as patient
    on patient.id = booking.patient_profile_id
  left join public.therapist_profiles as therapist
    on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;
  if now() < v_ends_at then
    raise exception 'FEEDBACK_SESSION_NOT_ENDED' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.session_payments as payment
    where payment.booking_id = p_booking_id
      and payment.financial_status in ('paid', 'partially_refunded')
      and payment.refund_pending = false
      and payment.disputed_at is null
  ) then
    raise exception 'FEEDBACK_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());
  if p_outcome = 'completed' and (
    coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false
    or (v_attendance ->> 'classification') in (
      'no_show_patient', 'no_show_therapist', 'no_show_both', 'requires_review'
    )
  ) then
    raise exception 'FEEDBACK_ATTENDANCE_REQUIRED' using errcode = '42501';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome,
        coalesce(p_rating::text, ''), coalesce(p_not_performed_reason, ''),
        v_comment),
      'sha256'
    ),
    'hex'
  );

  select feedback.* into v_existing
  from public.session_feedback as feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'confirmation', public.session_feedback_confirmation_payload(
        p_booking_id, v_actor_role
      ),
      'feedback', public.session_feedback_payload(v_existing),
      'idempotentReplay', true
    );
  end if;

  insert into public.session_feedback (
    author_profile_id, author_role, booking_id, comment,
    not_performed_reason, outcome, payload_hash, rating, request_id
  ) values (
    p_actor_user_id, v_actor_role, p_booking_id, v_comment,
    p_not_performed_reason, p_outcome, v_hash, p_rating, p_request_id
  )
  returning * into v_feedback;

  select confirmation.* into v_participant_confirmation
  from public.session_participant_confirmations as confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = v_actor_role
  for update;

  if v_participant_confirmation.id is null then
    v_confirmation := public.record_session_participant_confirmation_v1(
      p_actor_user_id, p_booking_id, p_outcome, p_request_id, 'manual', now()
    );
  else
    v_confirmation := jsonb_build_object(
      'confirmation', jsonb_build_object(
        'confirmedAt', v_participant_confirmation.confirmed_at,
        'dueAt', v_participant_confirmation.due_at,
        'outcome', v_participant_confirmation.outcome,
        'source', v_participant_confirmation.source
      ),
      'idempotentReplay', true
    );
  end if;

  if p_outcome = 'completed' then
    perform public.finalize_bilateral_session_confirmation_v1(p_booking_id, now());
  else
    update public.session_payments
    set service_status = 'not_performed',
        service_confirmed_at = null,
        service_confirmation_source = null,
        eligible_at = null,
        transfer_status = case
          when transfer_status in ('batched', 'transfer_pending', 'transferred')
            then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'participant_reported_not_performed',
        internal_contested_at = coalesce(internal_contested_at, now()),
        updated_at = now()
    where booking_id = p_booking_id
      and transfer_status <> 'transferred';
  end if;

  return jsonb_build_object(
    'confirmation', v_confirmation -> 'confirmation',
    'feedback', public.session_feedback_payload(v_feedback),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select feedback.* into v_existing
    from public.session_feedback as feedback
    where feedback.booking_id = p_booking_id
      and feedback.author_role = v_actor_role
    limit 1;
    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'confirmation', public.session_feedback_confirmation_payload(
          p_booking_id, v_actor_role
        ),
        'feedback', public.session_feedback_payload(v_existing),
        'idempotentReplay', true
      );
    end if;
    raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

commit;
