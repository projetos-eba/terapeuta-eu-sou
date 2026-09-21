-- Local-only, disposable proof of one-submit quality plus own attendance.
-- Run only against the named local Docker container; never run in HML.
begin;

do $$ begin
  if not exists (
    select 1 from auth.users actor
    join public.patient_profiles patient on patient.user_id = actor.id
    where patient.id = '91000000-0000-4000-8000-000000000001'
      and actor.email = 'carlos.paciente@example.test'
  ) then
    raise exception 'PHASE7_BROWSER_LOCAL_SEED_REQUIRED';
  end if;
  if exists (select 1 from public.bookings where id = 'b7f70000-0000-4000-8000-000000000002') then
    raise exception 'PHASE7_BROWSER_FIXTURE_ALREADY_EXISTS';
  end if;
end $$;

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
) values (
  'b7f70000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  now() - interval '5 hours', now() - interval '280 minutes',
  'America/Sao_Paulo', 'confirmed', 'paid'
);

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, currency,
  financial_status, service_status, transfer_status,
  stripe_charge_id, stripe_balance_transaction_id, paid_at
) values (
  'b7e70000-0000-4000-8000-000000000002',
  'b7f70000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  (select id from public.financial_policy_versions where is_active),
  17000, 1500, 2550, 14450, 'BRL',
  'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
  'ch_local_phase7_quality_browser_2', 'txn_local_phase7_quality_browser_2',
  now() - interval '5 hours'
);

select public.ensure_video_session_for_paid_booking_v1(
  'b7f70000-0000-4000-8000-000000000002', 'development', 'phase7-quality-browser-local'
);
update public.booking_session_attempts
set created_at = (select starts_at - interval '1 day' from public.bookings
  where id = 'b7f70000-0000-4000-8000-000000000002')
where id = public.current_session_attempt_id_v1('b7f70000-0000-4000-8000-000000000002');

update public.video_sessions session
set scheduled_starts_at = booking.starts_at,
    scheduled_ends_at = booking.ends_at,
    status = 'ended', actual_started_at = booking.starts_at,
    actual_ended_at = booking.ends_at,
    termination_reason = null, termination_requested_at = null,
    termination_confirmed_at = null, metadata = '{}'
from public.bookings booking
where session.booking_id = booking.id
  and booking.id = 'b7f70000-0000-4000-8000-000000000002';

insert into public.video_session_participations (
  video_session_id, booking_id, participant_correlation_key,
  participant_role, event_type, joined_at, metadata
)
select session.id, booking.id, 'phase7-browser-' || participant.role,
  participant.role::public.video_session_participant_role,
  'session.user_joined', booking.starts_at + interval '1 minute', '{}'
from public.video_sessions session
join public.bookings booking on booking.id = session.booking_id
cross join (values ('patient'), ('therapist')) participant(role)
where booking.id = 'b7f70000-0000-4000-8000-000000000002';

do $$ begin
  if coalesce((public.session_attempt_evidence_v1(
    'b7f70000-0000-4000-8000-000000000002')->>'bothJoined')::boolean, false) is false
    or coalesce((public.session_attempt_evidence_v1(
    'b7f70000-0000-4000-8000-000000000002')->>'sessionClosed')::boolean, false) is false
    or public.session_attempt_evidence_v1(
    'b7f70000-0000-4000-8000-000000000002')->>'classification' is not null then
    raise exception 'PHASE7_BROWSER_EVIDENCE_INVALID';
  end if;
end $$;
commit;
