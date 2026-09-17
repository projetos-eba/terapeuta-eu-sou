begin;
alter table public.session_confirmation_incidents drop constraint session_confirmation_incidents_classification_check;
alter table public.session_confirmation_incidents add constraint session_confirmation_incidents_classification_check
  check (classification is null or classification in ('participant_report','no_show_patient','no_show_therapist','no_show_both','requires_review'));

create or replace function public.finalize_due_session_attendance_v1(p_now timestamptz default now(),p_limit integer default 50)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_row record; v_evidence jsonb; v_attempt uuid; v_class text; v_incident uuid; v_session uuid; v_count integer := 0;
begin
  if p_now is null or p_limit not between 1 and 200 then raise exception 'SESSION_ATTENDANCE_FINALIZER_INVALID' using errcode='22023'; end if;
  for v_row in
    select booking.*,payment.id as payment_id,payment.policy_version_id,
      patient.user_id as patient_user_id,therapist.user_id as therapist_user_id
    from public.bookings booking join public.session_payments payment on payment.booking_id=booking.id
    join public.patient_profiles patient on patient.id=booking.patient_profile_id
    join public.therapist_profiles therapist on therapist.id=booking.therapist_profile_id
    where booking.status='confirmed' and booking.meeting_provider in ('zoom','zoom_video_sdk')
      and booking.starts_at + interval '10 minutes' < p_now
      and public.session_attempt_evidence_v1(booking.id,p_now)->>'classification' is not null
      and not exists (select 1 from public.session_confirmation_incidents incident
        where incident.session_attempt_id=public.current_session_attempt_id_v1(booking.id))
      and not exists (select 1 from public.booking_reschedule_requests request where request.booking_id=booking.id
        and request.status in ('pending','pending_admin_review') and request.change_kind in ('therapist_reschedule','therapist_cancellation'))
    order by booking.starts_at,booking.id limit p_limit for update of booking skip locked
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_row.id::text,0)) then continue; end if;
    v_evidence:=public.session_attempt_evidence_v1(v_row.id,p_now);
    v_attempt:=(v_evidence->>'sessionAttemptId')::uuid; v_class:=v_evidence->>'classification';
    if v_class not in ('no_show_patient','no_show_therapist','no_show_both','requires_review') then continue; end if;
    insert into public.session_confirmation_incidents(booking_id,booking_version,session_payment_id,session_attempt_id,
      classification,classification_source,patient_arrived_at,therapist_arrived_at,patient_joined_at,therapist_joined_at,
      review_due_at,policy_version_id,responsibility,financial_resolution,retention_authorized,processing_cost_recovery_authorized,evidence)
    values(v_row.id,v_row.version,v_row.payment_id,v_attempt,v_class,'combined_attendance_evidence',
      (v_evidence->>'patientArrivedAt')::timestamptz,(v_evidence->>'therapistArrivedAt')::timestamptz,
      (v_evidence->>'patientJoinedAt')::timestamptz,(v_evidence->>'therapistJoinedAt')::timestamptz,
      p_now+interval '5 days',v_row.policy_version_id,'unassigned','pending',false,false,
      v_evidence||jsonb_build_object('classifiedAt',p_now))
    on conflict (booking_id,booking_version) do nothing returning id into v_incident;
    if v_incident is null then continue; end if;
    perform pg_catalog.set_config('tes.booking_actor_profile_id','',true);
    perform pg_catalog.set_config('tes.booking_reason','attendance_finalized',true);
    perform pg_catalog.set_config('tes.booking_request_id','attendance:'||v_attempt::text,true);
    perform pg_catalog.set_config('tes.booking_source','attendance-finalizer',true);
    if v_class <> 'requires_review' then
      update public.bookings set status=v_class::public.booking_status,updated_at=p_now where id=v_row.id;
      select session.id into v_session from public.video_sessions session where session.booking_id=v_row.id
        and session.scheduled_starts_at=v_row.starts_at and session.scheduled_ends_at=v_row.ends_at
        and session.status in ('ready','active') and session.termination_confirmed_at is null
        order by session.created_at desc limit 1;
      if v_session is not null then
        perform public.enqueue_video_session_control_job_v1(v_session,'end_attendance_no_show',
          'attendance-no-show:'||v_row.id::text||':v'||v_row.version::text,p_now,
          jsonb_build_object('bookingVersion',v_row.version,'sessionAttemptId',v_attempt,'scheduledStartsAt',v_row.starts_at::text,'source','attendance-finalizer'));
      end if;
    end if;
    insert into public.notifications(profile_id,kind,title,body,href,event_key) values
      (v_row.patient_user_id,'session_attendance_review_patient',
        case when v_class='requires_review' then 'Acesso do encontro em análise' else 'Encontro não realizado' end,
        'O TES analisará o registro em até 5 dias. Qualquer decisão financeira exige autorização do Admin.',
        '/app/encontros/'||v_row.id::text,'attendance-review:'||v_incident::text||':patient'),
      (v_row.therapist_user_id,'session_attendance_review_therapist',
        case when v_class='requires_review' then 'Acesso da sessão em análise' else 'Sessão não realizada' end,
        'O TES analisará o registro em até 5 dias. O financeiro permanece separado desta classificação.',
        '/terapeuta/sessoes/'||v_row.id::text,'attendance-review:'||v_incident::text||':therapist')
      on conflict (profile_id,event_key) where event_key is not null do nothing;
    v_count:=v_count+1;
  end loop;
  return v_count;
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
  v_attempt_id uuid;
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

  v_attempt_id := public.current_session_attempt_id_v1(p_booking_id);
  v_attendance := public.session_attempt_evidence_v1(p_booking_id, now());
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
      when 'patient'::public.user_role then 7
      else 30
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
  where confirmation.session_attempt_id = v_attempt_id
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
    booking_id, session_attempt_id, participant_role, outcome, source, confirmed_by_profile_id,
    request_id, payload_hash, due_at, confirmed_at, policy_version_id
  ) values (
    p_booking_id, v_attempt_id, v_actor_role, p_outcome, p_source,
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
    where confirmation.session_attempt_id = v_attempt_id
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


create or replace function public.enqueue_video_session_control_job_v1(
  p_video_session_id uuid,
  p_operation public.video_session_control_operation,
  p_idempotency_key text,
  p_next_run_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.video_sessions%rowtype;
  v_job_id uuid;
begin
  select *
    into v_session
  from public.video_sessions
  where id = p_video_session_id;

  if not found then
    raise exception 'video_session_not_found' using errcode = 'P0002';
  end if;

  insert into public.video_session_control_jobs (
    video_session_id,
    booking_id,
    environment,
    operation,
    idempotency_key,
    next_run_at,
    metadata
  )
  values (
    v_session.id,
    v_session.booking_id,
    v_session.environment,
    p_operation,
    left(p_idempotency_key, 160),
    coalesce(p_next_run_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (environment, idempotency_key) do update
  set metadata = public.video_session_control_jobs.metadata || excluded.metadata,
      updated_at = now()
  where public.video_session_control_jobs.status in ('queued', 'retry', 'processing')
  returning id into v_job_id;

  return v_job_id;
end;
$$;


create or replace function public.enqueue_due_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 50,
  p_therapist_absence_grace_seconds integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_session record;
begin
  if p_environment not in ('development', 'production') then
    raise exception 'invalid_zoom_video_environment' using errcode = '22023';
  end if;

  -- Compatibility-only input. Therapist reconnect grace remains unrelated to
  -- the no-show rule and never authorizes a terminal transition.
  if p_therapist_absence_grace_seconds is not null then
    null;
  end if;

  -- A queued timeout from a previous booking version, or one invalidated by a
  -- just-recorded patient arrival, must not be retried later.
  update public.video_session_control_jobs job
  set status = 'done'::public.video_session_control_job_status,
      completed_at = coalesce(job.completed_at, now()),
      locked_until_at = null,
      last_error_code = null,
      last_error_message = null,
      metadata = job.metadata || jsonb_build_object(
        'supersededBy', 'patient_arrival_or_booking_change',
        'supersededAt', now()
      ),
      updated_at = now()
  from public.bookings booking
  where job.booking_id = booking.id
    and job.operation = 'end_patient_no_show'::public.video_session_control_operation
    and job.status in (
      'queued'::public.video_session_control_job_status,
      'retry'::public.video_session_control_job_status
    )
    and (
      job.metadata ->> 'bookingVersion' is distinct from booking.version::text
      or job.metadata ->> 'scheduledStartsAt' is distinct from booking.starts_at::text
      or exists (
        select 1
        from public.booking_events event
        where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      or exists (
        select 1
        from public.video_session_participations participation
        join public.video_sessions session on session.id = participation.video_session_id
        where session.booking_id = booking.id
          and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      )
    );

  for v_session in
    select session.id, booking.version, booking.starts_at
    from public.video_sessions session
    join public.bookings booking on booking.id = session.booking_id
    where session.environment = p_environment
      and session.status = 'active'
      and session.termination_confirmed_at is null
      and booking.status = 'confirmed'::public.booking_status
      and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
      and exists (
        select 1
        from public.session_payments payment
        where payment.booking_id = booking.id
          and payment.financial_status = 'paid'::public.session_financial_status
      )
      and session.scheduled_starts_at = booking.starts_at
      and session.scheduled_ends_at = booking.ends_at
      and booking.starts_at + interval '10 minutes' < now()
      and booking.ends_at > now()
      and not exists (select 1 from public.video_session_control_jobs existing
        where existing.video_session_id = session.id and existing.operation = 'end_patient_no_show'
          and existing.metadata->>'bookingVersion' = booking.version::text)
      and not exists (
        select 1
        from public.booking_events event
        where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1
        from public.video_session_participations participation
        where participation.video_session_id = session.id
              and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      )
    order by booking.starts_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id,
      'end_patient_no_show',
      'patient-no-show:' || v_session.id::text || ':v' || v_session.version::text ||
        ':' || floor(extract(epoch from v_session.starts_at) * 1000)::bigint::text,
      now(),
      jsonb_build_object(
        'bookingVersion', v_session.version,
        'scheduledStartsAt', v_session.starts_at::text,
        'source', 'maintenance_due_scan'
      )
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and scheduled_ends_at <= now()
      and termination_confirmed_at is null
    and not exists (select 1 from public.video_session_control_jobs existing
        where existing.video_session_id = video_sessions.id and existing.operation = 'end_scheduled')
    order by scheduled_ends_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id, 'end_scheduled', 'scheduled-end:' || v_session.id::text,
      now(), jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  for v_session in
    select id
    from public.video_sessions
    where environment = p_environment
      and status = 'active'
      and scheduled_ends_at > now()
      and hard_ends_at is not null
      and hard_ends_at <= now()
      and termination_confirmed_at is null
    and not exists (select 1 from public.video_session_control_jobs existing
        where existing.video_session_id = video_sessions.id and existing.operation = 'end_hard_timeout')
    order by hard_ends_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    perform public.enqueue_video_session_control_job_v1(
      v_session.id, 'end_hard_timeout', 'hard-timeout:' || v_session.id::text,
      now(), jsonb_build_object('source', 'maintenance_due_scan')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


create or replace function public.admin_resolve_session_attendance_v1(
  p_incident_id uuid,
  p_resolution text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_incident public.session_confirmation_incidents%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.session_payments%rowtype;
  v_patient_user_id uuid;
  v_therapist_user_id uuid;
  v_reschedule jsonb;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin'::public.user_role
      and auth_deleted_at is null and anonymized_at is null
  ) then
    raise exception 'SESSION_ATTENDANCE_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_incident_id is null or p_request_id is null
    or p_resolution not in (
      'performed', 'reschedule', 'refund', 'retain',
      'platform_reschedule', 'platform_refund'
    )
    or length(btrim(coalesce(p_reason, ''))) not between 20 and 1000
  then
    raise exception 'SESSION_ATTENDANCE_RESOLUTION_INVALID' using errcode = '22023';
  end if;

  select * into v_incident
  from public.session_confirmation_incidents
  where id = p_incident_id for update;
  if not found then raise exception 'SESSION_ATTENDANCE_INCIDENT_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_booking from public.bookings
  where id = v_incident.booking_id for update;
  select * into v_payment from public.session_payments
  where id = v_incident.session_payment_id for update;
  select patient.user_id, therapist.user_id
  into v_patient_user_id, v_therapist_user_id
  from public.patient_profiles as patient,
    public.therapist_profiles as therapist
  where patient.id = v_booking.patient_profile_id
    and therapist.id = v_booking.therapist_profile_id;

  if v_incident.resolution_request_id = p_request_id then
    return jsonb_build_object(
      'idempotentReplay', true,
      'incidentId', v_incident.id,
      'bookingId', v_incident.booking_id,
      'paymentId', v_incident.session_payment_id,
      'paymentFlowVersion', v_payment.payment_flow_version,
      'resolution', v_incident.operational_resolution,
      'financialResolution', v_incident.financial_resolution,
      'requiresProviderRefund',
        v_incident.operational_resolution = 'refund'
          and v_incident.financial_resolution = 'refund_pending'
    );
  end if;
  if v_incident.session_attempt_id is distinct from public.current_session_attempt_id_v1(v_incident.booking_id) then
    raise exception 'SESSION_ATTENDANCE_ATTEMPT_CHANGED' using errcode = '40001';
  end if;
  if v_incident.classification in ('no_show_therapist','no_show_both') and p_resolution <> 'refund' then
    raise exception 'SESSION_ATTENDANCE_FULL_REFUND_ONLY' using errcode = '23514';
  end if;
  if v_incident.status <> 'open' then
    raise exception 'SESSION_ATTENDANCE_INCIDENT_ALREADY_RESOLVED' using errcode = '23505';
  end if;

  if p_resolution = 'retain' and (
    v_incident.classification <> 'no_show_both'
    or not v_incident.retention_authorized
  ) then
    raise exception 'SESSION_ATTENDANCE_RETENTION_NOT_AUTHORIZED' using errcode = '23514';
  end if;
  if p_resolution = 'performed'
    and (v_incident.classification <> 'requires_review'
      or coalesce((public.session_attempt_evidence_v1(v_booking.id)->>'bothJoined')::boolean,false) = false)
  then
    raise exception 'SESSION_ATTENDANCE_PERFORMED_NOT_ALLOWED' using errcode = '23514';
  end if;

  if p_resolution in ('reschedule', 'platform_reschedule') then
    if v_booking.status in ('no_show_therapist', 'no_show_both') then
      perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
      perform pg_catalog.set_config('tes.booking_reason', 'attendance_reschedule_approved', true);
      perform pg_catalog.set_config('tes.booking_request_id', p_request_id::text, true);
      perform pg_catalog.set_config('tes.booking_source', 'admin-attendance', true);
      update public.bookings set status = 'confirmed', updated_at = now()
      where id = v_booking.id;
      select * into v_booking from public.bookings where id = v_booking.id;
    end if;

    v_reschedule := public.open_therapist_booking_change_v1(
      v_booking.id,
      v_therapist_user_id,
      'reschedule',
      'Novo horário autorizado após análise do TES.',
      'attendance-reschedule:' || p_request_id::text,
      v_booking.version
    );

    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed',
        responsibility = case
          when p_resolution = 'platform_reschedule' then 'platform'
          else case classification
          when 'no_show_therapist' then 'therapist'
          when 'no_show_both' then 'both'
          else 'inconclusive'
          end
        end,
        operational_resolution = 'reschedule',
        financial_resolution = 'reschedule_pending',
        resolution_reason = btrim(p_reason),
        resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id,
        resolved_at = now(), updated_at = now()
    where id = v_incident.id;

    update public.session_payments
    set service_status = 'scheduled'::public.session_service_status,
        service_confirmed_at = null,
        service_confirmation_source = null,
        eligible_at = null,
        refund_pending = false,
        admin_blocked_at = null,
        internal_contested_at = null,
        transfer_status = case
          when v_payment.payment_flow_version = 'v10' then transfer_status
          when transfer_status in ('batched', 'transfer_pending', 'transferred', 'reversed')
            then transfer_status
          else 'waiting_confirmation'::public.session_transfer_status
        end,
        transfer_blocked_reason = null,
        updated_at = now()
    where id = v_payment.id;
  elsif p_resolution in ('refund', 'platform_refund') then
    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed',
        responsibility = case
          when p_resolution = 'platform_refund' then 'platform'
          else case classification
          when 'no_show_therapist' then 'therapist'
          when 'no_show_both' then 'both'
          else 'inconclusive'
          end
        end,
        operational_resolution = 'refund',
        financial_resolution = 'refund_pending',
        resolution_reason = btrim(p_reason),
        resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id,
        resolved_at = now(), updated_at = now()
    where id = v_incident.id;
    update public.session_payments
    set refund_pending = true,
        admin_blocked_at = coalesce(admin_blocked_at, now()),
        transfer_blocked_reason = 'attendance_refund_review',
        updated_at = now()
    where id = v_payment.id;
  elsif p_resolution = 'retain' then
    insert into public.session_cancellation_decisions (
      booking_id, session_payment_id, policy_version_id,
      requested_by_profile_id, requested_by_role, request_id, reason,
      decision, refund_amount_cents, retained_amount_cents,
      therapist_retained_cents, platform_retained_cents,
      requires_manual_review, review_due_at, processed_at, metadata
    ) values (
      v_booking.id, v_payment.id, v_payment.policy_version_id,
      v_actor_id, 'admin', p_request_id, btrim(p_reason),
      'double_no_show_retained', 0, v_payment.gross_amount_cents,
      0, v_payment.gross_amount_cents, false, null, now(),
      jsonb_build_object(
        'attendanceIncidentId', v_incident.id,
        'stripeFeeAmountCents', v_payment.stripe_fee_amount_cents,
        'netPlatformResultCents', case
          when v_payment.stripe_fee_amount_cents is null then null
          else v_payment.gross_amount_cents - v_payment.stripe_fee_amount_cents
        end
      )
    );
    update public.session_confirmation_incidents
    set status = 'not_performed_confirmed', responsibility = 'both',
        operational_resolution = 'retain', financial_resolution = 'retained',
        resolution_reason = btrim(p_reason), resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id, resolved_at = now(), updated_at = now()
    where id = v_incident.id;
  else
    update public.session_confirmation_incidents
    set status = 'performed_confirmed', responsibility = 'inconclusive',
        operational_resolution = 'performed', financial_resolution = 'no_action',
        resolution_reason = btrim(p_reason), resolved_by_user_id = v_actor_id,
        resolution_request_id = p_request_id, resolved_at = now(), updated_at = now()
    where id = v_incident.id;
    -- Technical evidence resolution is not a participant confirmation and
    -- must not change a V10 Transfer or any payment state.
  end if;

  insert into public.notifications (profile_id, kind, title, body, href, event_key)
  values
    (
      v_patient_user_id,
      'session_attendance_resolution_patient',
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Reagendamento autorizado'
        when p_resolution in ('refund', 'platform_refund')
          then 'Reembolso autorizado'
        else 'Análise do encontro concluída'
      end,
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Você já pode escolher um novo horário com o mesmo terapeuta, sem nova cobrança.'
        when p_resolution in ('refund', 'platform_refund')
          then 'O reembolso integral foi autorizado e seguirá para conclusão financeira.'
        when p_resolution = 'retain'
          then 'A análise foi concluída conforme a política aceita para esta reserva. Você pode contestar pelo Suporte.'
        when p_resolution = 'performed'
          then 'As evidências foram revisadas e o encontro foi confirmado como realizado.'
        else 'A ocorrência foi atribuída à plataforma e será tratada sem prejuízo aos participantes.'
      end,
      '/app/encontros/' || v_booking.id::text,
      'attendance-resolution:' || v_incident.id::text || ':patient'
    ),
    (
      v_therapist_user_id,
      'session_attendance_resolution_therapist',
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'Reagendamento autorizado'
        when p_resolution in ('refund', 'platform_refund')
          then 'Reembolso autorizado'
        else 'Análise da sessão concluída'
      end,
      case
        when p_resolution in ('reschedule', 'platform_reschedule')
          then 'O cliente poderá escolher um novo horário, sem nova cobrança.'
        when p_resolution in ('refund', 'platform_refund')
          then 'O reembolso integral foi autorizado. Consulte o Financeiro para acompanhar a conciliação.'
        when p_resolution = 'retain'
          then 'A sessão foi encerrada sem remuneração conforme a política aceita para a reserva.'
        when p_resolution = 'performed'
          then 'As evidências foram revisadas e a sessão foi confirmada como realizada.'
        else 'A ocorrência foi atribuída à plataforma e não contará para responsabilização profissional.'
      end,
      '/terapeuta/sessoes/' || v_booking.id::text,
      'attendance-resolution:' || v_incident.id::text || ':therapist'
    )
  on conflict (profile_id, event_key) where event_key is not null do nothing;

  perform public.record_admin_audit_event_v1(
    v_actor_id, 'admin', 'admin.sessions.manage',
    'session_attendance_incident.resolve', 'session_confirmation_incident',
    v_incident.id::text,
    jsonb_build_object('classification', v_incident.classification, 'status', v_incident.status),
    jsonb_build_object('resolution', p_resolution),
    btrim(p_reason), p_request_id::text, null, 'session_attendance'
  );

  return jsonb_build_object(
    'idempotentReplay', false,
    'incidentId', v_incident.id,
    'bookingId', v_incident.booking_id,
    'paymentId', v_payment.id,
    'paymentFlowVersion', v_payment.payment_flow_version,
    'resolution', p_resolution,
    'reschedule', v_reschedule,
    'requiresProviderRefund', p_resolution in ('refund', 'platform_refund'),
    'retentionAuthorized', v_incident.retention_authorized
  );
end;
$$;


create or replace function public.reserve_video_session_control_jobs_v1(
  p_environment text,
  p_limit integer default 10,
  p_lock_seconds integer default 60
)
returns table (
  id uuid,
  video_session_id uuid,
  booking_id uuid,
  provider_session_id text,
  operation public.video_session_control_operation,
  attempts integer,
  max_attempts integer
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select job.id
    from public.video_session_control_jobs job
    join public.video_sessions session on session.id = job.video_session_id
    join public.bookings booking on booking.id = job.booking_id
    where job.environment = p_environment
      and job.status in ('queued', 'retry')
      and job.next_run_at <= now()
      and coalesce(job.locked_until_at, '-infinity'::timestamptz) <= now()
      and job.attempts < job.max_attempts
      and session.termination_confirmed_at is null
      and session.status not in ('ended', 'canceled')
      and (
        job.operation not in ('end_patient_no_show', 'end_attendance_no_show')
        or pg_catalog.pg_try_advisory_xact_lock(
          pg_catalog.hashtextextended(booking.id::text, 0)
        )
      )
      and (
        (job.operation = 'end_scheduled' and session.scheduled_ends_at <= now())
        or (
          job.operation = 'end_hard_timeout'
          and session.hard_ends_at is not null
          and session.hard_ends_at <= now()
        )
        or (
          job.operation = 'end_patient_no_show'
          and session.status in ('ready', 'active')
          and session.scheduled_starts_at = booking.starts_at
          and session.scheduled_ends_at = booking.ends_at
          and booking.status = 'confirmed'::public.booking_status
          and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
          and exists (
            select 1 from public.session_payments payment
            where payment.booking_id = booking.id
              and payment.financial_status = 'paid'::public.session_financial_status
          )
          and not exists (
            select 1
            from public.booking_reschedule_requests request
            where request.booking_id = booking.id
              and request.status in ('pending', 'pending_admin_review')
              and request.change_kind in (
                'therapist_reschedule', 'therapist_cancellation'
              )
          )
          and booking.starts_at + interval '10 minutes' < now()
          and job.metadata ->> 'bookingVersion' = booking.version::text
          and (job.metadata ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and not exists (
            select 1 from public.booking_events event
            where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = booking.version::text
              and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
              and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
              and event.created_at <= booking.starts_at + interval '10 minutes'
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.video_session_id = session.id
              and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
              and participation.participant_role = 'patient'::public.video_session_participant_role
              and participation.event_type = 'session.user_joined'
              and coalesce(participation.joined_at, participation.created_at)
                between booking.starts_at - interval '15 minutes'
                  and booking.starts_at + interval '10 minutes'
          )
        )
        or (
          job.operation = 'end_attendance_no_show'
          and session.status in ('ready', 'active')
          and session.scheduled_starts_at = booking.starts_at
          and session.scheduled_ends_at = booking.ends_at
          and booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
          and booking.starts_at + interval '10 minutes' < now()
          and job.metadata ->> 'bookingVersion' = (booking.version - 1)::text
          and (job.metadata ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and exists (
            select 1 from public.session_confirmation_incidents incident
            where incident.booking_id = booking.id
              and incident.booking_version = booking.version - 1
              and incident.classification = booking.status::text
              and incident.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
              and incident.status in ('open', 'not_performed_confirmed')
          )
          and not exists (
            select 1 from public.booking_events event
            where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = (booking.version - 1)::text
              and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
              and event.payload ->> 'participantRole' = case when booking.status = 'no_show_patient' then 'patient' else 'therapist' end
              and event.created_at <= booking.starts_at + interval '10 minutes'
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.booking_id = booking.id
              and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
              and participation.participant_role = (case when booking.status = 'no_show_patient' then 'patient' else 'therapist' end)::public.video_session_participant_role
              and participation.event_type = 'session.user_joined'
              and coalesce(participation.joined_at, participation.created_at)
                between booking.starts_at - interval '15 minutes'
                  and booking.starts_at + interval '10 minutes'
          )
        )
        or (
          job.operation = 'confirm_end'
          and session.termination_requested_at is not null
          and (
            session.termination_reason = 'manual_end'
            or (session.termination_reason in ('patient_no_show', 'attendance_no_show')
              and booking.starts_at + interval '10 minutes' < now()
              and session.scheduled_starts_at = booking.starts_at
              and session.scheduled_ends_at = booking.ends_at)
            or (session.termination_reason = 'scheduled_end' and session.scheduled_ends_at <= now())
            or (session.termination_reason = 'hard_timeout' and session.hard_ends_at is not null and session.hard_ends_at <= now())
            or (session.termination_reason = 'provider_ended' and session.scheduled_ends_at <= now())
          )
        )
      )
    order by job.next_run_at, job.created_at
    for update of job, session, booking skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ),
  updated as (
    update public.video_session_control_jobs job
    set status = 'processing',
        attempts = attempts + 1,
        locked_until_at = now() + make_interval(
          secs => greatest(15, least(coalesce(p_lock_seconds, 60), 300))
        ),
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.id, job.video_session_id, job.booking_id, job.operation,
      job.attempts, job.max_attempts
  ),
  fenced as (
    update public.video_sessions session
    set termination_requested_at = case
          when updated.operation = 'confirm_end' then session.termination_requested_at
          else coalesce(session.termination_requested_at, now())
        end,
        termination_reason = case updated.operation
          when 'end_scheduled' then 'scheduled_end'
          when 'end_hard_timeout' then 'hard_timeout'
          when 'end_patient_no_show' then 'patient_no_show'
          when 'end_attendance_no_show' then 'attendance_no_show'
          else session.termination_reason
        end,
        last_maintenance_at = now(),
        updated_at = now()
    from updated
    where session.id = updated.video_session_id
    returning session.id, session.provider_session_id
  )
  select updated.id, updated.video_session_id, updated.booking_id,
    fenced.provider_session_id, updated.operation, updated.attempts,
    updated.max_attempts
  from updated
  join fenced on fenced.id = updated.video_session_id;
$$;

create or replace function public.mark_video_session_termination_requested_v1(
  p_video_session_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason = 'scheduled_end' then
    update public.video_sessions set termination_reason = 'scheduled_end',
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and scheduled_ends_at <= now()
      and termination_confirmed_at is null;
  elsif p_reason = 'hard_timeout' then
    update public.video_sessions set termination_reason = 'hard_timeout',
      termination_requested_at = coalesce(termination_requested_at, now()),
      last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and hard_ends_at is not null
      and hard_ends_at <= now() and termination_confirmed_at is null;
  elsif p_reason = 'patient_no_show' then
    update public.video_sessions session
    set termination_reason = 'patient_no_show',
        termination_requested_at = coalesce(session.termination_requested_at, now()),
        last_maintenance_at = now(), updated_at = now()
    from public.bookings booking
    where session.id = p_video_session_id
      and booking.id = session.booking_id
      and session.status in ('ready', 'active')
      and session.scheduled_starts_at = booking.starts_at
      and session.scheduled_ends_at = booking.ends_at
      and booking.status = 'confirmed'::public.booking_status
      and booking.starts_at + interval '10 minutes' < now()
      and session.termination_confirmed_at is null
      and not exists (
        select 1 from public.booking_events event
        where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1 from public.video_session_participations participation
        where participation.video_session_id = session.id
              and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and participation.participant_role = 'patient'::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      );
  elsif p_reason = 'attendance_no_show' then
    update public.video_sessions session
    set termination_reason = 'attendance_no_show',
        termination_requested_at = coalesce(session.termination_requested_at, now()),
        last_maintenance_at = now(), updated_at = now()
    from public.bookings booking
    where session.id = p_video_session_id
      and booking.id = session.booking_id
      and session.status in ('ready', 'active')
      and session.scheduled_starts_at = booking.starts_at
      and session.scheduled_ends_at = booking.ends_at
      and booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
      and booking.starts_at + interval '10 minutes' < now()
      and session.termination_confirmed_at is null
      and exists (
        select 1 from public.session_confirmation_incidents incident
        where incident.booking_id = booking.id
          and incident.booking_version = booking.version - 1
          and incident.classification = booking.status::text
          and incident.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and incident.status in ('open', 'not_performed_confirmed')
      )
      and not exists (
        select 1 from public.booking_events event
        where event.booking_id = booking.id
              and event.payload ->> 'sessionAttemptId' = public.current_session_attempt_id_v1(booking.id)::text
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = (booking.version - 1)::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and event.payload ->> 'participantRole' = case when booking.status = 'no_show_patient' then 'patient' else 'therapist' end
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1 from public.video_session_participations participation
        where participation.booking_id = booking.id
              and participation.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
          and participation.participant_role = (case when booking.status = 'no_show_patient' then 'patient' else 'therapist' end)::public.video_session_participant_role
          and participation.event_type = 'session.user_joined'
          and coalesce(participation.joined_at, participation.created_at)
            between booking.starts_at - interval '15 minutes'
              and booking.starts_at + interval '10 minutes'
      );
  elsif p_reason = 'manual_end' then
    update public.video_sessions set last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id and termination_reason = 'manual_end'
      and termination_requested_at is not null and termination_confirmed_at is null;
  elsif p_reason = 'provider_ended' then
    update public.video_sessions
    set termination_reason = case when hard_ends_at is not null and hard_ends_at <= now()
          then 'hard_timeout' else 'scheduled_end' end,
        termination_requested_at = coalesce(termination_requested_at, now()),
        last_maintenance_at = now(), updated_at = now()
    where id = p_video_session_id
      and (scheduled_ends_at <= now() or (hard_ends_at is not null and hard_ends_at <= now()))
      and termination_confirmed_at is null;
  end if;
end;
$$;

create or replace function public.mark_video_session_termination_confirmed_v1(
  p_video_session_id uuid,
  p_reason text default 'provider_ended'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if p_reason not in ('scheduled_end', 'hard_timeout', 'manual_end', 'provider_ended', 'patient_no_show', 'attendance_no_show') then
    return;
  end if;

  select case
      when termination_reason = 'manual_end' and termination_requested_at is not null then 'manual_end'
      when termination_reason = 'patient_no_show' and termination_requested_at is not null then 'patient_no_show'
      when termination_reason = 'attendance_no_show' and termination_requested_at is not null then 'attendance_no_show'
      when hard_ends_at is not null and hard_ends_at <= now() then 'hard_timeout'
      when scheduled_ends_at <= now() then 'scheduled_end'
      else null
    end
  into v_reason
  from public.video_sessions
  where id = p_video_session_id and status <> 'canceled'
    and termination_confirmed_at is null
  for update;

  if v_reason is null then return; end if;

  update public.video_sessions
  set status = 'ended', actual_ended_at = coalesce(actual_ended_at, now()),
      therapist_present = false, participant_count = 0,
      termination_reason = v_reason,
      termination_requested_at = coalesce(termination_requested_at, now()),
      termination_confirmed_at = coalesce(termination_confirmed_at, now()),
      last_maintenance_at = now(), last_synced_at = now(), updated_at = now()
  where id = p_video_session_id and status <> 'canceled'
    and termination_confirmed_at is null;
end;
$$;


create or replace function public.get_session_feedback_v2(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.get_session_quality_feedback_v1(p_booking_id);
$$;
-- Bilateral confirmation no longer invokes service-confirmation/financial gates.
create or replace function public.finalize_bilateral_session_confirmation_v1(p_booking_id uuid,p_now timestamptz default now())
returns text language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.session_participant_confirmations where session_attempt_id=public.current_session_attempt_id_v1(p_booking_id) and participant_role='patient' and outcome='completed')
    and exists (select 1 from public.session_participant_confirmations where session_attempt_id=public.current_session_attempt_id_v1(p_booking_id) and participant_role='therapist' and outcome='completed')
  then return 'confirmed'; end if;
  return 'pending';
end;
$$;

commit;
