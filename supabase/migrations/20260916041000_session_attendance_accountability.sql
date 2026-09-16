-- Attendance accountability is evidence-led and financially fail-closed.
-- This migration does not activate fee recovery or double-no-show retention;
-- both remain gated by a future, inactive policy and legal publication.

alter table public.session_confirmation_incidents
  add column if not exists booking_version integer,
  add column if not exists classification text,
  add column if not exists classification_source text,
  add column if not exists patient_arrived_at timestamptz,
  add column if not exists therapist_arrived_at timestamptz,
  add column if not exists patient_joined_at timestamptz,
  add column if not exists therapist_joined_at timestamptz,
  add column if not exists review_due_at timestamptz,
  add column if not exists policy_version_id uuid
    references public.financial_policy_versions(id) on delete restrict,
  add column if not exists responsibility text,
  add column if not exists operational_resolution text,
  add column if not exists financial_resolution text,
  add column if not exists retention_authorized boolean not null default false,
  add column if not exists processing_cost_recovery_authorized boolean not null default false,
  add column if not exists evidence jsonb not null default '{}'::jsonb;

update public.session_confirmation_incidents as incident
set booking_version = booking.version,
    policy_version_id = payment.policy_version_id,
    review_due_at = coalesce(
      incident.review_due_at,
      incident.created_at + make_interval(days => policy.manual_review_response_days)
    ),
    classification = coalesce(incident.classification, 'participant_report'),
    classification_source = coalesce(incident.classification_source, 'participant_report'),
    responsibility = coalesce(incident.responsibility, 'unassigned'),
    financial_resolution = coalesce(incident.financial_resolution, 'pending')
from public.bookings as booking
join public.session_payments as payment on payment.booking_id = booking.id
join public.financial_policy_versions as policy on policy.id = payment.policy_version_id
where booking.id = incident.booking_id;

alter table public.session_confirmation_incidents
  alter column booking_version set not null;

alter table public.session_confirmation_incidents
  drop constraint if exists session_confirmation_incidents_booking_id_key;
drop index if exists public.session_confirmation_incidents_booking_id_key;

create unique index if not exists session_confirmation_incidents_booking_version_uidx
  on public.session_confirmation_incidents (booking_id, booking_version);

alter table public.session_confirmation_incidents
  drop constraint if exists session_confirmation_incidents_classification_check,
  drop constraint if exists session_confirmation_incidents_source_check,
  drop constraint if exists session_confirmation_incidents_responsibility_check,
  drop constraint if exists session_confirmation_incidents_operational_resolution_check,
  drop constraint if exists session_confirmation_incidents_financial_resolution_check;

alter table public.session_confirmation_incidents
  add constraint session_confirmation_incidents_classification_check check (
    classification is null or classification in (
      'participant_report', 'no_show_therapist', 'no_show_both', 'requires_review'
    )
  ),
  add constraint session_confirmation_incidents_source_check check (
    classification_source is null or classification_source in (
      'authenticated_waiting_room', 'trusted_zoom_join',
      'combined_attendance_evidence', 'system_tolerance_window',
      'participant_report', 'historical_review'
    )
  ),
  add constraint session_confirmation_incidents_responsibility_check check (
    responsibility is null or responsibility in (
      'unassigned', 'patient', 'therapist', 'both', 'platform', 'inconclusive'
    )
  ),
  add constraint session_confirmation_incidents_operational_resolution_check check (
    operational_resolution is null or operational_resolution in (
      'performed', 'reschedule', 'refund', 'retain', 'platform_failure'
    )
  ),
  add constraint session_confirmation_incidents_financial_resolution_check check (
    financial_resolution is null or financial_resolution in (
      'pending', 'reschedule_pending', 'rescheduled', 'refund_pending',
      'refunded', 'retained', 'no_action'
    )
  );

create index if not exists session_confirmation_incidents_attendance_review_idx
  on public.session_confirmation_incidents (review_due_at, created_at)
  where status = 'open'
    and classification in ('no_show_therapist', 'no_show_both', 'requires_review');

-- Participants may read only the sanitized incident associated with their own
-- booking. Mutations remain service-role/admin RPC only.
grant select (
  id, booking_id, booking_version, classification, classification_source,
  patient_arrived_at, therapist_arrived_at, patient_joined_at,
  therapist_joined_at, review_due_at, status, responsibility,
  operational_resolution, financial_resolution, retention_authorized,
  processing_cost_recovery_authorized, created_at, resolved_at
) on public.session_confirmation_incidents to authenticated;

drop policy if exists "Participants can read own attendance incidents"
  on public.session_confirmation_incidents;
create policy "Participants can read own attendance incidents"
on public.session_confirmation_incidents for select to authenticated
using (
  exists (
    select 1
    from public.bookings as booking
    join public.patient_profiles as patient on patient.id = booking.patient_profile_id
    join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
    where booking.id = session_confirmation_incidents.booking_id
      and (patient.user_id = (select auth.uid())
        or therapist.user_id = (select auth.uid()))
  )
  or exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'::public.user_role
      and profile.auth_deleted_at is null
      and profile.anonymized_at is null
  )
);

-- Inactive future contract. It is intentionally not selected by any checkout
-- until legal documents are published and immutable acceptances are required.
insert into public.financial_policy_versions (
  version, policy_key, is_active, currency, platform_commission_bps,
  auto_confirmation_days, patient_auto_confirmation_days,
  therapist_auto_confirmation_days, transfer_safety_period_days,
  free_cancellation_hours, late_cancellation_retention_bps,
  no_show_retention_bps, refund_processing_business_days,
  manual_review_response_days, weekly_batch_weekday, weekly_batch_time,
  timezone, payout_batch_rule, cancellation_policy_key, refund_policy_key,
  proration_policy_key, upgrade_proration_behavior, downgrade_behavior,
  subscription_cancellation_behavior, metadata, effective_from
)
select
  'tes-payments-v11-attendance-accountability',
  'tes-payments-v11-attendance-accountability',
  false, policy.currency, policy.platform_commission_bps,
  policy.auto_confirmation_days, policy.patient_auto_confirmation_days,
  policy.therapist_auto_confirmation_days, policy.transfer_safety_period_days,
  policy.free_cancellation_hours, policy.late_cancellation_retention_bps,
  policy.no_show_retention_bps, policy.refund_processing_business_days,
  policy.manual_review_response_days, policy.weekly_batch_weekday,
  policy.weekly_batch_time, policy.timezone, policy.payout_batch_rule,
  'attendance_accountability_requires_published_legal_terms',
  'attendance_refund_reversal_and_versioned_cost_recovery',
  policy.proration_policy_key, policy.upgrade_proration_behavior,
  policy.downgrade_behavior, policy.subscription_cancellation_behavior,
  coalesce(policy.metadata, '{}'::jsonb) || jsonb_build_object(
    'activation', 'blocked_pending_legal_approval',
    'supersedesWhenActivated', policy.policy_key,
    'doubleNoShowRetention', true,
    'doubleNoShowRetentionOperationalActivation', 'pending',
    'attendanceProcessingCostRecovery', true,
    'attendanceProcessingCostBasis', 'reconciled_stripe_fee_only',
    'retroactiveApplication', false,
    'legalActivation', 'pending'
  ),
  timestamptz '2026-09-16 00:00:00-03'
from public.financial_policy_versions as policy
where policy.policy_key = 'tes-payments-v10-setup-t24-immediate-transfer'
on conflict (policy_key) do update
set is_active = false,
    metadata = excluded.metadata;

alter table public.therapist_financial_debts
  add column if not exists session_confirmation_incident_id uuid
    references public.session_confirmation_incidents(id) on delete restrict;

alter table public.therapist_financial_debts
  drop constraint if exists therapist_financial_debts_origin_check;
alter table public.therapist_financial_debts
  add constraint therapist_financial_debts_origin_check check (
    origin in (
      'refund', 'dispute', 'transfer_reversal_shortfall', 'manual_adjustment',
      'attendance_transfer_recovery', 'attendance_processing_cost'
    )
  );

create unique index if not exists therapist_financial_debts_attendance_nature_uidx
  on public.therapist_financial_debts (
    session_payment_id, session_confirmation_incident_id, origin
  )
  where session_payment_id is not null
    and session_confirmation_incident_id is not null
    and origin in ('attendance_transfer_recovery', 'attendance_processing_cost');

create or replace function public.record_zoom_waiting_room_arrival_v2(
  p_booking_id uuid,
  p_participant_profile_id uuid,
  p_participant_role public.user_role,
  p_now timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_arrived_at timestamptz;
  v_request_id text;
begin
  if p_participant_role not in ('patient'::public.user_role, 'therapist'::public.user_role) then
    raise exception 'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_booking_id::text, 0)
  );

  select booking.*, patient.user_id as patient_user_id,
    therapist.user_id as therapist_user_id, payment.financial_status
  into v_booking
  from public.bookings as booking
  join public.patient_profiles as patient on patient.id = booking.patient_profile_id
  join public.therapist_profiles as therapist on therapist.id = booking.therapist_profile_id
  left join public.session_payments as payment on payment.booking_id = booking.id
  where booking.id = p_booking_id;

  if not found then
    raise exception 'ZOOM_BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if (p_participant_role = 'patient' and v_booking.patient_profile_id <> p_participant_profile_id)
    or (p_participant_role = 'therapist' and v_booking.therapist_profile_id <> p_participant_profile_id)
  then
    raise exception 'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;

  select min(event.created_at) into v_arrived_at
  from public.booking_events as event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_booking.starts_at
    and coalesce(event.payload ->> 'participantRole', 'patient') = p_participant_role::text;

  if v_arrived_at is not null then
    return jsonb_build_object('arrivedAt', v_arrived_at, 'entitled', true, 'recorded', false);
  end if;

  if v_booking.status <> 'confirmed'::public.booking_status
    or v_booking.meeting_provider not in ('zoom', 'zoom_video_sdk')
    or v_booking.financial_status is distinct from 'paid'::public.session_financial_status
    or v_now < v_booking.starts_at - interval '15 minutes'
    or v_now > v_booking.starts_at + interval '10 minutes'
    or v_now >= v_booking.ends_at
  then
    return jsonb_build_object('arrivedAt', null, 'entitled', false, 'recorded', false);
  end if;

  v_request_id := left(
    'zoom-waiting-room:' || p_participant_role::text || ':' || v_booking.id::text ||
      ':v' || v_booking.version::text || ':' ||
      floor(extract(epoch from v_booking.starts_at) * 1000)::bigint::text,
    160
  );

  insert into public.booking_events (
    booking_id, actor_profile_id, event_type, payload, request_id, source
  ) values (
    v_booking.id,
    case p_participant_role
      when 'patient' then v_booking.patient_user_id
      else v_booking.therapist_user_id
    end,
    'zoom_waiting_room_entered',
    jsonb_build_object(
      'bookingVersion', v_booking.version,
      'scheduledStartsAt', v_booking.starts_at,
      'participantRole', p_participant_role::text,
      'source', 'authenticated_waiting_room'
    ),
    v_request_id,
    'zoom-video-session-access'
  )
  on conflict (booking_id, event_type, request_id)
    where request_id is not null do nothing;

  select min(event.created_at) into v_arrived_at
  from public.booking_events as event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_booking.starts_at
    and coalesce(event.payload ->> 'participantRole', 'patient') = p_participant_role::text;

  return jsonb_build_object(
    'arrivedAt', v_arrived_at,
    'entitled', v_arrived_at is not null,
    'recorded', v_arrived_at is not null
  );
end;
$$;

create or replace function public.record_patient_zoom_waiting_room_arrival_v1(
  p_booking_id uuid,
  p_patient_profile_id uuid,
  p_now timestamptz default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.record_zoom_waiting_room_arrival_v2(
    p_booking_id, p_patient_profile_id, 'patient'::public.user_role, p_now
  );
$$;

revoke all on function public.record_zoom_waiting_room_arrival_v2(uuid, uuid, public.user_role, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_zoom_waiting_room_arrival_v2(uuid, uuid, public.user_role, timestamptz)
  to service_role;

-- Returns arrival and trusted join evidence separately. A join only counts for
-- T+10 classification when it occurred within the current booking window.
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
  v_booking public.bookings%rowtype;
  v_video_session public.video_sessions%rowtype;
  v_incident public.session_confirmation_incidents%rowtype;
  v_patient_arrived_at timestamptz;
  v_therapist_arrived_at timestamptz;
  v_patient_joined_at timestamptz;
  v_therapist_joined_at timestamptz;
  v_closed boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    return jsonb_build_object('available', false, 'classification', null);
  end if;

  select * into v_video_session
  from public.video_sessions where booking_id = p_booking_id limit 1;

  select min(event.created_at) filter (
      where coalesce(event.payload ->> 'participantRole', 'patient') = 'patient'
    ),
    min(event.created_at) filter (
      where event.payload ->> 'participantRole' = 'therapist'
    )
  into v_patient_arrived_at, v_therapist_arrived_at
  from public.booking_events as event
  where event.booking_id = v_booking.id
    and event.event_type = 'zoom_waiting_room_entered'
    and event.payload ->> 'bookingVersion' = v_booking.version::text
    and (event.payload ->> 'scheduledStartsAt')::timestamptz = v_booking.starts_at;

  select min(coalesce(participation.joined_at, participation.created_at)) filter (
      where participation.participant_role = 'patient'::public.video_session_participant_role
    ),
    min(coalesce(participation.joined_at, participation.created_at)) filter (
      where participation.participant_role = 'therapist'::public.video_session_participant_role
    )
  into v_patient_joined_at, v_therapist_joined_at
  from public.video_session_participations as participation
  where participation.video_session_id = v_video_session.id
    and participation.event_type = 'session.user_joined'
    and coalesce(participation.joined_at, participation.created_at)
      between v_video_session.scheduled_starts_at - interval '15 minutes'
        and v_video_session.scheduled_ends_at;

  select * into v_incident
  from public.session_confirmation_incidents as incident
  where incident.booking_id = v_booking.id
  order by incident.booking_version desc, incident.created_at desc
  limit 1;

  v_closed := p_now >= v_video_session.scheduled_ends_at
    or (v_video_session.id is not null
      and v_video_session.status in ('ended', 'canceled', 'failed')
      and v_video_session.actual_ended_at is not null
      and v_video_session.actual_ended_at >=
        v_video_session.scheduled_ends_at - interval '5 minutes');

  return jsonb_build_object(
    'available', true,
    'incidentId', v_incident.id,
    'bookingVersion', v_booking.version,
    'classification', coalesce(v_incident.classification,
      case v_booking.status
        when 'no_show_patient' then 'no_show_patient'
        when 'no_show_therapist' then 'no_show_therapist'
        when 'no_show_both' then 'no_show_both'
        else null
      end),
    'classificationSource', v_incident.classification_source,
    'reviewDueAt', v_incident.review_due_at,
    'responsibility', v_incident.responsibility,
    'resolution', v_incident.operational_resolution,
    'financialResolution', v_incident.financial_resolution,
    'retentionAuthorized', v_incident.retention_authorized,
    'processingCostRecoveryAuthorized',
      v_incident.processing_cost_recovery_authorized,
    'patientArrivedAt', v_patient_arrived_at,
    'therapistArrivedAt', v_therapist_arrived_at,
    'patientJoinedAt', v_patient_joined_at,
    'therapistJoinedAt', v_therapist_joined_at,
    'patientPresentAtTolerance',
      v_patient_arrived_at is not null
      or coalesce(v_patient_joined_at <= v_booking.starts_at + interval '10 minutes', false),
    'therapistPresentAtTolerance',
      v_therapist_arrived_at is not null
      or coalesce(v_therapist_joined_at <= v_booking.starts_at + interval '10 minutes', false),
    'patientJoined', v_patient_joined_at is not null,
    'therapistJoined', v_therapist_joined_at is not null,
    'bothJoined', v_patient_joined_at is not null and v_therapist_joined_at is not null,
    'sessionClosed', v_closed,
    'sessionStartedAt', v_video_session.scheduled_starts_at,
    'sessionStartsAt', v_video_session.scheduled_starts_at,
    'sessionEndsAt', v_video_session.scheduled_ends_at,
    'sessionEndedAt', v_video_session.actual_ended_at
  );
end;
$$;

-- Participant reports continue to use the same aggregate, now versioned.
create or replace function public.open_session_confirmation_incident_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_booking public.bookings%rowtype;
  v_policy public.financial_policy_versions%rowtype;
begin
  if new.outcome <> 'not_performed' then return new; end if;

  select * into v_booking from public.bookings where id = new.booking_id;
  select * into v_payment from public.session_payments
    where booking_id = new.booking_id for update;
  if v_payment.id is null then return new; end if;
  select * into v_policy from public.financial_policy_versions
    where id = v_payment.policy_version_id;

  insert into public.session_confirmation_incidents (
    booking_id, booking_version, session_payment_id, opened_by_feedback_id,
    reported_by_role, classification, classification_source, review_due_at,
    policy_version_id, responsibility, financial_resolution
  ) values (
    new.booking_id, v_booking.version, v_payment.id, new.id, new.author_role,
    'participant_report', 'participant_report',
    now() + make_interval(days => coalesce(v_policy.manual_review_response_days, 5)),
    v_payment.policy_version_id, 'unassigned', 'pending'
  )
  on conflict (booking_id, booking_version) do update
  set opened_by_feedback_id = coalesce(
        public.session_confirmation_incidents.opened_by_feedback_id,
        excluded.opened_by_feedback_id),
      reported_by_role = coalesce(
        public.session_confirmation_incidents.reported_by_role,
        excluded.reported_by_role),
      status = 'open', resolution_reason = null,
      resolved_by_user_id = null, resolution_request_id = null,
      resolved_at = null, updated_at = now();

  update public.session_payments
  set service_status = case when transfer_status in ('batched', 'transfer_pending', 'transferred')
        then service_status else 'not_performed'::public.session_service_status end,
      service_confirmed_at = case when transfer_status in ('batched', 'transfer_pending', 'transferred')
        then service_confirmed_at else null end,
      service_confirmation_source = case when transfer_status in ('batched', 'transfer_pending', 'transferred')
        then service_confirmation_source else null end,
      eligible_at = case when transfer_status in ('batched', 'transfer_pending', 'transferred')
        then eligible_at else null end,
      transfer_status = case when transfer_status in ('batched', 'transfer_pending', 'transferred')
        then transfer_status else 'blocked'::public.session_transfer_status end,
      transfer_blocked_reason = 'session_not_performed_reported',
      internal_contested_at = coalesce(internal_contested_at, now()),
      admin_blocked_at = coalesce(admin_blocked_at, now()),
      updated_at = now()
  where id = v_payment.id;
  return new;
end;
$$;

create or replace function public.is_booking_status_transition_allowed_v1(
  p_current public.booking_status,
  p_next public.booking_status
)
returns boolean language sql immutable set search_path = '' as $$
  select case p_current
    when 'draft' then p_next in ('pending_payment', 'cancelled_by_patient', 'cancelled_by_payment')
    when 'pending_payment' then p_next in ('confirmed', 'cancelled_by_patient', 'cancelled_by_payment', 'refunded')
    when 'confirmed' then p_next in (
      'completed', 'cancelled_by_patient', 'cancelled_by_therapist',
      'cancelled_by_payment', 'no_show_patient', 'no_show_therapist',
      'no_show_both', 'refunded'
    )
    when 'completed' then p_next = 'refunded'
    when 'cancelled_by_patient' then p_next = 'refunded'
    when 'cancelled_by_therapist' then p_next = 'refunded'
    when 'no_show_patient' then p_next = 'refunded'
    when 'no_show_therapist' then p_next in ('confirmed', 'refunded')
    when 'no_show_both' then p_next in ('confirmed', 'refunded')
    when 'cancelled_by_payment' then p_next = 'pending_payment'
    when 'refunded' then false
    else false
  end;
$$;

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
    order by booking.starts_at, booking.id
    for update of booking, payment skip locked
    limit p_limit
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_row.id::text, 0)
    );

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

-- A payment held for attendance review cannot be claimed by the V10 worker.
create or replace function public.claim_session_transfer_jobs_v10(
  p_now timestamptz,
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_claims jsonb;
begin
  if p_now is null or p_worker_id is null or p_limit not between 1 and 100
    or p_lease_minutes not between 1 and 30 then
    raise exception 'SESSION_TRANSFER_JOB_CLAIM_V10_INVALID' using errcode = '22023';
  end if;
  with candidates as (
    select job.id
    from public.session_transfer_jobs as job
    join public.session_payments as payment on payment.id = job.session_payment_id
    where payment.payment_flow_version = 'v10'
      and payment.financial_status = 'paid'
      and not payment.refund_pending
      and payment.admin_blocked_at is null
      and payment.internal_contested_at is null
      and job.status in ('queued', 'creating', 'reconciliation_required')
      and job.attempt_count < 8
      and coalesce(job.next_retry_at, job.created_at) <= p_now
      and (job.lease_expires_at is null or job.lease_expires_at <= p_now)
    order by coalesce(job.next_retry_at, job.created_at), job.id
    limit p_limit for update of job skip locked
  ), claimed as (
    update public.session_transfer_jobs as job
    set status = 'creating', attempt_count = job.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_expires_at = p_now + make_interval(mins => p_lease_minutes),
        updated_at = p_now
    from candidates where candidates.id = job.id returning job.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', claimed.id, 'sessionPaymentId', claimed.session_payment_id,
    'connectAccountId', claimed.connect_account_id,
    'stripeEnvironment', claimed.stripe_environment,
    'sourceChargeId', claimed.stripe_source_charge_id,
    'transferAmountCents', claimed.transfer_amount_cents,
    'idempotencyKey', claimed.idempotency_key,
    'requestFingerprint', claimed.request_fingerprint,
    'attemptCount', claimed.attempt_count,
    'leaseExpiresAt', claimed.lease_expires_at
  ) order by claimed.created_at, claimed.id), '[]'::jsonb)
  into v_claims from claimed;
  return jsonb_build_object('claims', v_claims, 'claimedAt', p_now);
end;
$$;

revoke all on function public.finalize_due_session_attendance_v1(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_due_session_attendance_v1(timestamptz, integer)
  to service_role;

revoke all on function public.claim_session_transfer_jobs_v10(timestamptz, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_session_transfer_jobs_v10(timestamptz, uuid, integer, integer)
  to service_role;

comment on function public.finalize_due_session_attendance_v1(timestamptz, integer) is
  'Classifies current-version attendance after T+10 from authenticated arrivals and trusted Zoom joins, opening financial review without calling Stripe.';
