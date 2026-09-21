-- A non-performance report augments the classified encounter, not a new
-- incident created by the status-only version increment. Reschedules are isolated.
begin;
create or replace function public.open_session_confirmation_incident_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.session_payments%rowtype;
  v_booking public.bookings%rowtype;
  v_attendance_version integer;
  v_policy public.financial_policy_versions%rowtype;
begin
  if new.outcome <> 'not_performed' then return new; end if;

  select * into v_booking from public.bookings where id = new.booking_id;
  v_attendance_version := case
    when v_booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
      then v_booking.version - 1 else v_booking.version end;
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
    new.booking_id, v_attendance_version, v_payment.id, new.id, new.author_role,
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

-- Project the versioned attendance incident into the therapist session contract.
-- The existing columns keep their names and order; review fields are appended.

create or replace view public.therapist_session_read_model_v1
with (security_invoker = true)
as
select
  booking.id as "bookingId",
  booking.therapist_profile_id as "_therapistProfileId",
  booking.patient_profile_id as "patientProfileId",
  patient.display_name as "patientName",
  patient.avatar_url as "patientAvatarUrl",
  booking.service_id as "serviceId",
  booking.service_title_snapshot as "serviceTitle",
  booking.service_duration_minutes_snapshot as "durationMinutes",
  booking.service_price_cents_snapshot as "priceCents",
  booking.currency_snapshot as "currency",
  booking.starts_at as "startsAt",
  booking.ends_at as "endsAt",
  booking.timezone,
  booking.status as "bookingStatus",
  booking.version as "bookingVersion",
  case when service.online_only then 'online' else 'in_person' end as modality,
  payment.financial_status as "financialStatus",
  payment.service_status as "fulfillmentStatus",
  payment.transfer_status as "transferStatus",
  payment.gross_amount_cents as "grossAmountCents",
  payment.therapist_amount_cents as "therapistAmountCents",
  payment.refund_pending as "refundPending",
  case
    when incident.classification = 'requires_review' then 'requires_review'
    when incident.classification = 'no_show_both' then 'both_no_show'
    when incident.classification = 'no_show_therapist' then 'therapist_no_show'
    when booking.status = 'no_show_patient' then 'patient_no_show'
    when booking.status = 'no_show_therapist' then 'therapist_no_show'
    when booking.status = 'no_show_both' then 'both_no_show'
    else 'pending'
  end as "attendanceStatus",
  case
    when incident.classification = 'requires_review' then 'administrative_review'
    when incident.classification is not null then 'authoritative_evidence'
    when booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
      then 'booking_compatibility'
    else 'unavailable'
  end as "attendanceSource",
  reschedule.status as "rescheduleStatus",
  reschedule.proposed_starts_at as "proposedStartsAt",
  reschedule.proposed_ends_at as "proposedEndsAt",
  reschedule.proposed_timezone as "proposedTimezone",
  cancellation.decision as "cancellationDecision",
  cancellation.requires_manual_review as "cancellationRequiresReview",
  video_session.status as "videoSessionStatus",
  video_session.provider as "videoSessionProvider",
  (video_session.id is not null and video_session.status in ('ready', 'active'))
    as "_videoSessionReady",
  booking.session_reference as "sessionReference",
  incident.id as "attendanceIncidentId",
  incident.status as "attendanceReviewStatus",
  incident.review_due_at as "attendanceReviewDueAt",
  incident.responsibility as "attendanceResponsibility",
  incident.operational_resolution as "attendanceResolution",
  incident.financial_resolution as "attendanceFinancialResolution"
from public.bookings as booking
join public.patient_profiles as patient on patient.id = booking.patient_profile_id
join public.therapist_services as service on service.id = booking.service_id
left join public.session_payments as payment on payment.booking_id = booking.id
left join lateral (
  select request.status, request.proposed_starts_at, request.proposed_ends_at,
    request.proposed_timezone
  from public.booking_reschedule_requests as request
  where request.booking_id = booking.id
  order by (request.status = 'pending') desc, request.created_at desc
  limit 1
) as reschedule on true
left join lateral (
  select decision.decision, decision.requires_manual_review
  from public.session_cancellation_decisions as decision
  where decision.booking_id = booking.id
  order by decision.created_at desc
  limit 1
) as cancellation on true
left join public.video_sessions as video_session on video_session.booking_id = booking.id
left join lateral (
  select attendance.id, attendance.booking_version,
    attendance.classification, attendance.status, attendance.review_due_at,
    attendance.responsibility, attendance.operational_resolution,
    attendance.financial_resolution, attendance.created_at
  from public.session_confirmation_incidents as attendance
  where attendance.booking_id = booking.id
    and attendance.booking_version = case
      when booking.status in ('no_show_patient', 'no_show_therapist', 'no_show_both')
        then booking.version - 1 else booking.version end
  order by attendance.booking_version desc, attendance.created_at desc
  limit 1
) as incident on true
where public.is_current_therapist_profile(booking.therapist_profile_id);

grant select on public.therapist_session_read_model_v1 to authenticated;

comment on view public.therapist_session_read_model_v1 is
  'Private therapist session read model with current-version attendance classification and administrative review state.';
commit;

