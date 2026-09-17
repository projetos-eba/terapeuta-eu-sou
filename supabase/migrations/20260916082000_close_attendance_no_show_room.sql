-- A new, version-fenced operation closes an absent therapist's exact Zoom room.
alter type public.video_session_control_operation add value if not exists 'end_attendance_no_show';
commit;
begin;
alter table public.video_sessions
  drop constraint if exists video_sessions_termination_reason_check,
  add constraint video_sessions_termination_reason_check check (
    termination_reason is null or termination_reason in (
      'host_left', 'scheduled_end', 'hard_timeout', 'therapist_absent',
      'provider_ended', 'manual_end', 'reconcile_orphan',
      'patient_no_show', 'attendance_no_show'
    )
  );

create or replace function public.finalize_due_session_attendance_v1(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_patient_arrived_at timestamptz;
  v_therapist_arrived_at timestamptz;
  v_patient_joined_at timestamptz;
  v_therapist_joined_at timestamptz;
  v_patient_present boolean;
  v_therapist_present boolean;
  v_classification text;
  v_target_status public.booking_status;
  v_incident_id uuid;
  v_video_session_id uuid;
  v_count integer := 0;
begin
  if p_now is null or p_limit not between 1 and 200 then
    raise exception 'SESSION_ATTENDANCE_FINALIZER_INVALID' using errcode = '22023';
  end if;

  for v_row in
    select booking.*, payment.id as payment_id,
      payment.policy_version_id, payment.payment_flow_version,
      policy.policy_key, policy.manual_review_response_days,
      policy.metadata as policy_metadata,
      patient.user_id as patient_user_id, therapist.user_id as therapist_user_id
    from public.bookings as booking
    join public.session_payments as payment on payment.booking_id = booking.id
    join public.financial_policy_versions as policy on policy.id = payment.policy_version_id
    join public.patient_profiles as patient on patient.id = booking.patient_profile_id
    join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
    cross join lateral (
      select
        min(event.created_at) filter (
          where coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
        ) as patient_arrived_at,
        min(event.created_at) filter (
          where event.payload ->> 'participantRole' = 'therapist'
        ) as therapist_arrived_at
      from public.booking_events as event
      where event.booking_id = booking.id
        and event.event_type = 'zoom_waiting_room_entered'
        and event.payload ->> 'bookingVersion' = booking.version::text
        and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
        and event.created_at <= booking.starts_at + interval '10 minutes'
    ) as timely_arrival
    cross join lateral (
      select
        min(coalesce(participation.joined_at, participation.created_at)) filter (
          where participation.participant_role = 'patient'::public.video_session_participant_role
        ) as patient_joined_at,
        min(coalesce(participation.joined_at, participation.created_at)) filter (
          where participation.participant_role = 'therapist'::public.video_session_participant_role
        ) as therapist_joined_at
      from public.video_session_participations as participation
      where participation.booking_id = booking.id
        and participation.event_type = 'session.user_joined'
        and coalesce(participation.joined_at, participation.created_at)
          between booking.starts_at - interval '15 minutes' and booking.ends_at
    ) as trusted_join
    where booking.status = 'confirmed'::public.booking_status
      and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
      and payment.financial_status = 'paid'::public.session_financial_status
      and booking.starts_at + interval '10 minutes' < p_now
      and booking.starts_at > p_now - interval '45 days'
      and not exists (
        select 1 from public.booking_reschedule_requests as request
        where request.booking_id = booking.id
          and request.status in ('pending', 'pending_admin_review')
          and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
      )
      and not exists (
        select 1 from public.session_confirmation_incidents as incident
        where incident.booking_id = booking.id
          and incident.booking_version = booking.version
          and incident.classification in ('no_show_therapist', 'no_show_both', 'requires_review')
      )
      -- Classify the evidence before LIMIT: normal old sessions must not starve
      -- absences or incomplete encounters farther down the chronological queue.
      and (
        (timely_arrival.patient_arrived_at is null
          and coalesce(trusted_join.patient_joined_at <= booking.starts_at + interval '10 minutes', false) = false)
        or (timely_arrival.therapist_arrived_at is null
          and coalesce(trusted_join.therapist_joined_at <= booking.starts_at + interval '10 minutes', false) = false)
        or (booking.ends_at <= p_now
          and (trusted_join.patient_joined_at is null or trusted_join.therapist_joined_at is null))
      )
      -- A provider-closure job owns a patient no-show until it completes.
      -- Failed/dead-letter jobs require operational intervention, not repeated
      -- selection of the same booking ahead of unrelated attendance cases.
      and not (
        (timely_arrival.patient_arrived_at is null
          and coalesce(trusted_join.patient_joined_at <= booking.starts_at + interval '10 minutes', false) = false)
        and (timely_arrival.therapist_arrived_at is not null
          or coalesce(trusted_join.therapist_joined_at <= booking.starts_at + interval '10 minutes', false))
        and exists (
          select 1 from public.video_session_control_jobs as job
          where job.booking_id = booking.id
            and job.operation = 'end_patient_no_show'
            and job.status in ('queued', 'processing', 'retry', 'dead_letter')
            and job.metadata ->> 'bookingVersion' = booking.version::text
        )
      )
    order by booking.starts_at, booking.id
    for update of booking, payment skip locked
    limit p_limit
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_row.id::text, 0)
    );

    -- The candidate page can precede a concurrent reschedule or classifier.
    -- Revalidate and lock the booking before any incident/payment side effect.
    perform 1 from public.bookings booking
    where booking.id = v_row.id and booking.version = v_row.version
      and booking.status = 'confirmed'
      and booking.starts_at = v_row.starts_at and booking.ends_at = v_row.ends_at
    for update;
    if not found then continue; end if;

    select min(event.created_at) filter (
        where coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'),
      min(event.created_at) filter (
        where event.payload ->> 'participantRole' = 'therapist')
    into v_patient_arrived_at, v_therapist_arrived_at
    from public.booking_events as event
    where event.booking_id = v_row.id
      and event.event_type = 'zoom_waiting_room_entered'
      and event.payload ->> 'bookingVersion' = v_row.version::text
      and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_row.starts_at
      and event.created_at <= v_row.starts_at + interval '10 minutes';

    select min(coalesce(participation.joined_at, participation.created_at)) filter (
        where participation.participant_role = 'patient'::public.video_session_participant_role),
      min(coalesce(participation.joined_at, participation.created_at)) filter (
        where participation.participant_role = 'therapist'::public.video_session_participant_role)
    into v_patient_joined_at, v_therapist_joined_at
    from public.video_session_participations as participation
    where participation.booking_id = v_row.id
      and participation.event_type = 'session.user_joined'
      and coalesce(participation.joined_at, participation.created_at)
        between v_row.starts_at - interval '15 minutes' and v_row.ends_at;

    v_patient_present := v_patient_arrived_at is not null
      or coalesce(v_patient_joined_at <= v_row.starts_at + interval '10 minutes', false);
    v_therapist_present := v_therapist_arrived_at is not null
      or coalesce(v_therapist_joined_at <= v_row.starts_at + interval '10 minutes', false);
    v_classification := null;
    v_target_status := null;

    if v_therapist_present and not v_patient_present then
      v_classification := 'no_show_patient';
      v_target_status := 'no_show_patient'::public.booking_status;
    elsif v_patient_present and not v_therapist_present then
      v_classification := 'no_show_therapist';
      v_target_status := 'no_show_therapist'::public.booking_status;
    elsif not v_patient_present and not v_therapist_present then
      v_classification := 'no_show_both';
      v_target_status := 'no_show_both'::public.booking_status;
    elsif p_now >= v_row.ends_at
      and (v_patient_joined_at is null or v_therapist_joined_at is null)
    then
      v_classification := 'requires_review';
    else
      continue;
    end if;

    -- Preserve the existing provider shutdown fence for an exclusive patient
    -- no-show. The booking remains confirmed only while the room-close job is
    -- still pending, then this same finalizer completes the business state on
    -- the second pass of the maintenance command.
    if v_classification = 'no_show_patient' and exists (
      select 1
      from public.video_sessions as video_session
      where video_session.booking_id = v_row.id
        and video_session.status not in ('ended', 'canceled')
        and video_session.termination_confirmed_at is null
    ) then
      perform public.enqueue_video_session_control_job_v1(
        (
          select video_session.id
          from public.video_sessions as video_session
          where video_session.booking_id = v_row.id
          order by video_session.created_at desc
          limit 1
        ),
        'end_patient_no_show',
        'patient-no-show:' || v_row.id::text || ':v' || v_row.version::text ||
          ':' || floor(extract(epoch from v_row.starts_at) * 1000)::bigint::text,
        p_now,
        jsonb_build_object(
          'bookingVersion', v_row.version,
          'scheduledStartsAt', v_row.starts_at::text,
          'source', 'attendance-finalizer'
        )
      );
      continue;
    end if;

    if v_classification <> 'no_show_patient' then
      insert into public.session_confirmation_incidents (
        booking_id, booking_version, session_payment_id, classification,
        classification_source, patient_arrived_at, therapist_arrived_at,
        patient_joined_at, therapist_joined_at, review_due_at,
        policy_version_id, responsibility, financial_resolution,
        retention_authorized, processing_cost_recovery_authorized, evidence
      ) values (
        v_row.id, v_row.version, v_row.payment_id, v_classification,
        case
          when (v_patient_arrived_at is not null or v_therapist_arrived_at is not null)
            and (v_patient_joined_at is not null or v_therapist_joined_at is not null)
            then 'combined_attendance_evidence'
          when v_patient_arrived_at is not null or v_therapist_arrived_at is not null
            then 'authenticated_waiting_room'
          when v_patient_joined_at is not null or v_therapist_joined_at is not null
            then 'trusted_zoom_join'
          else 'system_tolerance_window'
        end,
        v_patient_arrived_at, v_therapist_arrived_at,
        v_patient_joined_at, v_therapist_joined_at,
        p_now + make_interval(days => v_row.manual_review_response_days),
        v_row.policy_version_id, 'unassigned', 'pending',
        v_row.policy_key = 'tes-payments-v11-attendance-accountability'
          and coalesce((v_row.policy_metadata ->> 'doubleNoShowRetention')::boolean, false)
          and v_row.policy_metadata ->> 'doubleNoShowRetentionOperationalActivation' = 'approved'
          and v_row.policy_metadata ->> 'legalActivation' = 'approved',
        v_row.policy_key = 'tes-payments-v11-attendance-accountability'
          and coalesce((v_row.policy_metadata ->> 'attendanceProcessingCostRecovery')::boolean, false)
          and v_row.policy_metadata ->> 'legalActivation' = 'approved',
        jsonb_build_object(
          'patientPresentAtTolerance', v_patient_present,
          'therapistPresentAtTolerance', v_therapist_present,
          'bothJoinedByEnd', v_patient_joined_at is not null and v_therapist_joined_at is not null,
          'classifiedAt', p_now
        )
      )
      on conflict (booking_id, booking_version) do update
      set classification = excluded.classification,
          classification_source = excluded.classification_source,
          patient_arrived_at = excluded.patient_arrived_at,
          therapist_arrived_at = excluded.therapist_arrived_at,
          patient_joined_at = excluded.patient_joined_at,
          therapist_joined_at = excluded.therapist_joined_at,
          evidence = excluded.evidence,
          updated_at = now()
      returning id into v_incident_id;

      update public.session_payments
      set admin_blocked_at = coalesce(admin_blocked_at, p_now),
          internal_contested_at = coalesce(internal_contested_at, p_now),
          transfer_status = case
            when transfer_status in ('batched', 'transfer_pending', 'transferred', 'reversed')
              then transfer_status
            else 'blocked'::public.session_transfer_status
          end,
          transfer_blocked_reason = 'attendance_review',
          eligible_at = null,
          service_status = 'not_performed'::public.session_service_status,
          updated_at = p_now
      where id = v_row.payment_id;

      insert into public.notifications (profile_id, kind, title, body, href, event_key)
      values
        (v_row.patient_user_id, 'session_attendance_review_patient',
          case v_classification
            when 'no_show_therapist' then 'Encontro não realizado'
            when 'no_show_both' then 'Encontro não realizado'
            else 'Acesso do encontro em análise'
          end,
          'O registro do encontro está em análise pelo TES. Nenhuma decisão financeira será tomada sem revisão.',
          '/app/encontros/' || v_row.id::text,
          'attendance-review:' || v_incident_id::text || ':patient'),
        (v_row.therapist_user_id, 'session_attendance_review_therapist',
          case v_classification
            when 'no_show_therapist' then 'Sessão não realizada'
            when 'no_show_both' then 'Sessão não realizada'
            else 'Acesso da sessão em análise'
          end,
          'O registro da sessão está em análise pelo TES. Envie sua manifestação pelo Suporte, se necessário.',
          '/terapeuta/sessoes/' || v_row.id::text,
          'attendance-review:' || v_incident_id::text || ':therapist')
      on conflict (profile_id, event_key) where event_key is not null do nothing;
    end if;

    perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
    perform pg_catalog.set_config('tes.booking_reason', 'attendance_finalized', true);
    perform pg_catalog.set_config(
      'tes.booking_request_id',
      left('attendance:' || v_row.id::text || ':v' || v_row.version::text || ':' || v_classification, 200),
      true
    );
    perform pg_catalog.set_config('tes.booking_source', 'attendance-finalizer', true);

    if v_target_status is not null then
      update public.bookings
      set status = v_target_status, updated_at = p_now
      where id = v_row.id and version = v_row.version and status = 'confirmed';
      if not found then continue; end if;
    else
      insert into public.booking_events (
        booking_id, event_type, request_id, source, payload
      ) values (
        v_row.id, 'session_attendance_requires_review',
        left('attendance:' || v_row.id::text || ':v' || v_row.version::text || ':requires_review', 200),
        'attendance-finalizer',
        jsonb_build_object('bookingVersion', v_row.version, 'classifiedAt', p_now)
      )
      on conflict (booking_id, event_type, request_id)
        where request_id is not null do nothing;
    end if;

    -- Classification and payment fence are committed before a provider-close
    -- worker can reserve this versioned job. Access is denied immediately by
    -- the booking state even if the provider closure needs retry.
    if v_classification in ('no_show_therapist', 'no_show_both') then
      select video_session.id into v_video_session_id
      from public.video_sessions as video_session
      where video_session.booking_id = v_row.id
        and video_session.status in ('ready', 'active')
        and video_session.termination_confirmed_at is null
      order by video_session.created_at desc
      limit 1;
      if v_video_session_id is not null then
        perform public.enqueue_video_session_control_job_v1(
          v_video_session_id,
          'end_attendance_no_show',
          'attendance-no-show:' || v_row.id::text || ':v' || v_row.version::text,
          p_now,
          jsonb_build_object(
            'bookingVersion', v_row.version,
            'scheduledStartsAt', v_row.starts_at::text,
            'source', 'attendance-finalizer'
          )
        );
      end if;
    end if;

    if v_classification = 'no_show_patient' then
      insert into public.session_service_confirmations (
        booking_id, session_payment_id, source, previous_service_status,
        policy_version_id, confirmed_at, metadata
      )
      select
        v_row.id, payment.id,
        'attendance_evidence'::public.session_confirmation_source,
        payment.service_status, payment.policy_version_id, p_now,
        jsonb_build_object(
          'classification', v_classification,
          'patientPresentAtTolerance', false,
          'therapistPresentAtTolerance', true,
          'bookingVersion', v_row.version
        )
      from public.session_payments as payment
      where payment.id = v_row.payment_id
      on conflict (booking_id, source) do update
      set metadata = public.session_service_confirmations.metadata || excluded.metadata;

      update public.session_payments
      set service_status = 'confirmed_by_therapist'::public.session_service_status,
          service_confirmed_at = coalesce(service_confirmed_at, p_now),
          service_confirmation_source =
            'attendance_evidence'::public.session_confirmation_source,
          transfer_blocked_reason = null,
          updated_at = p_now
      where id = v_row.payment_id;

      perform public.refresh_session_transfer_eligibility(v_row.payment_id, p_now);
    end if;

    v_count := v_count + 1;
  end loop;
  return v_count;
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
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = booking.version::text
              and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
              and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
              and event.created_at <= booking.starts_at + interval '10 minutes'
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.video_session_id = session.id
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
          and booking.status in ('no_show_therapist', 'no_show_both')
          and booking.starts_at + interval '10 minutes' < now()
          and job.metadata ->> 'bookingVersion' = (booking.version - 1)::text
          and (job.metadata ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and exists (
            select 1 from public.session_confirmation_incidents incident
            where incident.booking_id = booking.id
              and incident.booking_version = booking.version - 1
              and incident.classification = booking.status::text
              and incident.status = 'open'
          )
          and not exists (
            select 1 from public.booking_events event
            where event.booking_id = booking.id
              and event.event_type = 'zoom_waiting_room_entered'
              and event.payload ->> 'bookingVersion' = (booking.version - 1)::text
              and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
              and event.payload ->> 'participantRole' = 'therapist'
              and event.created_at <= booking.starts_at + interval '10 minutes'
          )
          and not exists (
            select 1 from public.video_session_participations participation
            where participation.booking_id = booking.id
              and participation.participant_role = 'therapist'::public.video_session_participant_role
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
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = booking.version::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1 from public.video_session_participations participation
        where participation.video_session_id = session.id
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
      and booking.status in ('no_show_therapist', 'no_show_both')
      and booking.starts_at + interval '10 minutes' < now()
      and session.termination_confirmed_at is null
      and exists (
        select 1 from public.session_confirmation_incidents incident
        where incident.booking_id = booking.id
          and incident.booking_version = booking.version - 1
          and incident.classification = booking.status::text
          and incident.status = 'open'
      )
      and not exists (
        select 1 from public.booking_events event
        where event.booking_id = booking.id
          and event.event_type = 'zoom_waiting_room_entered'
          and event.payload ->> 'bookingVersion' = (booking.version - 1)::text
          and (event.payload ->> 'scheduledStartsAt')::timestamptz = booking.starts_at
          and event.payload ->> 'participantRole' = 'therapist'
          and event.created_at <= booking.starts_at + interval '10 minutes'
      )
      and not exists (
        select 1 from public.video_session_participations participation
        where participation.booking_id = booking.id
          and participation.participant_role = 'therapist'::public.video_session_participant_role
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

revoke all on function public.reserve_video_session_control_jobs_v1(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_video_session_control_jobs_v1(text, integer, integer) to service_role;
commit;
