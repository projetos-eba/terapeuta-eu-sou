begin;

-- Role-specific immutable policy snapshot.
alter table public.financial_policy_versions
  add column if not exists patient_auto_confirmation_days integer,
  add column if not exists therapist_auto_confirmation_days integer;

update public.financial_policy_versions
set patient_auto_confirmation_days = coalesce(patient_auto_confirmation_days, auto_confirmation_days),
    therapist_auto_confirmation_days = coalesce(therapist_auto_confirmation_days, auto_confirmation_days)
where patient_auto_confirmation_days is null
   or therapist_auto_confirmation_days is null;

alter table public.financial_policy_versions
  alter column patient_auto_confirmation_days set default 7,
  alter column patient_auto_confirmation_days set not null,
  alter column therapist_auto_confirmation_days set default 30,
  alter column therapist_auto_confirmation_days set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_policy_patient_auto_confirmation_positive'
      and conrelid = 'public.financial_policy_versions'::regclass
  ) then
    alter table public.financial_policy_versions
      add constraint financial_policy_patient_auto_confirmation_positive
      check (patient_auto_confirmation_days > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_policy_therapist_auto_confirmation_positive'
      and conrelid = 'public.financial_policy_versions'::regclass
  ) then
    alter table public.financial_policy_versions
      add constraint financial_policy_therapist_auto_confirmation_positive
      check (therapist_auto_confirmation_days > 0);
  end if;
end $$;

insert into public.financial_policy_versions (
  version,
  is_active,
  currency,
  platform_commission_bps,
  auto_confirmation_days,
  patient_auto_confirmation_days,
  therapist_auto_confirmation_days,
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
  'tes-payments-v6-bilateral-7d-30d',
  false,
  policy.currency,
  policy.platform_commission_bps,
  7,
  7,
  30,
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
    'sessionConfirmation', 'bilateral_role_deadlines',
    'patientAutoConfirmationDays', 7,
    'therapistAutoConfirmationDays', 30,
    'transferSafetyPeriodDays', 1,
    'attendanceGatesAutomaticConfirmation', false
  ),
  now()
from public.financial_policy_versions policy
where policy.is_active
order by policy.effective_from desc
limit 1
on conflict (version) do update
set currency = excluded.currency,
    platform_commission_bps = excluded.platform_commission_bps,
    auto_confirmation_days = excluded.auto_confirmation_days,
    patient_auto_confirmation_days = excluded.patient_auto_confirmation_days,
    therapist_auto_confirmation_days = excluded.therapist_auto_confirmation_days,
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
    effective_until = null;

update public.financial_policy_versions
set is_active = false,
    effective_until = coalesce(effective_until, now())
where is_active
  and version <> 'tes-payments-v6-bilateral-7d-30d';

update public.financial_policy_versions
set is_active = true,
    effective_until = null
where version = 'tes-payments-v6-bilateral-7d-30d';

alter table public.session_participant_confirmations
  add column if not exists policy_version_id uuid
    references public.financial_policy_versions (id) on delete restrict;

update public.session_participant_confirmations confirmation
set policy_version_id = payment.policy_version_id
from public.session_payments payment
where payment.booking_id = confirmation.booking_id
  and confirmation.policy_version_id is null;

alter table public.session_participant_confirmations
  alter column policy_version_id set not null;

-- Apply the corrected deadlines only to obligations that have not been
-- confirmed, reserved in a payout batch, transferred, refunded or disputed.
update public.session_payments payment
set policy_version_id = policy.id,
    updated_at = now()
from public.financial_policy_versions policy
where policy.version = 'tes-payments-v6-bilateral-7d-30d'
  and payment.service_confirmed_at is null
  and payment.transfer_status not in ('batched', 'transfer_pending', 'transferred')
  and payment.refund_pending = false
  and payment.disputed_at is null
  and payment.admin_blocked_at is null
  and payment.financial_status in ('paid', 'partially_refunded');

update public.session_participant_confirmations confirmation
set policy_version_id = payment.policy_version_id,
    due_at = booking.ends_at + make_interval(
      days => case confirmation.participant_role
        when 'patient'::public.user_role then policy.patient_auto_confirmation_days
        else policy.therapist_auto_confirmation_days
      end
    )
from public.session_payments payment
join public.bookings booking on booking.id = payment.booking_id
join public.financial_policy_versions policy on policy.id = payment.policy_version_id
where confirmation.booking_id = payment.booking_id
  and payment.service_confirmed_at is null
  and payment.transfer_status not in ('batched', 'transfer_pending', 'transferred');

create index if not exists session_participant_confirmations_policy_idx
  on public.session_participant_confirmations (policy_version_id, due_at);

-- A negative report is immutable evidence and opens a separate, auditable
-- operational incident instead of being overwritten by automation.
create table if not exists public.session_confirmation_incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  session_payment_id uuid not null references public.session_payments (id) on delete restrict,
  opened_by_feedback_id uuid references public.session_feedback (id) on delete set null,
  reported_by_role public.user_role,
  status text not null default 'open',
  resolution_reason text,
  resolved_by_user_id uuid references public.profiles (id) on delete set null,
  resolution_request_id uuid unique,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_confirmation_incidents_role_check check (
    reported_by_role is null
    or reported_by_role in ('patient'::public.user_role, 'therapist'::public.user_role)
  ),
  constraint session_confirmation_incidents_status_check check (
    status in ('open', 'performed_confirmed', 'not_performed_confirmed')
  ),
  constraint session_confirmation_incidents_resolution_check check (
    (status = 'open' and resolved_at is null and resolved_by_user_id is null)
    or (status <> 'open' and resolved_at is not null and resolved_by_user_id is not null)
  )
);

create index if not exists session_confirmation_incidents_status_created_idx
  on public.session_confirmation_incidents (status, created_at desc);

drop trigger if exists set_session_confirmation_incidents_updated_at
  on public.session_confirmation_incidents;
create trigger set_session_confirmation_incidents_updated_at
before update on public.session_confirmation_incidents
for each row execute function public.set_updated_at();

alter table public.session_confirmation_incidents enable row level security;
revoke all on public.session_confirmation_incidents from public, anon, authenticated;
grant all on public.session_confirmation_incidents to service_role;

create or replace function public.open_session_confirmation_incident_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
begin
  if new.outcome <> 'not_performed' then
    return new;
  end if;

  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = new.booking_id
  for update;

  if v_payment.id is null then
    return new;
  end if;

  insert into public.session_confirmation_incidents (
    booking_id,
    session_payment_id,
    opened_by_feedback_id,
    reported_by_role
  ) values (
    new.booking_id,
    v_payment.id,
    new.id,
    new.author_role
  )
  on conflict (booking_id) do update
  set opened_by_feedback_id = coalesce(
        public.session_confirmation_incidents.opened_by_feedback_id,
        excluded.opened_by_feedback_id
      ),
      reported_by_role = coalesce(
        public.session_confirmation_incidents.reported_by_role,
        excluded.reported_by_role
      ),
      status = 'open',
      resolution_reason = null,
      resolved_by_user_id = null,
      resolution_request_id = null,
      resolved_at = null,
      updated_at = now();

  update public.session_payments
  set service_status = case
        when transfer_status in ('batched', 'transfer_pending', 'transferred')
          then service_status
        else 'not_performed'::public.session_service_status
      end,
      service_confirmed_at = case
        when transfer_status in ('batched', 'transfer_pending', 'transferred')
          then service_confirmed_at
        else null
      end,
      service_confirmation_source = case
        when transfer_status in ('batched', 'transfer_pending', 'transferred')
          then service_confirmation_source
        else null
      end,
      eligible_at = case
        when transfer_status in ('batched', 'transfer_pending', 'transferred')
          then eligible_at
        else null
      end,
      transfer_status = case
        when transfer_status in ('batched', 'transfer_pending', 'transferred')
          then transfer_status
        else 'blocked'::public.session_transfer_status
      end,
      transfer_blocked_reason = 'participant_reported_not_performed',
      internal_contested_at = coalesce(internal_contested_at, now()),
      updated_at = now()
  where id = v_payment.id
    and transfer_status <> 'transferred';

  return new;
end;
$$;

drop trigger if exists open_session_confirmation_incident
  on public.session_feedback;
create trigger open_session_confirmation_incident
after insert on public.session_feedback
for each row
when (new.outcome = 'not_performed')
execute function public.open_session_confirmation_incident_v1();

insert into public.session_confirmation_incidents (
  booking_id,
  session_payment_id,
  opened_by_feedback_id,
  reported_by_role
)
select distinct on (feedback.booking_id)
  feedback.booking_id,
  payment.id,
  feedback.id,
  feedback.author_role
from public.session_feedback feedback
join public.session_payments payment on payment.booking_id = feedback.booking_id
where feedback.outcome = 'not_performed'
order by feedback.booking_id, feedback.created_at asc
on conflict (booking_id) do nothing;

-- Public therapist reviews are never a service-confirmation authority.
drop trigger if exists confirm_session_from_review_trigger on public.reviews;
drop function if exists public.confirm_session_from_review();

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
  v_confirmed_at timestamptz;
begin
  select * into v_payment
  from public.session_payments
  where booking_id = p_booking_id
  for update;

  if not found then raise exception 'session_payment_not_found'; end if;
  if v_payment.financial_status not in ('paid', 'partially_refunded') then
    raise exception 'payment_not_confirmed';
  end if;
  if v_payment.financial_status in ('refunded', 'disputed')
    or v_payment.admin_blocked_at is not null
    or v_payment.internal_contested_at is not null then
    raise exception 'session_blocked';
  end if;

  v_policy := v_payment.policy_version_id;
  v_confirmed_at := coalesce(
    nullif(p_metadata ->> 'confirmedAt', '')::timestamptz,
    now()
  );
  v_new_service_status := case p_source
    when 'bilateral' then 'confirmed_bilateral'::public.session_service_status
    when 'admin' then 'confirmed_bilateral'::public.session_service_status
    when 'patient_review' then 'confirmed_by_patient_review'::public.session_service_status
    when 'therapist_manual' then 'confirmed_by_therapist'::public.session_service_status
    when 'automatic' then 'auto_confirmed'::public.session_service_status
    else 'confirmed_bilateral'::public.session_service_status
  end;

  insert into public.session_service_confirmations (
    booking_id, session_payment_id, source, previous_service_status,
    confirmed_by_profile_id, review_id, policy_version_id, confirmed_at, metadata
  ) values (
    p_booking_id, v_payment.id, p_source, v_payment.service_status,
    p_confirmed_by_profile_id, p_review_id, v_policy, v_confirmed_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (booking_id, source) do update
  set metadata = public.session_service_confirmations.metadata || excluded.metadata
  returning id into v_confirmation_id;

  update public.session_payments
  set service_status = v_new_service_status,
      service_confirmed_at = coalesce(service_confirmed_at, v_confirmed_at),
      service_confirmation_source = p_source,
      transfer_blocked_reason = null,
      updated_at = now()
  where id = v_payment.id;

  update public.bookings
  set status = 'completed',
      completed_at = coalesce(completed_at, v_confirmed_at),
      updated_at = now()
  where id = p_booking_id
    and status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded');

  perform public.refresh_session_transfer_eligibility(v_payment.id, now());
  return v_confirmation_id;
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
  v_patient public.session_participant_confirmations;
  v_therapist public.session_participant_confirmations;
  v_confirmed_at timestamptz;
begin
  select payment.* into v_payment
  from public.session_payments payment
  where payment.booking_id = p_booking_id
  for update;

  if not found then return 'payment_missing'; end if;
  if v_payment.financial_status not in ('paid', 'partially_refunded')
    or v_payment.refund_pending
    or v_payment.disputed_at is not null
    or v_payment.internal_contested_at is not null
    or v_payment.admin_blocked_at is not null then
    return 'payment_blocked';
  end if;
  if exists (
    select 1 from public.session_confirmation_incidents incident
    where incident.booking_id = p_booking_id and incident.status = 'open'
  ) then
    return 'incident_open';
  end if;

  select confirmation.* into v_patient
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'patient'::public.user_role;
  select confirmation.* into v_therapist
  from public.session_participant_confirmations confirmation
  where confirmation.booking_id = p_booking_id
    and confirmation.participant_role = 'therapist'::public.user_role;

  if v_patient.id is null or v_therapist.id is null then return 'waiting_confirmation'; end if;
  if v_patient.outcome <> 'completed' or v_therapist.outcome <> 'completed' then
    return 'not_performed';
  end if;

  v_confirmed_at := greatest(v_patient.confirmed_at, v_therapist.confirmed_at);
  perform public.confirm_session_service(
    p_booking_id,
    'bilateral'::public.session_confirmation_source,
    null,
    null,
    jsonb_build_object(
      'confirmationModel', 'bilateral_role_deadlines',
      'patientSource', v_patient.source,
      'patientConfirmedAt', v_patient.confirmed_at,
      'therapistSource', v_therapist.source,
      'therapistConfirmedAt', v_therapist.confirmed_at,
      'confirmedAt', v_confirmed_at,
      'finalizedAt', p_now
    )
  );
  return 'confirmed';
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
begin
  if p_actor_user_id is null or p_booking_id is null or p_request_id is null then
    raise exception 'FEEDBACK_VALIDATION_ERROR' using errcode = '22023';
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
  where bookings.id = p_booking_id;

  if v_actor_role is null then
    raise exception 'FEEDBACK_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;
  if now() < v_ends_at then
    raise exception 'FEEDBACK_SESSION_NOT_ENDED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.session_payments payment
    where payment.booking_id = p_booking_id
      and payment.financial_status in ('paid', 'partially_refunded')
      and payment.refund_pending = false
      and payment.disputed_at is null
      and payment.admin_blocked_at is null
  ) then
    raise exception 'FEEDBACK_SESSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  if p_outcome not in ('completed', 'not_performed')
    or char_length(v_comment) > 500 then
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

  v_hash := encode(
    extensions.digest(
      concat_ws('|', p_booking_id::text, v_actor_role::text, p_outcome,
        coalesce(p_rating::text, ''), coalesce(p_not_performed_reason, ''), v_comment),
      'sha256'
    ),
    'hex'
  );

  select feedback.* into v_existing
  from public.session_feedback feedback
  where feedback.booking_id = p_booking_id
    and feedback.author_role = v_actor_role
  for update;

  if v_existing.id is not null then
    if v_existing.payload_hash <> v_hash then
      raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'confirmation', public.session_feedback_confirmation_payload(p_booking_id, v_actor_role),
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
  from public.session_participant_confirmations confirmation
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
          when transfer_status in ('batched', 'transfer_pending', 'transferred') then transfer_status
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
    from public.session_feedback feedback
    where feedback.booking_id = p_booking_id
      and feedback.author_role = v_actor_role
    limit 1;
    if v_existing.id is not null and v_existing.payload_hash = v_hash then
      return jsonb_build_object(
        'confirmation', public.session_feedback_confirmation_payload(p_booking_id, v_actor_role),
        'feedback', public.session_feedback_payload(v_existing),
        'idempotentReplay', true
      );
    end if;
    raise exception 'FEEDBACK_REQUEST_CONFLICT' using errcode = '23505';
end;
$$;

create or replace function public.refresh_session_transfer_eligibility(
  p_session_payment_id uuid,
  p_now timestamptz default now()
)
returns public.session_transfer_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.session_payments%rowtype;
  v_connect_status text;
  v_has_active_batch boolean;
  v_safety_days integer;
  v_eligible_at timestamptz;
  v_status public.session_transfer_status;
  v_reason text;
begin
  select * into v_payment from public.session_payments
  where id = p_session_payment_id for update;
  if not found then raise exception 'session_payment_not_found'; end if;

  select coalesce(transfer_safety_period_days, 1) into v_safety_days
  from public.financial_policy_versions where id = v_payment.policy_version_id;
  select stripe_transfers_status into v_connect_status
  from public.therapist_connect_accounts
  where therapist_profile_id = v_payment.therapist_profile_id;
  select exists (
    select 1 from public.payout_batch_items
    where session_payment_id = p_session_payment_id
      and status in ('reserved', 'transfer_pending', 'transferred')
  ) into v_has_active_batch;

  if v_payment.transfer_status = 'transferred' then
    v_status := 'transferred'; v_reason := 'already_transferred';
  elsif v_has_active_batch then
    v_status := 'batched'; v_reason := 'already_batched';
  elsif v_payment.financial_status = 'disputed' or v_payment.disputed_at is not null then
    v_status := 'blocked'; v_reason := 'disputed';
  elsif v_payment.admin_blocked_at is not null or v_payment.internal_contested_at is not null then
    v_status := 'blocked'; v_reason := coalesce(v_payment.transfer_blocked_reason, 'blocked_or_contested');
  elsif v_payment.refund_pending or v_payment.financial_status = 'refunded' then
    v_status := 'blocked'; v_reason := 'refund';
  elsif v_payment.financial_status not in ('paid', 'partially_refunded') then
    v_status := 'not_eligible'; v_reason := 'payment_not_confirmed';
  elsif v_payment.service_status not in (
      'confirmed_bilateral',
      'confirmed_by_patient_review',
      'confirmed_by_therapist',
      'auto_confirmed'
    ) or v_payment.service_confirmed_at is null then
    v_status := 'waiting_confirmation'; v_reason := 'service_not_confirmed';
  elsif coalesce(v_connect_status, 'inactive') <> 'active' then
    v_status := 'blocked'; v_reason := 'connect_not_ready';
  elsif v_payment.therapist_amount_cents <= 0 then
    v_status := 'not_eligible'; v_reason := 'non_positive_transfer_amount';
  else
    v_eligible_at := v_payment.service_confirmed_at + make_interval(days => v_safety_days);
    if p_now < v_eligible_at then
      v_status := 'waiting_safety_period'; v_reason := 'waiting_safety_period';
    else
      v_status := 'eligible'; v_reason := 'eligible';
    end if;
  end if;

  update public.session_payments
  set transfer_status = v_status,
      eligible_at = case
        when v_status in ('waiting_safety_period', 'eligible') then v_eligible_at
        when v_status in ('batched', 'transfer_pending', 'transferred') then eligible_at
        else null
      end,
      transfer_blocked_reason = v_reason,
      updated_at = now()
  where id = p_session_payment_id;
  return v_status;
end;
$$;

create table if not exists public.session_confirmation_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null unique,
  status text not null default 'running',
  attempts integer not null default 1,
  patient_confirmations integer not null default 0,
  therapist_confirmations integer not null default 0,
  finalized_sessions integer not null default 0,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_confirmation_scheduler_runs_status_check check (
    status in ('running', 'completed', 'failed')
  ),
  constraint session_confirmation_scheduler_runs_counts_check check (
    attempts > 0 and patient_confirmations >= 0
    and therapist_confirmations >= 0 and finalized_sessions >= 0
  )
);

create index if not exists session_confirmation_scheduler_runs_status_idx
  on public.session_confirmation_scheduler_runs (status, scheduled_for desc);
alter table public.session_confirmation_scheduler_runs enable row level security;
revoke all on public.session_confirmation_scheduler_runs from public, anon, authenticated;
grant all on public.session_confirmation_scheduler_runs to service_role;

drop trigger if exists set_session_confirmation_scheduler_runs_updated_at
  on public.session_confirmation_scheduler_runs;
create trigger set_session_confirmation_scheduler_runs_updated_at
before update on public.session_confirmation_scheduler_runs
for each row execute function public.set_updated_at();

drop function if exists public.auto_confirm_sessions(timestamptz);
create function public.auto_confirm_sessions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.session_confirmation_scheduler_runs%rowtype;
  v_row record;
  v_hash text;
  v_inserted integer;
  v_patient_count integer := 0;
  v_therapist_count integer := 0;
  v_finalized integer := 0;
  v_result text;
begin
  insert into public.session_confirmation_scheduler_runs (scheduled_for, status)
  values (date_trunc('hour', p_now), 'running')
  on conflict (scheduled_for) do update
  set status = 'running',
      attempts = public.session_confirmation_scheduler_runs.attempts + 1,
      error_code = null,
      started_at = now(),
      finished_at = null,
      updated_at = now()
  returning * into v_run;

  begin
    for v_row in
      select
        payment.booking_id,
        payment.policy_version_id,
        booking.ends_at,
        deadline.participant_role,
        booking.ends_at + make_interval(days => deadline.deadline_days) as due_at
      from public.session_payments payment
      join public.bookings booking on booking.id = payment.booking_id
      join public.financial_policy_versions policy on policy.id = payment.policy_version_id
      cross join lateral (
        values
          ('patient'::public.user_role, policy.patient_auto_confirmation_days),
          ('therapist'::public.user_role, policy.therapist_auto_confirmation_days)
      ) as deadline(participant_role, deadline_days)
      where payment.financial_status in ('paid', 'partially_refunded')
        and payment.service_confirmed_at is null
        and booking.ends_at + make_interval(days => deadline.deadline_days) <= p_now
        and booking.status not in ('cancelled_by_patient', 'cancelled_by_therapist', 'refunded')
        and payment.refund_pending = false
        and payment.disputed_at is null
        and payment.internal_contested_at is null
        and payment.admin_blocked_at is null
        and not exists (
          select 1 from public.session_participant_confirmations confirmation
          where confirmation.booking_id = payment.booking_id
            and confirmation.participant_role = deadline.participant_role
        )
        and not exists (
          select 1 from public.session_confirmation_incidents incident
          where incident.booking_id = payment.booking_id and incident.status = 'open'
        )
        and not exists (
          select 1 from public.session_feedback feedback
          where feedback.booking_id = payment.booking_id
            and feedback.outcome = 'not_performed'
        )
      order by due_at, payment.booking_id, deadline.participant_role
    loop
      v_hash := encode(
        extensions.digest(
          concat_ws('|', v_row.booking_id::text, v_row.participant_role::text, 'completed', 'automatic'),
          'sha256'
        ),
        'hex'
      );

      insert into public.session_participant_confirmations (
        booking_id, participant_role, outcome, source, request_id,
        payload_hash, due_at, confirmed_at, policy_version_id
      ) values (
        v_row.booking_id, v_row.participant_role, 'completed', 'automatic',
        gen_random_uuid(), v_hash, v_row.due_at, v_row.due_at, v_row.policy_version_id
      )
      on conflict (booking_id, participant_role) do nothing;
      get diagnostics v_inserted = row_count;

      if v_inserted > 0 then
        if v_row.participant_role = 'patient'::public.user_role then
          v_patient_count := v_patient_count + 1;
        else
          v_therapist_count := v_therapist_count + 1;
        end if;
      end if;

      v_result := public.finalize_bilateral_session_confirmation_v1(v_row.booking_id, p_now);
      if v_result = 'confirmed' then v_finalized := v_finalized + 1; end if;
    end loop;

    update public.session_confirmation_scheduler_runs
    set status = 'completed',
        patient_confirmations = v_patient_count,
        therapist_confirmations = v_therapist_count,
        finalized_sessions = v_finalized,
        finished_at = now(),
        updated_at = now()
    where id = v_run.id;
  exception when others then
    update public.session_confirmation_scheduler_runs
    set status = 'failed',
        patient_confirmations = v_patient_count,
        therapist_confirmations = v_therapist_count,
        finalized_sessions = v_finalized,
        error_code = sqlstate,
        finished_at = now(),
        updated_at = now()
    where id = v_run.id;
    return -1;
  end;

  return v_patient_count + v_therapist_count;
end;
$$;

create or replace function public.admin_resolve_session_confirmation_incident_v1(
  p_booking_id uuid,
  p_decision text,
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
  v_payment public.session_payments%rowtype;
begin
  if v_actor_id is null or not exists (
    select 1 from public.profiles
    where id = v_actor_id and role = 'admin'::public.user_role
  ) then
    raise exception 'SESSION_INCIDENT_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_booking_id is null or p_request_id is null
    or p_decision not in ('performed_confirmed', 'not_performed_confirmed')
    or length(btrim(coalesce(p_reason, ''))) < 5
    or length(btrim(coalesce(p_reason, ''))) > 1000 then
    raise exception 'SESSION_INCIDENT_VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_incident from public.session_confirmation_incidents
  where booking_id = p_booking_id for update;
  if not found then raise exception 'SESSION_INCIDENT_NOT_FOUND'; end if;
  if v_incident.resolution_request_id = p_request_id then
    return jsonb_build_object('idempotentReplay', true, 'status', v_incident.status);
  end if;
  if v_incident.status <> 'open' then
    raise exception 'SESSION_INCIDENT_ALREADY_RESOLVED';
  end if;

  select * into v_payment from public.session_payments
  where booking_id = p_booking_id for update;

  update public.session_confirmation_incidents
  set status = p_decision,
      resolution_reason = btrim(p_reason),
      resolved_by_user_id = v_actor_id,
      resolution_request_id = p_request_id,
      resolved_at = now(),
      updated_at = now()
  where id = v_incident.id;

  if p_decision = 'performed_confirmed' then
    update public.session_payments
    set internal_contested_at = null,
        transfer_blocked_reason = null,
        updated_at = now()
    where id = v_payment.id;

    perform public.confirm_session_service(
      p_booking_id,
      'admin'::public.session_confirmation_source,
      v_actor_id,
      null,
      jsonb_build_object(
        'confirmationModel', 'admin_incident_resolution',
        'incidentId', v_incident.id,
        'confirmedAt', now(),
        'reason', btrim(p_reason)
      )
    );
  else
    update public.session_payments
    set service_status = 'not_performed',
        transfer_status = case
          when transfer_status in ('batched', 'transfer_pending', 'transferred') then transfer_status
          else 'blocked'::public.session_transfer_status
        end,
        transfer_blocked_reason = 'not_performed_confirmed_by_admin',
        internal_contested_at = coalesce(internal_contested_at, now()),
        updated_at = now()
    where id = v_payment.id;
  end if;

  perform public.record_admin_audit_event_v1(
    v_actor_id,
    'admin',
    'admin.sessions.manage',
    'session_confirmation_incident.resolve',
    'session_confirmation_incident',
    v_incident.id::text,
    jsonb_build_object('status', v_incident.status),
    jsonb_build_object('status', p_decision),
    btrim(p_reason),
    p_request_id::text,
    null,
    'session_confirmation'
  );

  return jsonb_build_object('idempotentReplay', false, 'status', p_decision);
end;
$$;

revoke all on function public.open_session_confirmation_incident_v1()
  from public, anon, authenticated;
revoke all on function public.record_session_participant_confirmation_v1(uuid, uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.finalize_bilateral_session_confirmation_v1(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.auto_confirm_sessions(timestamptz)
  from public, anon, authenticated;
revoke all on function public.admin_resolve_session_confirmation_incident_v1(uuid, text, text, uuid)
  from public, anon;

grant execute on function public.record_session_participant_confirmation_v1(uuid, uuid, text, uuid, text, timestamptz)
  to service_role;
grant execute on function public.finalize_bilateral_session_confirmation_v1(uuid, timestamptz)
  to service_role;
grant execute on function public.auto_confirm_sessions(timestamptz)
  to service_role;
grant execute on function public.admin_resolve_session_confirmation_incident_v1(uuid, text, text, uuid)
  to authenticated, service_role;

comment on column public.financial_policy_versions.patient_auto_confirmation_days is
  'Days after the scheduled end before an absent patient confirmation is recorded automatically.';
comment on column public.financial_policy_versions.therapist_auto_confirmation_days is
  'Days after the scheduled end before an absent therapist confirmation is recorded automatically.';
comment on table public.session_confirmation_incidents is
  'Auditable financial hold opened by an immutable not-performed session report.';
comment on function public.auto_confirm_sessions(timestamptz) is
  'Idempotently records role-specific automatic confirmations at 7/30-day deadlines without using Zoom attendance as a payment gate.';

commit;
