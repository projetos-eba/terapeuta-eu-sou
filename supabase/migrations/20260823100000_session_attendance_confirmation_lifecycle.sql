begin;

create table if not exists public.session_participant_confirmations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  participant_role public.user_role not null,
  outcome text not null,
  source text not null,
  confirmed_by_profile_id uuid references public.profiles (id) on delete set null,
  request_id uuid not null,
  payload_hash text not null,
  due_at timestamptz not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_participant_confirmations_role_check check (
    participant_role in ('patient'::public.user_role, 'therapist'::public.user_role)
  ),
  constraint session_participant_confirmations_outcome_check check (
    outcome in ('completed', 'not_performed')
  ),
  constraint session_participant_confirmations_source_check check (
    source in ('manual', 'automatic')
  ),
  constraint session_participant_confirmations_request_key unique (request_id),
  constraint session_participant_confirmations_participant_key unique (
    booking_id,
    participant_role
  )
);

create index if not exists session_participant_confirmations_due_idx
  on public.session_participant_confirmations (outcome, due_at);

create index if not exists session_participant_confirmations_booking_idx
  on public.session_participant_confirmations (booking_id, participant_role);

drop trigger if exists set_session_participant_confirmations_updated_at
  on public.session_participant_confirmations;
create trigger set_session_participant_confirmations_updated_at
before update on public.session_participant_confirmations
for each row execute function public.set_updated_at();

alter table public.session_participant_confirmations enable row level security;
revoke all on public.session_participant_confirmations from anon, authenticated;
grant all on public.session_participant_confirmations to service_role;

update public.financial_policy_versions
set is_active = false
where is_active;

insert into public.financial_policy_versions (
  version,
  is_active,
  currency,
  platform_commission_bps,
  auto_confirmation_days,
  transfer_safety_period_days,
  free_cancellation_hours,
  late_cancellation_retention_bps,
  no_show_retention_bps,
  refund_processing_business_days,
  manual_review_response_days,
  weekly_batch_weekday,
  weekly_batch_time,
  timezone,
  payout_batch_rule,
  cancellation_policy_key,
  refund_policy_key,
  proration_policy_key,
  upgrade_proration_behavior,
  downgrade_behavior,
  subscription_cancellation_behavior,
  metadata,
  effective_from
)
select
  'tes-payments-v2-session-attendance',
  true,
  policy.currency,
  policy.platform_commission_bps,
  7,
  1,
  policy.free_cancellation_hours,
  policy.late_cancellation_retention_bps,
  policy.no_show_retention_bps,
  policy.refund_processing_business_days,
  policy.manual_review_response_days,
  policy.weekly_batch_weekday,
  policy.weekly_batch_time,
  policy.timezone,
  policy.payout_batch_rule,
  policy.cancellation_policy_key,
  policy.refund_policy_key,
  policy.proration_policy_key,
  policy.upgrade_proration_behavior,
  policy.downgrade_behavior,
  policy.subscription_cancellation_behavior,
  policy.metadata || jsonb_build_object(
    'sessionConfirmation', 'bilateral_zoom_attendance',
    'sessionAutoConfirmationDays', 7,
    'transferSafetyPeriodDays', 1
  ),
  now()
from public.financial_policy_versions policy
where policy.version = 'tes-payments-v1'
on conflict (version) do update
set is_active = excluded.is_active,
    currency = excluded.currency,
    platform_commission_bps = excluded.platform_commission_bps,
    auto_confirmation_days = excluded.auto_confirmation_days,
    transfer_safety_period_days = excluded.transfer_safety_period_days,
    free_cancellation_hours = excluded.free_cancellation_hours,
    late_cancellation_retention_bps = excluded.late_cancellation_retention_bps,
    no_show_retention_bps = excluded.no_show_retention_bps,
    refund_processing_business_days = excluded.refund_processing_business_days,
    manual_review_response_days = excluded.manual_review_response_days,
    weekly_batch_weekday = excluded.weekly_batch_weekday,
    weekly_batch_time = excluded.weekly_batch_time,
    timezone = excluded.timezone,
    payout_batch_rule = excluded.payout_batch_rule,
    cancellation_policy_key = excluded.cancellation_policy_key,
    refund_policy_key = excluded.refund_policy_key,
    proration_policy_key = excluded.proration_policy_key,
    upgrade_proration_behavior = excluded.upgrade_proration_behavior,
    downgrade_behavior = excluded.downgrade_behavior,
    subscription_cancellation_behavior = excluded.subscription_cancellation_behavior,
    metadata = excluded.metadata,
    effective_from = excluded.effective_from,
    effective_until = null;

create or replace function public.confirm_session_service(
  p_booking_id uuid,
  p_source public.session_confirmation_source,
  p_confirmed_by_profile_id uuid default null,
  p_review_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_policy uuid;
  v_confirmation_id uuid;
  v_new_service_status public.session_service_status;
begin
  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id
  for update;

  if not found then
    raise exception 'session_payment_not_found';
  end if;

  if v_payment.financial_status not in ('paid', 'partially_refunded') then
    raise exception 'payment_not_confirmed';
  end if;

  if v_payment.financial_status in ('refunded', 'disputed')
    or v_payment.admin_blocked_at is not null
    or v_payment.internal_contested_at is not null then
    raise exception 'session_blocked';
  end if;

  v_policy := v_payment.policy_version_id;
  if v_policy is null then
    select id into v_policy
    from public.financial_policy_versions
    where is_active
    limit 1;
  end if;

  v_new_service_status := case p_source
    when 'patient_review' then 'confirmed_by_patient_review'::public.session_service_status
    when 'therapist_manual' then 'confirmed_by_therapist'::public.session_service_status
    when 'automatic' then 'auto_confirmed'::public.session_service_status
    else 'confirmed_by_therapist'::public.session_service_status
  end;

  insert into public.session_service_confirmations (
    booking_id,
    session_payment_id,
    source,
    previous_service_status,
    confirmed_by_profile_id,
    review_id,
    policy_version_id,
    metadata
  ) values (
    p_booking_id,
    v_payment.id,
    p_source,
    v_payment.service_status,
    p_confirmed_by_profile_id,
    p_review_id,
    v_policy,
    p_metadata
  )
  on conflict (booking_id, source) do update
  set metadata = public.session_service_confirmations.metadata || excluded.metadata
  returning id into v_confirmation_id;

  update public.session_payments
  set service_status = v_new_service_status,
      service_confirmed_at = coalesce(service_confirmed_at, now()),
      service_confirmation_source = p_source,
      updated_at = now()
  where id = v_payment.id;

  update public.bookings
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_booking_id
    and status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded');

  perform public.refresh_session_transfer_eligibility(v_payment.id);

  return v_confirmation_id;
end;
$$;

create or replace function public.session_attendance_state_v1(
  p_booking_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_patient_joined boolean := false;
  v_therapist_joined boolean := false;
  v_closed boolean := false;
begin
  select
    vs.id,
    vs.status::text as status,
    vs.scheduled_starts_at,
    vs.scheduled_ends_at,
    vs.actual_ended_at
  into v_session
  from public.video_sessions vs
  where vs.booking_id = p_booking_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'available', false,
      'bothJoined', false,
      'patientJoined', false,
      'therapistJoined', false,
      'sessionClosed', false,
      'sessionEndsAt', null,
      'sessionStartedAt', null,
      'sessionEndedAt', null
    );
  end if;

  select exists (
    select 1
    from public.video_session_participations participation
    where participation.video_session_id = v_session.id
      and participation.participant_role = 'patient'::public.video_session_participant_role
      and participation.event_type = 'session.user_joined'
  ) into v_patient_joined;

  select exists (
    select 1
    from public.video_session_participations participation
    where participation.video_session_id = v_session.id
      and participation.participant_role = 'therapist'::public.video_session_participant_role
      and participation.event_type = 'session.user_joined'
  ) into v_therapist_joined;

  v_closed := v_session.status in ('ended', 'canceled', 'failed')
    or p_now >= v_session.scheduled_ends_at;

  return jsonb_build_object(
    'available', true,
    'bothJoined', v_patient_joined and v_therapist_joined,
    'patientJoined', v_patient_joined,
    'therapistJoined', v_therapist_joined,
    'sessionClosed', v_closed,
    'sessionEndsAt', v_session.scheduled_ends_at,
    'sessionStartedAt', v_session.scheduled_starts_at,
    'sessionEndedAt', v_session.actual_ended_at
  );
end;
$$;

create or replace function public.session_feedback_confirmation_payload(
  p_booking_id uuid,
  p_participant_role public.user_role
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when confirmation.id is null then null
    else jsonb_build_object(
      'confirmedAt', confirmation.confirmed_at,
      'dueAt', confirmation.due_at,
      'outcome', confirmation.outcome,
      'source', confirmation.source
    )
  end
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = p_participant_role;
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
  v_auto_confirmation_days integer := 7;
  v_attendance jsonb;
  v_existing public.session_participant_confirmations;
  v_hash text;
  v_confirmation public.session_participant_confirmations;
begin
  if p_actor_user_id is null
    or p_booking_id is null
    or p_request_id is null
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
  left join public.patient_profiles
    on patient_profiles.id = bookings.patient_profile_id
  left join public.therapist_profiles
    on therapist_profiles.id = bookings.therapist_profile_id
  where bookings.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'SESSION_CONFIRMATION_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(policy.auto_confirmation_days, 7)
  into v_auto_confirmation_days
  from public.session_payments payment
  left join public.financial_policy_versions policy
    on policy.id = payment.policy_version_id
  where payment.booking_id = p_booking_id
    and payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status);

  if not found then
    raise exception 'SESSION_CONFIRMATION_PAYMENT_REQUIRED' using errcode = '42501';
  end if;

  v_attendance := public.session_attendance_state_v1(p_booking_id, p_confirmed_at);

  if coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
    raise exception 'SESSION_CONFIRMATION_NOT_CLOSED' using errcode = '42501';
  end if;

  if p_outcome = 'completed'
    and coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false then
    raise exception 'SESSION_CONFIRMATION_ATTENDANCE_REQUIRED' using errcode = '42501';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome, p_source),
      'sha256'
    ),
    'hex'
  );

  select confirmation.*
  into v_existing
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
    booking_id,
    participant_role,
    outcome,
    source,
    confirmed_by_profile_id,
    request_id,
    payload_hash,
    due_at,
    confirmed_at
  ) values (
    p_booking_id,
    v_actor_role,
    p_outcome,
    p_source,
    case when p_source = 'manual' then p_actor_user_id else null end,
    p_request_id,
    v_hash,
    v_ends_at + make_interval(days => v_auto_confirmation_days),
    p_confirmed_at
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
    select confirmation.*
    into v_existing
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

create or replace function public.finalize_bilateral_session_confirmation_v1(
  p_booking_id uuid,
  p_now timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_attendance jsonb;
  v_patient public.session_participant_confirmations;
  v_therapist public.session_participant_confirmations;
  v_source public.session_confirmation_source;
begin
  select payment.*
  into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id
  for update;

  if not found then
    return 'payment_missing';
  end if;

  if v_payment.financial_status not in ('paid', 'partially_refunded')
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.internal_contested_at is not null
    or v_payment.admin_blocked_at is not null then
    return 'payment_blocked';
  end if;

  v_attendance := public.session_attendance_state_v1(p_booking_id, p_now);
  if coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false
    or coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
    return 'attendance_pending';
  end if;

  select confirmation.* into v_patient
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'patient'::public.user_role;

  select confirmation.* into v_therapist
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'therapist'::public.user_role;

  if v_patient.id is null or v_therapist.id is null then
    return 'waiting_confirmation';
  end if;

  if v_patient.outcome <> 'completed' or v_therapist.outcome <> 'completed' then
    update public.session_payments
    set service_status = 'not_performed',
        transfer_status = 'not_eligible',
        transfer_blocked_reason = 'participant_reported_not_performed',
        updated_at = now()
    where id = v_payment.id
      and service_confirmed_at is null;
    return 'not_performed';
  end if;

  v_source := case
    when v_patient.source = 'automatic' or v_therapist.source = 'automatic'
      then 'automatic'::public.session_confirmation_source
    else 'therapist_manual'::public.session_confirmation_source
  end;

  perform public.confirm_session_service(
    p_booking_id,
    v_source,
    case when v_source = 'therapist_manual' then v_therapist.confirmed_by_profile_id else null end,
    null,
    jsonb_build_object(
      'confirmationModel', 'bilateral_participant_confirmation',
      'patientSource', v_patient.source,
      'therapistSource', v_therapist.source,
      'confirmedAt', p_now
    )
  );

  return 'confirmed';
end;
$$;

create or replace function public.get_session_feedback_v1(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_feedback public.session_feedback;
  v_attendance jsonb;
  v_payment_status text;
  v_status text;
  v_reason text;
begin
  if v_actor_id is null then
    raise exception 'FEEDBACK_AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_booking_id is null then
    raise exception 'FEEDBACK_BOOKING_REQUIRED' using errcode = '22023';
  end if;

  select case
    when patient_profiles.user_id = v_actor_id then 'patient'::public.user_role
    when therapist_profiles.user_id = v_actor_id then 'therapist'::public.user_role
    else null
  end
  into v_actor_role
  from public.bookings
  left join public.patient_profiles
    on patient_profiles.id = bookings.patient_profile_id
  left join public.therapist_profiles
    on therapist_profiles.id = bookings.therapist_profile_id
  where bookings.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select payment.financial_status::text
  into v_payment_status
  from public.session_payments payment
  where payment.booking_id = p_booking_id;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());

  select feedback.*
  into v_feedback
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role
  limit 1;

  if v_feedback.id is not null then
    v_status := 'submitted';
    v_reason := 'submitted';
  elsif v_payment_status is distinct from 'paid'
    and v_payment_status is distinct from 'partially_refunded' then
    v_status := 'unavailable';
    v_reason := 'payment_pending';
  elsif coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false
    and coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false then
    v_status := case
      when now() < coalesce((v_attendance ->> 'sessionStartedAt')::timestamptz, now())
        then 'before_session'
      else 'waiting_for_participants'
    end;
    v_reason := 'both_participants_required';
  elsif coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
    v_status := 'attendance_pending';
    v_reason := 'session_not_closed';
  elsif coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false then
    v_status := 'incident_only';
    v_reason := 'attendance_incomplete';
  else
    v_status := 'eligible';
    v_reason := 'both_participants_joined';
  end if;

  return jsonb_build_object(
    'attendance', v_attendance,
    'confirmation', public.session_feedback_confirmation_payload(p_booking_id, v_actor_role),
    'feedback', case
      when v_feedback.id is null then null
      else public.session_feedback_payload(v_feedback)
    end,
    'reason', v_reason,
    'status', v_status
  );
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
  v_attendance jsonb;
  v_confirmation jsonb;
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select case
    when patient_profiles.user_id = p_actor_user_id then 'patient'::public.user_role
    when therapist_profiles.user_id = p_actor_user_id then 'therapist'::public.user_role
    else null
  end
  into v_actor_role
  from public.bookings
  left join public.patient_profiles
    on patient_profiles.id = bookings.patient_profile_id
  left join public.therapist_profiles
    on therapist_profiles.id = bookings.therapist_profile_id
  where bookings.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.session_payments payment
    where payment.booking_id = p_booking_id
      and payment.financial_status in ('paid'::public.session_financial_status, 'partially_refunded'::public.session_financial_status)
  ) then
    raise exception 'FEEDBACK_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());

  if p_outcome not in ('completed', 'not_performed')
    or char_length(v_comment) > 500 then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  end if;

  if p_outcome = 'completed' then
    if p_rating is null
      or p_rating not between 1 and 5
      or p_not_performed_reason is not null then
      raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
    end if;

    if coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false
      or coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
      raise exception 'FEEDBACK_ATTENDANCE_REQUIRED' using errcode = '42501';
    end if;
  elsif p_rating is not null
    or p_not_performed_reason is null
    or p_not_performed_reason not in (
      'patient_absent',
      'therapist_absent',
      'internet_problem',
      'audio_video_problem',
      'rescheduled',
      'late_cancellation',
      'other'
    ) then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
  elsif coalesce((v_attendance ->> 'sessionClosed')::boolean, false) = false then
    raise exception 'FEEDBACK_INCIDENT_NOT_AVAILABLE' using errcode = '42501';
  end if;

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome, coalesce(p_rating::text, ''), coalesce(p_not_performed_reason, ''), v_comment),
      'sha256'
    ),
    'hex'
  );

  select feedback.*
  into v_existing
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'feedback', public.session_feedback_payload(v_existing),
      'idempotentReplay', true
    );
  end if;

  insert into public.session_feedback (
    author_profile_id,
    author_role,
    booking_id,
    comment,
    not_performed_reason,
    outcome,
    payload_hash,
    rating,
    request_id
  ) values (
    p_actor_user_id,
    v_actor_role,
    p_booking_id,
    v_comment,
    p_not_performed_reason,
    p_outcome,
    v_hash,
    p_rating,
    p_request_id
  )
  returning * into v_feedback;

  v_confirmation := public.record_session_participant_confirmation_v1(
    p_actor_user_id,
    p_booking_id,
    p_outcome,
    p_request_id,
    'manual',
    now()
  );

  if p_outcome = 'completed' then
    perform public.finalize_bilateral_session_confirmation_v1(p_booking_id, now());
  else
    update public.session_payments
    set service_status = 'not_performed',
        transfer_status = 'not_eligible',
        transfer_blocked_reason = 'participant_reported_not_performed',
        updated_at = now()
    where booking_id = p_booking_id
      and service_confirmed_at is null;
  end if;

  return jsonb_build_object(
    'confirmation', v_confirmation -> 'confirmation',
    'feedback', public.session_feedback_payload(v_feedback),
    'idempotentReplay', false
  );
exception
  when unique_violation then
    select feedback.*
    into v_existing
    from public.session_feedback feedback
    where feedback.booking_id = p_booking_id
      and feedback.author_role = v_actor_role
    limit 1;

    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'feedback', public.session_feedback_payload(v_existing),
        'idempotentReplay', true
      );
    end if;

    raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

create or replace function public.auto_confirm_sessions(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row record;
  v_attendance jsonb;
  v_role public.user_role;
  v_hash text;
begin
  for v_row in
    select
      payment.booking_id,
      booking.ends_at,
      coalesce(policy.auto_confirmation_days, 7) as auto_confirmation_days
    from public.session_payments payment
    join public.bookings booking on booking.id = payment.booking_id
    left join public.financial_policy_versions policy
      on policy.id = payment.policy_version_id
    where payment.financial_status in ('paid', 'partially_refunded')
      and payment.service_confirmed_at is null
      and booking.ends_at <= p_now - make_interval(days => coalesce(policy.auto_confirmation_days, 7))
      and booking.status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
      and payment.refund_pending = false
      and payment.disputed_at is null
      and payment.internal_contested_at is null
      and payment.admin_blocked_at is null
  loop
    v_attendance := public.session_attendance_state_v1(v_row.booking_id, p_now);

    if coalesce((v_attendance ->> 'bothJoined')::boolean, false) = false then
      continue;
    end if;

    foreach v_role in array array[
      'patient'::public.user_role,
      'therapist'::public.user_role
    ] loop
      if not exists (
        select 1
        from public.session_participant_confirmations confirmation
        where confirmation.booking_id = v_row.booking_id
          and confirmation.participant_role = v_role
      ) then
        v_hash := encode(
          extensions.digest(
            concat_ws('|', v_row.booking_id::text, v_role::text, 'completed', 'automatic'),
            'sha256'
          ),
          'hex'
        );

        insert into public.session_participant_confirmations (
          booking_id,
          participant_role,
          outcome,
          source,
          request_id,
          payload_hash,
          due_at,
          confirmed_at
        ) values (
          v_row.booking_id,
          v_role,
          'completed',
          'automatic',
          gen_random_uuid(),
          v_hash,
          v_row.ends_at + make_interval(days => v_row.auto_confirmation_days),
          p_now
        )
        on conflict (booking_id, participant_role) do nothing;

        v_count := v_count + 1;
      end if;
    end loop;

    perform public.finalize_bilateral_session_confirmation_v1(v_row.booking_id, p_now);
  end loop;

  return v_count;
end;
$$;

create or replace function public.admin_get_session_feedback_v1(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_patient public.session_feedback;
  v_therapist public.session_feedback;
  v_patient_confirmation public.session_participant_confirmations;
  v_therapist_confirmation public.session_participant_confirmations;
  v_attendance jsonb;
  v_pending jsonb := '[]'::jsonb;
  v_is_divergent boolean := false;
  v_payment record;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'::public.user_role
  ) then
    raise exception 'FEEDBACK_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select feedback.* into v_patient
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = 'patient'::public.user_role
  limit 1;

  select feedback.* into v_therapist
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = 'therapist'::public.user_role
  limit 1;

  select confirmation.* into v_patient_confirmation
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'patient'::public.user_role;

  select confirmation.* into v_therapist_confirmation
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'therapist'::public.user_role;

  v_attendance := public.session_attendance_state_v1(p_booking_id, now());

  if v_patient.id is null then
    v_pending := v_pending || jsonb_build_array('patient');
  end if;
  if v_therapist.id is null then
    v_pending := v_pending || jsonb_build_array('therapist');
  end if;

  if v_patient.id is not null and v_therapist.id is not null then
    v_is_divergent := v_patient.outcome is distinct from v_therapist.outcome
      or v_patient.rating is distinct from v_therapist.rating
      or v_patient.not_performed_reason is distinct from v_therapist.not_performed_reason;
  end if;

  select
    payment.transfer_status::text,
    payment.eligible_at,
    payment.service_status::text,
    payment.service_confirmed_at
  into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id;

  return jsonb_build_object(
    'attendance', v_attendance,
    'confirmation', jsonb_build_object(
      'patient', case when v_patient_confirmation.id is null then null else jsonb_build_object(
        'confirmedAt', v_patient_confirmation.confirmed_at,
        'dueAt', v_patient_confirmation.due_at,
        'outcome', v_patient_confirmation.outcome,
        'source', v_patient_confirmation.source
      ) end,
      'therapist', case when v_therapist_confirmation.id is null then null else jsonb_build_object(
        'confirmedAt', v_therapist_confirmation.confirmed_at,
        'dueAt', v_therapist_confirmation.due_at,
        'outcome', v_therapist_confirmation.outcome,
        'source', v_therapist_confirmation.source
      ) end
    ),
    'divergent', v_is_divergent,
    'financial', case when v_payment.transfer_status is null then null else jsonb_build_object(
      'eligibleAt', v_payment.eligible_at,
      'serviceConfirmedAt', v_payment.service_confirmed_at,
      'serviceStatus', v_payment.service_status,
      'transferStatus', v_payment.transfer_status
    ) end,
    'pendingRoles', v_pending,
    'patient', case when v_patient.id is null then null else public.session_feedback_payload(v_patient) end,
    'therapist', case when v_therapist.id is null then null else public.session_feedback_payload(v_therapist) end
  );
end;
$$;

revoke all on function public.session_attendance_state_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.session_feedback_confirmation_payload(uuid, public.user_role)
  from public, anon, authenticated;
revoke all on function public.record_session_participant_confirmation_v1(uuid, uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_bilateral_session_confirmation_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.auto_confirm_sessions(timestamptz)
  from public, anon, authenticated;
grant execute on function public.session_attendance_state_v1(uuid, timestamptz)
  to service_role;
grant execute on function public.session_feedback_confirmation_payload(uuid, public.user_role)
  to service_role;
grant execute on function public.record_session_participant_confirmation_v1(uuid, uuid, text, uuid, text, timestamptz)
  to service_role;
grant execute on function public.finalize_bilateral_session_confirmation_v1(uuid, timestamptz)
  to service_role;
grant execute on function public.auto_confirm_sessions(timestamptz)
  to service_role;

comment on table public.session_participant_confirmations is
  'Independent manual or automatic confirmation by each session participant; never a public review.';

comment on function public.session_attendance_state_v1(uuid, timestamptz) is
  'Internal safe attendance predicate derived from trusted Zoom participant events without exposing provider identifiers.';

comment on function public.finalize_bilateral_session_confirmation_v1(uuid, timestamptz) is
  'Finalizes service confirmation only after both participants joined and both participant confirmations are completed.';

commit;
