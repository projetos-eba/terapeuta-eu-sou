begin;

-- Shared evidence: private readers and service workers use the same attempt.
create function public.session_attempt_evidence_v1(p_booking_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_attempt public.booking_session_attempts; v_booking public.bookings;
  v_patient_arrived timestamptz; v_therapist_arrived timestamptz;
  v_patient_joined timestamptz; v_therapist_joined timestamptz;
  v_classification text; v_closed boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  select * into v_attempt from public.booking_session_attempts
    where id = public.current_session_attempt_id_v1(p_booking_id);
  if v_attempt.id is null then return jsonb_build_object('available', false); end if;
  select min(event.created_at) filter (where coalesce(event.payload->>'participantRole','patient') = 'patient'),
    min(event.created_at) filter (where event.payload->>'participantRole' = 'therapist')
  into v_patient_arrived, v_therapist_arrived from public.booking_events event
  where event.booking_id = p_booking_id and event.event_type = 'zoom_waiting_room_entered'
    and event.payload->>'sessionAttemptId' = v_attempt.id::text
    and event.created_at between v_attempt.starts_at - interval '15 minutes'
      and v_attempt.starts_at + interval '10 minutes';
  select min(coalesce(joined_at,created_at)) filter (where participant_role = 'patient'),
    min(coalesce(joined_at,created_at)) filter (where participant_role = 'therapist')
  into v_patient_joined, v_therapist_joined from public.video_session_participations
  where session_attempt_id = v_attempt.id and event_type = 'session.user_joined'
    and coalesce(joined_at,created_at) between v_attempt.starts_at - interval '15 minutes' and v_attempt.ends_at;
  select case when classification = 'requires_review' and status = 'performed_confirmed'
      and v_patient_joined is not null and v_therapist_joined is not null
      then null else classification end into v_classification from public.session_confirmation_incidents
    where session_attempt_id = v_attempt.id order by created_at desc limit 1;
  if v_booking.status in ('no_show_patient','no_show_therapist','no_show_both') then
    v_classification := v_booking.status::text;
  elsif p_now > v_attempt.starts_at + interval '10 minutes' then
    if v_patient_arrived is null and coalesce(v_patient_joined <= v_attempt.starts_at + interval '10 minutes',false) = false then
      v_classification := case when v_therapist_arrived is null and
        coalesce(v_therapist_joined <= v_attempt.starts_at + interval '10 minutes',false) = false
        then 'no_show_both' else 'no_show_patient' end;
    elsif v_therapist_arrived is null and coalesce(v_therapist_joined <= v_attempt.starts_at + interval '10 minutes',false) = false then
      v_classification := 'no_show_therapist';
    elsif p_now >= v_attempt.ends_at and (v_patient_joined is null or v_therapist_joined is null) then
      v_classification := 'requires_review';
    end if;
  end if;
  v_closed := p_now >= v_attempt.ends_at or exists (
    select 1 from public.video_sessions where booking_id = p_booking_id
      and scheduled_starts_at = v_attempt.starts_at and scheduled_ends_at = v_attempt.ends_at
      and termination_confirmed_at is not null and termination_reason = 'manual_end'
      and actual_ended_at >= v_attempt.ends_at - interval '5 minutes');
  return jsonb_build_object('available',true,'sessionAttemptId',v_attempt.id,
    'classification',v_classification,'sessionClosed',v_closed,
    'bothJoined',v_patient_joined is not null and v_therapist_joined is not null,
    'patientJoined',v_patient_joined is not null,'therapistJoined',v_therapist_joined is not null,
    'patientArrivedAt',v_patient_arrived,'therapistArrivedAt',v_therapist_arrived,
    'patientJoinedAt',v_patient_joined,'therapistJoinedAt',v_therapist_joined,
    'patientPresentAtTolerance',v_patient_arrived is not null or coalesce(v_patient_joined <= v_attempt.starts_at + interval '10 minutes',false),
    'therapistPresentAtTolerance',v_therapist_arrived is not null or coalesce(v_therapist_joined <= v_attempt.starts_at + interval '10 minutes',false),
    'sessionStartsAt',v_attempt.starts_at,'sessionEndsAt',v_attempt.ends_at);
end;
$$;

create function public.session_quality_review_state_v1(p_attempt_id uuid, p_now timestamptz default now())
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'isOpen',count(*) filter (where answered_at is null) > 0,
    'overdue',count(*) filter (where answered_at is null and due_at <= p_now) > 0,
    'automaticConfirmationPaused',count(*) filter (where answered_at is null and due_at > p_now) > 0,
    'dueAt',min(due_at) filter (where answered_at is null),
    'allAnswered',count(*) > 0 and count(*) filter (where answered_at is null) = 0)
  from public.session_quality_reviews where session_attempt_id = p_attempt_id;
$$;

create function public.session_quality_feedback_payload_v1(p_feedback public.session_quality_feedback)
returns jsonb language sql stable set search_path = '' as $$
  select case when p_feedback.id is null then null else jsonb_build_object(
    'id',p_feedback.id,'authorRole',p_feedback.author_role,'successful',p_feedback.successful,
    'rating',p_feedback.rating,'qualityReason',p_feedback.quality_reason,
    'comment',p_feedback.comment,'createdAt',p_feedback.created_at) end;
$$;

create function public.get_session_quality_feedback_v1(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role public.user_role; v_feedback public.session_quality_feedback;
  v_patient public.session_participant_confirmations; v_therapist public.session_participant_confirmations;
  v_evidence jsonb; v_review jsonb; v_status text; v_state text;
  v_attempt uuid; v_payment public.session_payments; v_ticket uuid;
begin
  select case when patient.user_id = auth.uid() then 'patient'::public.user_role
    when therapist.user_id = auth.uid() then 'therapist'::public.user_role end into v_role
  from public.bookings booking join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
  where booking.id = p_booking_id;
  if v_role is null then raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501'; end if;
  v_evidence := public.session_attempt_evidence_v1(p_booking_id);
  v_attempt := (v_evidence->>'sessionAttemptId')::uuid;
  v_review := public.session_quality_review_state_v1(v_attempt);
  select * into v_feedback from public.session_quality_feedback where session_attempt_id = v_attempt and author_role = v_role;
  select * into v_patient from public.session_participant_confirmations where session_attempt_id = v_attempt and participant_role = 'patient';
  select * into v_therapist from public.session_participant_confirmations where session_attempt_id = v_attempt and participant_role = 'therapist';
  select ticket_id into v_ticket from public.session_quality_reviews where feedback_id = v_feedback.id;
  select * into v_payment from public.session_payments where booking_id = p_booking_id;
  v_status := case when v_feedback.id is not null then 'submitted'
    when v_evidence->>'classification' is not null then 'unavailable'
    when (v_evidence->>'sessionClosed')::boolean = false then 'before_session'
    when (v_evidence->>'bothJoined')::boolean = true and v_evidence->>'classification' is null then 'eligible'
    else 'unavailable' end;
  v_state := case when (v_review->>'isOpen')::boolean then 'blocked_for_review'
    when v_patient.id is null and v_therapist.id is null then 'awaiting_both'
    when v_patient.id is null then 'awaiting_patient'
    when v_therapist.id is null then 'awaiting_therapist' else 'completed' end;
  return jsonb_build_object('contractVersion',2,'sessionAttemptId',v_attempt,'actorRole',v_role,
    'attendance',v_evidence,'qualityReview',v_review,'supportTicketId',v_ticket,
    'realizationStatus',case when (v_evidence->>'bothJoined')::boolean and (v_evidence->>'sessionClosed')::boolean
      and v_evidence->>'classification' is null then 'performed'
      when v_evidence->>'classification' like 'no_show_%' then 'not_performed' else 'pending' end,
    'feedback',public.session_quality_feedback_payload_v1(v_feedback),
    'status',v_status,'reason',case when v_status = 'eligible' then 'post_session_available' else 'attendance_incomplete' end,
    'confirmation',public.session_confirmation_payload_v2(case when v_role = 'patient' then v_patient else v_therapist end),
    'actorConfirmation',public.session_confirmation_payload_v2(case when v_role = 'patient' then v_patient else v_therapist end),
    'counterpartConfirmation',public.session_confirmation_payload_v2(case when v_role = 'patient' then v_therapist else v_patient end),
    'patientConfirmation',public.session_confirmation_payload_v2(v_patient),
    'therapistConfirmation',public.session_confirmation_payload_v2(v_therapist),'confirmationState',v_state,
    'policy',jsonb_build_object('patientAutoConfirmationDays',7,'therapistAutoConfirmationDays',30,'transferSafetyHours',0),
    'financial',jsonb_build_object('transferStatus',v_payment.transfer_status,'serviceStatus',v_payment.service_status,
      'serviceConfirmedAt',v_payment.service_confirmed_at,'eligibleAt',v_payment.eligible_at,
      'transferBlockedReason',v_payment.transfer_blocked_reason,'nextBatchAt',null));
end;
$$;

create function public.submit_session_quality_feedback_v1(p_actor_user_id uuid, p_booking_id uuid,
  p_session_attempt_id uuid, p_successful boolean, p_rating smallint,
  p_quality_reason text, p_comment text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role public.user_role; v_evidence jsonb; v_feedback public.session_quality_feedback;
  v_hash text; v_ticket public.support_tickets; v_comment text := btrim(coalesce(p_comment,''));
begin
  if p_actor_user_id is null or p_request_id is null or p_successful is null or char_length(v_comment) > 500
    or p_session_attempt_id is null then raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_booking_id::text,0));
  perform 1 from public.bookings where id = p_booking_id for update;
  select case when patient.user_id = p_actor_user_id then 'patient'::public.user_role
    when therapist.user_id = p_actor_user_id then 'therapist'::public.user_role end into v_role
  from public.bookings booking join public.patient_profiles patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id where booking.id = p_booking_id;
  if v_role is null then raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501'; end if;
  if public.current_session_attempt_id_v1(p_booking_id) is distinct from p_session_attempt_id then
    raise exception 'FEEDBACK_ATTEMPT_CHANGED' using errcode = '40001'; end if;
  if (p_successful and (p_rating is null or p_rating not between 1 and 5 or p_quality_reason is not null))
    or (not p_successful and (p_rating is not null or p_quality_reason is null
      or p_quality_reason not in ('internet_problem','audio_video_problem','other'))) then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023'; end if;
  v_hash := encode(extensions.digest(concat_ws('|',p_session_attempt_id::text,v_role::text,
    p_successful::text,coalesce(p_rating::text,''),coalesce(p_quality_reason,''),v_comment),'sha256'),'hex');
  select * into v_feedback from public.session_quality_feedback
    where session_attempt_id = p_session_attempt_id and author_role = v_role for update;
  if v_feedback.id is not null then
    if v_feedback.payload_hash <> v_hash then raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505'; end if;
    return jsonb_build_object('feedback',public.session_quality_feedback_payload_v1(v_feedback),'idempotentReplay',true);
  end if;
  v_evidence := public.session_attempt_evidence_v1(p_booking_id);
  if coalesce((v_evidence->>'bothJoined')::boolean,false) = false
    or coalesce((v_evidence->>'sessionClosed')::boolean,false) = false
    or v_evidence->>'classification' is not null then
    raise exception 'FEEDBACK_ATTENDANCE_REQUIRED' using errcode = '42501'; end if;
  insert into public.session_quality_feedback(booking_id,session_attempt_id,author_profile_id,author_role,
    successful,rating,quality_reason,comment,request_id,payload_hash)
  values(p_booking_id,p_session_attempt_id,p_actor_user_id,v_role,p_successful,p_rating,p_quality_reason,
    v_comment,p_request_id,v_hash) returning * into v_feedback;
  if not p_successful then
    insert into public.support_tickets(requester_profile_id,booking_id,category,subject,description,
      status,priority,urgency,request_id,correlation_id,diagnostic_context,source,last_activity_at)
    values(p_actor_user_id,p_booking_id,'zoom_acesso','Sessão realizada — análise da experiência',
      'A sessão não foi bem-sucedida. Motivo: ' || case p_quality_reason when 'internet_problem'
        then 'problema de internet' when 'audio_video_problem' then 'problema de áudio ou vídeo' else 'outro' end
        || case when v_comment <> '' then E'\n' || v_comment else '' end,
      'open','normal','normal',p_request_id,gen_random_uuid(),
      jsonb_build_object('sessionAttemptId',p_session_attempt_id,'qualityFeedbackId',v_feedback.id),
      'encounter_detail',now()) returning * into v_ticket;
    insert into public.support_ticket_messages(ticket_id,author_profile_id,author_role,body,visibility,request_id)
      values(v_ticket.id,p_actor_user_id,v_role,v_ticket.description,'requester',p_request_id);
    insert into public.session_quality_reviews(feedback_id,session_attempt_id,requester_profile_id,ticket_id)
      values(v_feedback.id,p_session_attempt_id,p_actor_user_id,v_ticket.id);
  end if;
  return jsonb_build_object('feedback',public.session_quality_feedback_payload_v1(v_feedback),'idempotentReplay',false);
end;
$$;

-- Quality is not a participant confirmation and cannot change payments.
create or replace function public.auto_confirm_sessions(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare v_row record; v_evidence jsonb; v_review jsonb; v_count integer := 0; v_inserted integer;
  v_run uuid; v_patient_count integer := 0; v_therapist_count integer := 0;
begin
  if p_now is null then raise exception 'SESSION_CONFIRMATION_VALIDATION_ERROR'; end if;
  insert into public.session_confirmation_scheduler_runs(scheduled_for,status)
    values(date_trunc('hour',p_now),'running') on conflict(scheduled_for) do update
    set status='running',attempts=public.session_confirmation_scheduler_runs.attempts+1,
      started_at=now(),finished_at=null,error_code=null returning id into v_run;
  for v_row in select booking.id, attempt.id as attempt_id, attempt.ends_at, deadline.role,
    attempt.ends_at + make_interval(days => deadline.days) as due_at
  from public.bookings booking
  join public.booking_session_attempts attempt on attempt.id = public.current_session_attempt_id_v1(booking.id)
  cross join lateral (values ('patient'::public.user_role,7),('therapist'::public.user_role,30)) deadline(role,days)
  where booking.status in ('confirmed','completed') and attempt.ends_at + make_interval(days => deadline.days) <= p_now
    and not exists (select 1 from public.session_participant_confirmations confirmation
      where confirmation.session_attempt_id = attempt.id and confirmation.participant_role = deadline.role)
  order by due_at, booking.id, deadline.role for update of booking skip locked
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_row.id::text,0)) then continue; end if;
    if public.current_session_attempt_id_v1(v_row.id) is distinct from v_row.attempt_id then continue; end if;
    v_evidence := public.session_attempt_evidence_v1(v_row.id,p_now);
    v_review := public.session_quality_review_state_v1(v_row.attempt_id,p_now);
    if coalesce((v_evidence->>'bothJoined')::boolean,false) = false
      or coalesce((v_evidence->>'sessionClosed')::boolean,false) = false
      or v_evidence->>'classification' is not null
      or (v_review->>'automaticConfirmationPaused')::boolean then continue; end if;
    insert into public.session_participant_confirmations(booking_id,session_attempt_id,participant_role,
      outcome,source,request_id,payload_hash,due_at,confirmed_at,policy_version_id)
    select v_row.id,v_row.attempt_id,v_row.role,'completed','automatic',gen_random_uuid(),
      encode(extensions.digest(v_row.attempt_id::text || ':' || v_row.role::text || ':automatic','sha256'),'hex'),
      v_row.due_at,p_now,payment.policy_version_id
    from public.session_payments payment where payment.booking_id = v_row.id
    on conflict (session_attempt_id,participant_role) where session_attempt_id is not null do nothing;
    get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
    if v_row.role='patient' then v_patient_count:=v_patient_count+v_inserted;
    else v_therapist_count:=v_therapist_count+v_inserted; end if;
  end loop;
  -- The support audit remains open after expiry; alert authorized Admins once.
  insert into public.notifications(profile_id,kind,title,body,href,event_key)
  select admin.id,'session_quality_review_overdue','Análise de sessão com prazo vencido',
    'O prazo de 5 dias terminou. Responda à pessoa pela Central de Suporte.',
    '/admin/suporte/' || review.ticket_id::text,'quality-review-overdue:' || review.id::text
  from public.session_quality_reviews review cross join public.profiles admin
  where admin.role = 'admin' and admin.auth_deleted_at is null and admin.anonymized_at is null
    and review.answered_at is null and review.due_at <= p_now
  on conflict (profile_id,event_key) where event_key is not null do nothing;
  update public.session_confirmation_scheduler_runs set status='completed',finished_at=now(),
    patient_confirmations=v_patient_count,therapist_confirmations=v_therapist_count,finalized_sessions=0
    where id=v_run;
  return v_count;
end;
$$;

revoke all on function public.session_attempt_evidence_v1(uuid,timestamptz),
  public.session_quality_review_state_v1(uuid,timestamptz),
  public.session_quality_feedback_payload_v1(public.session_quality_feedback),
  public.submit_session_quality_feedback_v1(uuid,uuid,uuid,boolean,smallint,text,text,uuid),
  public.get_session_quality_feedback_v1(uuid), public.auto_confirm_sessions(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_session_quality_feedback_v1(uuid) to authenticated,service_role;
grant execute on function public.session_attempt_evidence_v1(uuid,timestamptz),
  public.session_quality_review_state_v1(uuid,timestamptz),
  public.submit_session_quality_feedback_v1(uuid,uuid,uuid,boolean,smallint,text,text,uuid),
  public.auto_confirm_sessions(timestamptz) to service_role;
commit;
