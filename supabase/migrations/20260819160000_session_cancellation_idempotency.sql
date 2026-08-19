-- A cancellation decision is a financial command. Its request identity must
-- survive browser retries and concurrent Edge Function invocations so that one
-- booking cannot produce more than one refund decision.

alter table public.session_cancellation_decisions
  add column if not exists request_id uuid,
  add column if not exists requested_by_role text;

update public.session_cancellation_decisions
set request_id = gen_random_uuid()
where request_id is null;

update public.session_cancellation_decisions as decision
set requested_by_role = case
  when exists (
    select 1
    from public.bookings as booking
    join public.patient_profiles as patient
      on patient.id = booking.patient_profile_id
    where booking.id = decision.booking_id
      and patient.user_id = decision.requested_by_profile_id
  ) then 'patient'
  when exists (
    select 1
    from public.bookings as booking
    join public.therapist_profiles as therapist
      on therapist.id = booking.therapist_profile_id
    where booking.id = decision.booking_id
      and therapist.user_id = decision.requested_by_profile_id
  ) then 'therapist'
  else 'admin'
end
where requested_by_role is null;

alter table public.session_cancellation_decisions
  alter column request_id set not null,
  alter column requested_by_role set not null;

alter table public.session_cancellation_decisions
  drop constraint if exists session_cancellation_decisions_requested_by_role_check;

alter table public.session_cancellation_decisions
  add constraint session_cancellation_decisions_requested_by_role_check
  check (requested_by_role in ('admin', 'patient', 'therapist'));

create unique index if not exists session_cancellation_decisions_request_id_key
on public.session_cancellation_decisions (request_id);

create or replace function public.claim_session_cancellation_decision_v1(
  p_booking_id uuid,
  p_session_payment_id uuid,
  p_policy_version_id uuid,
  p_requested_by_profile_id uuid,
  p_requested_by_role text,
  p_request_id uuid,
  p_reason text,
  p_decision text,
  p_refund_amount_cents integer,
  p_retained_amount_cents integer,
  p_therapist_retained_cents integer,
  p_platform_retained_cents integer,
  p_requires_manual_review boolean,
  p_review_due_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  booking_id uuid,
  request_id uuid,
  requested_by_profile_id uuid,
  requested_by_role text,
  session_payment_id uuid,
  policy_version_id uuid,
  reason text,
  decision text,
  refund_amount_cents integer,
  retained_amount_cents integer,
  therapist_retained_cents integer,
  platform_retained_cents integer,
  requires_manual_review boolean,
  review_due_at timestamptz,
  created_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_existing public.session_cancellation_decisions%rowtype;
begin
  if p_requested_by_role not in ('admin', 'patient', 'therapist') then
    raise exception 'INVALID_CANCELLATION_ACTOR_ROLE' using errcode = '22023';
  end if;

  if p_reason is null
    or length(trim(p_reason)) = 0
    or p_decision is null
    or length(trim(p_decision)) = 0
    or p_refund_amount_cents < 0
    or p_retained_amount_cents < 0
    or p_therapist_retained_cents < 0
    or p_platform_retained_cents < 0
    or p_retained_amount_cents <> p_therapist_retained_cents + p_platform_retained_cents then
    raise exception 'INVALID_CANCELLATION_DECISION' using errcode = '22023';
  end if;

  select *
    into v_existing
  from public.session_cancellation_decisions as cancellation
  where cancellation.request_id = p_request_id
  for update;

  if found then
    if v_existing.booking_id <> p_booking_id
      or v_existing.requested_by_profile_id is distinct from p_requested_by_profile_id
      or v_existing.requested_by_role <> p_requested_by_role then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;

    return query
    select
      v_existing.id,
      v_existing.booking_id,
      v_existing.request_id,
      v_existing.requested_by_profile_id,
      v_existing.requested_by_role,
      v_existing.session_payment_id,
      v_existing.policy_version_id,
      v_existing.reason,
      v_existing.decision,
      v_existing.refund_amount_cents,
      v_existing.retained_amount_cents,
      v_existing.therapist_retained_cents,
      v_existing.platform_retained_cents,
      v_existing.requires_manual_review,
      v_existing.review_due_at,
      false;
    return;
  end if;

  select *
    into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select *
    into v_existing
  from public.session_cancellation_decisions as cancellation
  where cancellation.booking_id = p_booking_id
  order by cancellation.created_at desc, cancellation.id desc
  limit 1
  for update;

  if found then
    return query
    select
      v_existing.id,
      v_existing.booking_id,
      v_existing.request_id,
      v_existing.requested_by_profile_id,
      v_existing.requested_by_role,
      v_existing.session_payment_id,
      v_existing.policy_version_id,
      v_existing.reason,
      v_existing.decision,
      v_existing.refund_amount_cents,
      v_existing.retained_amount_cents,
      v_existing.therapist_retained_cents,
      v_existing.platform_retained_cents,
      v_existing.requires_manual_review,
      v_existing.review_due_at,
      false;
    return;
  end if;

  insert into public.session_cancellation_decisions (
    booking_id,
    session_payment_id,
    policy_version_id,
    requested_by_profile_id,
    requested_by_role,
    request_id,
    reason,
    decision,
    refund_amount_cents,
    retained_amount_cents,
    therapist_retained_cents,
    platform_retained_cents,
    requires_manual_review,
    review_due_at,
    metadata
  ) values (
    p_booking_id,
    p_session_payment_id,
    p_policy_version_id,
    p_requested_by_profile_id,
    p_requested_by_role,
    p_request_id,
    trim(p_reason),
    trim(p_decision),
    p_refund_amount_cents,
    p_retained_amount_cents,
    p_therapist_retained_cents,
    p_platform_retained_cents,
    p_requires_manual_review,
    p_review_due_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_existing;

  return query
  select
    v_existing.id,
    v_existing.booking_id,
    v_existing.request_id,
    v_existing.requested_by_profile_id,
    v_existing.requested_by_role,
    v_existing.session_payment_id,
    v_existing.policy_version_id,
    v_existing.reason,
    v_existing.decision,
    v_existing.refund_amount_cents,
    v_existing.retained_amount_cents,
    v_existing.therapist_retained_cents,
    v_existing.platform_retained_cents,
    v_existing.requires_manual_review,
    v_existing.review_due_at,
    true;
end;
$$;

revoke execute on function public.claim_session_cancellation_decision_v1(
  uuid, uuid, uuid, uuid, text, uuid, text, text, integer, integer, integer,
  integer, boolean, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.claim_session_cancellation_decision_v1(
  uuid, uuid, uuid, uuid, text, uuid, text, text, integer, integer, integer,
  integer, boolean, timestamptz, jsonb
) to service_role;

comment on function public.claim_session_cancellation_decision_v1(
  uuid, uuid, uuid, uuid, text, uuid, text, text, integer, integer, integer,
  integer, boolean, timestamptz, jsonb
) is 'Atomically claims one cancellation decision per booking and replays the original financial command for retries.';
