-- Private quality feedback is exclusively a TES quality signal. It must not
-- create, update, or imply a participant confirmation.
begin;

create or replace function public.submit_session_quality_feedback_v1(
  p_actor_user_id uuid,
  p_booking_id uuid,
  p_session_attempt_id uuid,
  p_successful boolean,
  p_rating smallint,
  p_quality_reason text,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.submit_session_quality_feedback_only_v1(
    p_actor_user_id,
    p_booking_id,
    p_session_attempt_id,
    p_successful,
    p_rating,
    p_quality_reason,
    p_comment,
    p_request_id
  );
end;
$$;

revoke all on function public.submit_session_quality_feedback_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.submit_session_quality_feedback_v1(
  uuid, uuid, uuid, boolean, smallint, text, text, uuid
) to service_role;

-- A private quality report remains auditable, but it never delays the separate
-- internal confirmation lifecycle.
create or replace function public.session_quality_review_state_v1(
  p_attempt_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'isOpen', count(*) filter (where answered_at is null) > 0,
    'overdue', count(*) filter (where answered_at is null and due_at <= p_now) > 0,
    'automaticConfirmationPaused', false,
    'dueAt', min(due_at) filter (where answered_at is null),
    'allAnswered', count(*) > 0 and count(*) filter (where answered_at is null) = 0
  )
  from public.session_quality_reviews
  where session_attempt_id = p_attempt_id;
$$;

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
  select ticket_id into v_ticket
  from public.session_quality_reviews
  where feedback_id = v_feedback.id;
  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id;

  v_status := case
    when v_feedback.id is not null then 'submitted'
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
    'reason', case when v_status = 'eligible'
      then 'post_session_available' else 'attendance_incomplete' end,
    'confirmation', public.session_confirmation_payload_v2(
      case when v_role = 'patient' then v_patient else v_therapist end
    ),
    'actorConfirmation', public.session_confirmation_payload_v2(
      case when v_role = 'patient' then v_patient else v_therapist end
    ),
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
    where booking.status in ('confirmed','completed')
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

-- A patient may publish the optional relationship review after a positive
-- private quality response. Historical confirmations remain a compatible
-- eligibility source, but feedback never writes them.
create or replace function public.get_patient_therapist_review_v1(
  p_therapist_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_patient_id uuid;
  v_review public.reviews;
  v_eligible boolean;
begin
  if v_actor_id is null then
    raise exception 'PATIENT_REVIEW_AUTH_REQUIRED' using errcode = '42501';
  end if;

  select patient.id into v_patient_id
  from public.patient_profiles patient
  where patient.user_id = v_actor_id;
  if v_patient_id is null then
    raise exception 'PATIENT_REVIEW_PATIENT_REQUIRED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.bookings booking
    where booking.patient_profile_id = v_patient_id
      and booking.therapist_profile_id = p_therapist_profile_id
      and (
        exists (
          select 1
          from public.session_quality_feedback feedback
          where feedback.booking_id = booking.id
            and feedback.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
            and feedback.author_role = 'patient'
            and feedback.successful = true
        )
        or exists (
          select 1
          from public.session_participant_confirmations confirmation
          where confirmation.booking_id = booking.id
            and confirmation.participant_role = 'patient'::public.user_role
            and confirmation.outcome = 'completed'
        )
      )
  ) into v_eligible;

  select review.* into v_review
  from public.reviews review
  where review.patient_profile_id = v_patient_id
    and review.therapist_profile_id = p_therapist_profile_id
    and review.superseded_at is null;

  return jsonb_build_object(
    'eligible', v_eligible,
    'review', public.patient_review_payload_v1(v_review),
    'therapistProfileId', p_therapist_profile_id
  );
end;
$$;

create or replace function public.save_patient_therapist_review_for_actor_v1(
  p_actor_user_id uuid,
  p_therapist_profile_id uuid,
  p_action text,
  p_rating integer,
  p_comment text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient public.patient_profiles%rowtype;
  v_booking_id uuid;
  v_review public.reviews;
  v_existing_request public.patient_review_mutation_requests%rowtype;
  v_comment text := btrim(coalesce(p_comment, ''));
  v_hash text;
  v_change_source text;
begin
  if p_actor_user_id is null or p_therapist_profile_id is null or p_request_id is null
    or p_action not in ('save', 'hide', 'publish')
    or char_length(v_comment) > 1000 then
    raise exception 'PATIENT_REVIEW_VALIDATION_ERROR' using errcode = '22023';
  end if;
  if p_action in ('save', 'publish') and (p_rating is null or p_rating not between 1 and 5) then
    raise exception 'PATIENT_REVIEW_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select patient.* into v_patient
  from public.patient_profiles patient
  where patient.user_id = p_actor_user_id;
  if v_patient.id is null then
    raise exception 'PATIENT_REVIEW_PATIENT_REQUIRED' using errcode = '42501';
  end if;

  select booking.id into v_booking_id
  from public.bookings booking
  where booking.patient_profile_id = v_patient.id
    and booking.therapist_profile_id = p_therapist_profile_id
    and (
      exists (
        select 1
        from public.session_quality_feedback feedback
        where feedback.booking_id = booking.id
          and feedback.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and feedback.author_role = 'patient'
          and feedback.successful = true
      )
      or exists (
        select 1
        from public.session_participant_confirmations confirmation
        where confirmation.booking_id = booking.id
          and confirmation.participant_role = 'patient'::public.user_role
          and confirmation.outcome = 'completed'
      )
    )
  order by booking.ends_at desc
  limit 1;
  if v_booking_id is null then
    raise exception 'PATIENT_REVIEW_RELATION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'action', p_action,
    'comment', v_comment,
    'rating', p_rating,
    'therapistProfileId', p_therapist_profile_id
  )::text, 'sha256'), 'hex');

  select request.* into v_existing_request
  from public.patient_review_mutation_requests request
  where request.patient_profile_id = v_patient.id
    and request.request_id = p_request_id
  for update;
  if v_existing_request.id is not null then
    if v_existing_request.payload_hash <> v_hash then
      raise exception 'PATIENT_REVIEW_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select review.* into v_review
    from public.reviews review
    where review.id = v_existing_request.review_id;
    return jsonb_build_object(
      'idempotentReplay', true,
      'review', public.patient_review_payload_v1(v_review)
    );
  end if;

  select review.* into v_review
  from public.reviews review
  where review.patient_profile_id = v_patient.id
    and review.therapist_profile_id = p_therapist_profile_id
    and review.superseded_at is null
  for update;

  if p_action = 'hide' then
    if v_review.id is null then raise exception 'PATIENT_REVIEW_NOT_FOUND'; end if;
    perform set_config('tes.review_change_source', 'patient_hide', true);
    perform set_config('tes.review_actor_id', p_actor_user_id::text, true);
    update public.reviews
    set status = 'hidden', published_at = null, updated_at = now()
    where id = v_review.id
    returning * into v_review;
  elsif v_review.id is null then
    insert into public.reviews (
      booking_id, patient_profile_id, therapist_profile_id,
      rating, comment, status, published_at
    ) values (
      v_booking_id, v_patient.id, p_therapist_profile_id,
      p_rating, nullif(v_comment, ''), 'published', now()
    ) returning * into v_review;
  else
    v_change_source := case when p_action = 'publish'
      then 'patient_republish' else 'patient_edit' end;
    perform set_config('tes.review_change_source', v_change_source, true);
    perform set_config('tes.review_actor_id', p_actor_user_id::text, true);
    update public.reviews
    set booking_id = v_booking_id,
        rating = p_rating,
        comment = nullif(v_comment, ''),
        status = 'published',
        published_at = case when status = 'published' then published_at else now() end,
        updated_at = now()
    where id = v_review.id
    returning * into v_review;
  end if;

  insert into public.patient_review_mutation_requests (
    patient_profile_id, therapist_profile_id, request_id,
    action, payload_hash, review_id
  ) values (
    v_patient.id, p_therapist_profile_id, p_request_id,
    p_action, v_hash, v_review.id
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'review', public.patient_review_payload_v1(v_review)
  );
end;
$$;

revoke all on function public.get_patient_therapist_review_v1(uuid)
  from public, anon;
grant execute on function public.get_patient_therapist_review_v1(uuid)
  to authenticated, service_role;

revoke all on function public.save_patient_therapist_review_for_actor_v1(
  uuid, uuid, text, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.save_patient_therapist_review_for_actor_v1(
  uuid, uuid, text, integer, text, uuid
) to service_role;

commit;
