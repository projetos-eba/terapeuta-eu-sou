begin;

create or replace function public.reject_session_feedback_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'SESSION_FEEDBACK_IMMUTABLE' using errcode = '55000';
end;
$$;

drop trigger if exists reject_session_feedback_update_delete
  on public.session_feedback;
create trigger reject_session_feedback_update_delete
before update or delete on public.session_feedback
for each row execute function public.reject_session_feedback_mutation_v1();

create or replace function public.session_confirmation_payload_v2(
  p_confirmation public.session_participant_confirmations
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_confirmation.id is null then null else jsonb_build_object(
    'confirmedAt', p_confirmation.confirmed_at,
    'createdAt', p_confirmation.created_at,
    'dueAt', p_confirmation.due_at,
    'outcome', p_confirmation.outcome,
    'policyVersionId', p_confirmation.policy_version_id,
    'source', p_confirmation.source
  ) end;
$$;

create or replace function public.next_weekly_payout_cutoff_v1(
  p_eligible_at timestamptz,
  p_now timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_weekday integer;
  v_time time;
  v_timezone text;
  v_reference timestamptz;
  v_local_date date;
  v_days_ahead integer;
  v_candidate timestamptz;
begin
  if p_eligible_at is null then return null; end if;

  select policy.weekly_batch_weekday, policy.weekly_batch_time, policy.timezone
  into v_weekday, v_time, v_timezone
  from public.financial_policy_versions policy
  where policy.is_active
  order by policy.effective_from desc
  limit 1;

  v_weekday := coalesce(v_weekday, 2);
  v_time := coalesce(v_time, time '10:00');
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_reference := greatest(p_eligible_at, p_now);
  v_local_date := (v_reference at time zone v_timezone)::date;
  v_days_ahead := (v_weekday - extract(dow from v_local_date)::integer + 7) % 7;
  v_candidate := (v_local_date + v_days_ahead + v_time) at time zone v_timezone;

  if v_candidate < v_reference then
    v_candidate := v_candidate + interval '7 days';
  end if;
  return v_candidate;
end;
$$;

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
  where incident.booking_id = p_booking_id;

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

create or replace function public.get_patient_session_feedback_queue_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_patient_profile_id uuid;
begin
  if v_actor_id is null then
    raise exception 'FEEDBACK_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select patient.id into v_patient_profile_id
  from public.patient_profiles patient
  where patient.user_id = v_actor_id;
  if v_patient_profile_id is null then
    raise exception 'FEEDBACK_PATIENT_REQUIRED' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'bookingId', booking.id,
      'startsAt', booking.starts_at,
      'endsAt', booking.ends_at,
      'timezone', booking.timezone,
      'serviceLabel', service.title,
      'therapyLabel', therapy.name,
      'therapist', jsonb_build_object(
        'id', therapist.id,
        'name', therapist.public_name,
        'avatarUrl', therapist.photo_url
      ),
      'actorConfirmation', public.session_confirmation_payload_v2(patient_confirmation),
      'counterpartConfirmation', public.session_confirmation_payload_v2(therapist_confirmation),
      'confirmationState', case
        when incident.status = 'open' or payment.internal_contested_at is not null
          or payment.admin_blocked_at is not null then 'blocked_for_review'
        when payment.transfer_status = 'transferred' then 'completed'
        when payment.service_confirmed_at is not null and payment.eligible_at > now() then 'safety_period'
        when payment.service_confirmed_at is not null then 'next_batch'
        when patient_confirmation.id is null and therapist_confirmation.id is null then 'awaiting_both'
        when patient_confirmation.id is null then 'awaiting_patient'
        when therapist_confirmation.id is null then 'awaiting_therapist'
        else 'blocked_for_review'
      end,
      'eligibleAt', payment.eligible_at,
      'nextBatchAt', public.next_weekly_payout_cutoff_v1(payment.eligible_at, now()),
      'serviceConfirmedAt', payment.service_confirmed_at
    ) order by booking.ends_at desc)
    from public.bookings booking
    join public.session_payments payment on payment.booking_id = booking.id
    join public.therapist_profiles therapist on therapist.id = booking.therapist_profile_id
    join public.therapist_services service on service.id = booking.service_id
    join public.therapies therapy on therapy.id = service.therapy_id
    left join public.session_participant_confirmations patient_confirmation
      on patient_confirmation.booking_id = booking.id
      and patient_confirmation.participant_role = 'patient'::public.user_role
    left join public.session_participant_confirmations therapist_confirmation
      on therapist_confirmation.booking_id = booking.id
      and therapist_confirmation.participant_role = 'therapist'::public.user_role
    left join public.session_confirmation_incidents incident
      on incident.booking_id = booking.id and incident.status = 'open'
    where booking.patient_profile_id = v_patient_profile_id
      and booking.ends_at <= now()
      and booking.status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
      and payment.financial_status in ('paid', 'partially_refunded')
      and not exists (
        select 1 from public.session_feedback feedback
        where feedback.booking_id = booking.id
          and feedback.author_role = 'patient'::public.user_role
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_session_feedback_v2(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_incident jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'admin'::public.user_role
  ) then
    raise exception 'FEEDBACK_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_payload := public.admin_get_session_feedback_v1(p_booking_id);
  select jsonb_build_object(
    'createdAt', incident.created_at,
    'reportedByRole', incident.reported_by_role,
    'resolutionReason', incident.resolution_reason,
    'resolvedAt', incident.resolved_at,
    'status', incident.status
  ) into v_incident
  from public.session_confirmation_incidents incident
  where incident.booking_id = p_booking_id;

  return v_payload || jsonb_build_object('incident', v_incident);
end;
$$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'tes-session-confirmation-hourly-v1'
  ) then
    perform cron.schedule(
      'tes-session-confirmation-hourly-v1',
      '7 * * * *',
      $cron$select public.auto_confirm_sessions();$cron$
    );
  end if;

  -- Activation is an explicit post-homologation release step.
  perform cron.alter_job(
    (select jobid from cron.job where jobname = 'tes-session-confirmation-hourly-v1'),
    active => false
  );
end $$;

revoke all on function public.reject_session_feedback_mutation_v1()
  from public, anon, authenticated;
revoke all on function public.session_confirmation_payload_v2(public.session_participant_confirmations)
  from public, anon, authenticated;
revoke all on function public.next_weekly_payout_cutoff_v1(timestamptz, timestamptz)
  from public, anon;
revoke all on function public.get_session_feedback_v2(uuid)
  from public, anon;
revoke all on function public.get_patient_session_feedback_queue_v1()
  from public, anon;
revoke all on function public.admin_get_session_feedback_v2(uuid)
  from public, anon;

grant execute on function public.session_confirmation_payload_v2(public.session_participant_confirmations)
  to service_role;
grant execute on function public.next_weekly_payout_cutoff_v1(timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.get_session_feedback_v2(uuid)
  to authenticated, service_role;
grant execute on function public.get_patient_session_feedback_queue_v1()
  to authenticated, service_role;
grant execute on function public.admin_get_session_feedback_v2(uuid)
  to authenticated, service_role;

comment on table public.session_feedback is
  'Immutable private post-session feedback, one row per booking participant. Corrections require a separate support record.';
comment on function public.get_session_feedback_v2(uuid) is
  'Participant-scoped private feedback plus bilateral confirmation, role deadlines, safety period and next-batch state.';
comment on function public.get_patient_session_feedback_queue_v1() is
  'All ended paid patient encounters that still lack the patient private feedback response.';

commit;
