-- Forward-only recovery: HML previously recorded version 20260918220000 with
-- the metrics privacy repair contents. Reapply this contract under a unique
-- version and repair notifications already persisted with the obsolete copy.
begin;

-- Keep attendance evidence auditable while making notifications neutral for
-- both participants. The finalizer's attendance and financial logic is unchanged.
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
  v_evidence jsonb;
  v_attempt uuid;
  v_class text;
  v_incident uuid;
  v_session uuid;
  v_count integer := 0;
begin
  if p_now is null or p_limit not between 1 and 200 then
    raise exception 'SESSION_ATTENDANCE_FINALIZER_INVALID' using errcode = '22023';
  end if;

  for v_row in
    select booking.*, payment.id as payment_id, payment.policy_version_id,
      patient.user_id as patient_user_id, therapist.user_id as therapist_user_id
    from public.bookings booking
    join public.session_payments payment on payment.booking_id = booking.id
    join public.patient_profiles patient on patient.id = booking.patient_profile_id
    join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
    where booking.status = 'confirmed'
      and booking.meeting_provider in ('zoom', 'zoom_video_sdk')
      and booking.starts_at + interval '10 minutes' < p_now
      and public.session_attempt_evidence_v1(booking.id, p_now) ->> 'classification' is not null
      and not exists (
        select 1
        from public.session_confirmation_incidents incident
        where incident.session_attempt_id = public.current_session_attempt_id_v1(booking.id)
      )
      and not exists (
        select 1
        from public.booking_reschedule_requests request
        where request.booking_id = booking.id
          and request.status in ('pending', 'pending_admin_review')
          and request.change_kind in ('therapist_reschedule', 'therapist_cancellation')
      )
    order by booking.starts_at, booking.id
    limit p_limit
    for update of booking skip locked
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended(v_row.id::text, 0)
    ) then
      continue;
    end if;

    v_evidence := public.session_attempt_evidence_v1(v_row.id, p_now);
    v_attempt := (v_evidence ->> 'sessionAttemptId')::uuid;
    v_class := v_evidence ->> 'classification';
    if v_class not in ('no_show_patient', 'no_show_therapist', 'no_show_both', 'requires_review') then
      continue;
    end if;

    insert into public.session_confirmation_incidents (
      booking_id, booking_version, session_payment_id, session_attempt_id,
      classification, classification_source, patient_arrived_at, therapist_arrived_at,
      patient_joined_at, therapist_joined_at, review_due_at, policy_version_id,
      responsibility, financial_resolution, retention_authorized,
      processing_cost_recovery_authorized, evidence
    ) values (
      v_row.id, v_row.version, v_row.payment_id, v_attempt, v_class,
      'combined_attendance_evidence',
      (v_evidence ->> 'patientArrivedAt')::timestamptz,
      (v_evidence ->> 'therapistArrivedAt')::timestamptz,
      (v_evidence ->> 'patientJoinedAt')::timestamptz,
      (v_evidence ->> 'therapistJoinedAt')::timestamptz,
      p_now + interval '5 days', v_row.policy_version_id, 'unassigned', 'pending',
      false, false, v_evidence || jsonb_build_object('classifiedAt', p_now)
    ) on conflict (booking_id, booking_version) do nothing
    returning id into v_incident;

    if v_incident is null then
      continue;
    end if;

    perform pg_catalog.set_config('tes.booking_actor_profile_id', '', true);
    perform pg_catalog.set_config('tes.booking_reason', 'attendance_finalized', true);
    perform pg_catalog.set_config('tes.booking_request_id', 'attendance:' || v_attempt::text, true);
    perform pg_catalog.set_config('tes.booking_source', 'attendance-finalizer', true);

    if v_class <> 'requires_review' then
      update public.bookings
      set status = v_class::public.booking_status, updated_at = p_now
      where id = v_row.id;

      select session.id into v_session
      from public.video_sessions session
      where session.booking_id = v_row.id
        and session.scheduled_starts_at = v_row.starts_at
        and session.scheduled_ends_at = v_row.ends_at
        and session.status in ('ready', 'active')
        and session.termination_confirmed_at is null
      order by session.created_at desc
      limit 1;

      if v_session is not null then
        perform public.enqueue_video_session_control_job_v1(
          v_session,
          'end_attendance_no_show',
          'attendance-no-show:' || v_row.id::text || ':v' || v_row.version::text,
          p_now,
          jsonb_build_object(
            'bookingVersion', v_row.version,
            'sessionAttemptId', v_attempt,
            'scheduledStartsAt', v_row.starts_at::text,
            'source', 'attendance-finalizer'
          )
        );
      end if;
    end if;

    insert into public.notifications (profile_id, kind, title, body, href, event_key)
    values
      (
        v_row.patient_user_id,
        'session_attendance_review_patient',
        'Sessão não realizada',
        'Sessão não realizada. Se precisar de ajuda, fale com o suporte.',
        '/app/encontros/' || v_row.id::text,
        'attendance-review:' || v_incident::text || ':patient'
      ),
      (
        v_row.therapist_user_id,
        'session_attendance_review_therapist',
        'Sessão não realizada',
        'Sessão não realizada. Se precisar de ajuda, fale com o suporte.',
        '/terapeuta/sessoes/' || v_row.id::text,
        'attendance-review:' || v_incident::text || ':therapist'
      )
    on conflict (profile_id, event_key) where event_key is not null do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.finalize_due_session_attendance_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_due_session_attendance_v1(timestamptz, integer)
  to service_role;

update public.notifications
set title = 'Sessão não realizada',
    body = 'Sessão não realizada. Se precisar de ajuda, fale com o suporte.'
where kind in ('session_attendance_review_patient', 'session_attendance_review_therapist')
  and (title is distinct from 'Sessão não realizada'
    or body is distinct from 'Sessão não realizada. Se precisar de ajuda, fale com o suporte.');

commit;
