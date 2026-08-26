begin;

select plan(21);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_patient_zoom_waiting_room_arrival_v1(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  'service role records an authoritative patient waiting-room arrival'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_patient_zoom_waiting_room_arrival_v1(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot write waiting-room arrival events directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.authorize_therapist_zoom_manual_end_v1(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  'service role can authorize the final provider termination'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.authorize_therapist_zoom_manual_end_v1(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot authorize final provider termination'
);

select ok(
  (
    public.build_video_session_access_state_v1(
      'confirmed',
      'paid',
      '2040-08-25T19:00:00Z',
      '2040-08-25T19:50:00Z',
      'active',
      true,
      '2040-08-25T19:30:00Z'
    )->>'availableUntil'
  )::timestamptz = '2040-08-25T19:50:00Z'::timestamptz,
  'therapist read model closes access exactly at the scheduled end'
);

insert into public.bookings (
  id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  starts_at,
  ends_at,
  timezone,
  status,
  payment_status,
  meeting_provider,
  version
)
values (
  '98800000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  '2040-08-25T19:00:00Z',
  '2040-08-25T19:50:00Z',
  'America/Sao_Paulo',
  'confirmed',
  'paid',
  'zoom',
  1
);

insert into public.session_payments (
  id,
  booking_id,
  patient_profile_id,
  therapist_profile_id,
  service_id,
  policy_version_id,
  gross_amount_cents,
  platform_commission_bps,
  platform_gross_commission_cents,
  therapist_amount_cents,
  currency,
  financial_status
)
values (
  '98800000-0000-4000-8000-000000000002',
  '98800000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000020',
  (select id from public.financial_policy_versions where is_active limit 1),
  17000,
  2000,
  3400,
  13600,
  'BRL',
  'paid'
);

insert into public.video_sessions (
  id,
  booking_id,
  environment,
  session_name,
  status,
  scheduled_starts_at,
  scheduled_ends_at,
  actual_started_at,
  provider_session_id,
  therapist_present
)
values (
  '98800000-0000-4000-8000-000000000003',
  '98800000-0000-4000-8000-000000000001',
  'development',
  'tes-zoom-rejoin-final-end-pgtap',
  'active',
  '2040-08-25T19:00:00Z',
  '2040-08-25T19:50:00Z',
  '2040-08-25T19:00:00Z',
  'provider-rejoin-final-end-pgtap',
  true
);

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-25T18:45:00Z'
  )->>'entitled',
  'true',
  'waiting room opens and records arrival exactly at T-15'
);

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-25T19:09:00Z'
  )->>'recorded',
  'false',
  'repeated arrival is an idempotent replay'
);

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-25T19:30:00Z'
  )->>'entitled',
  'true',
  'a timely arrival preserves re-entry after T+10 until the scheduled end'
);

select is(
  (
    select count(*)::text
    from public.booking_events
    where booking_id = '98800000-0000-4000-8000-000000000001'
      and event_type = 'zoom_waiting_room_entered'
  ),
  '1',
  'idempotent arrival stores one event for the booking version'
);

update public.bookings
set version = 2,
    starts_at = '2040-08-25T21:00:00Z',
    ends_at = '2040-08-25T21:50:00Z'
where id = '98800000-0000-4000-8000-000000000001';

update public.video_sessions
set scheduled_starts_at = '2040-08-25T21:00:00Z',
    scheduled_ends_at = '2040-08-25T21:50:00Z'
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-25T21:10:00Z'
  )->>'entitled',
  'true',
  'arrival remains inclusive exactly at T+10 for the current version'
);

update public.bookings
set version = 3,
    starts_at = '2040-08-25T23:00:00Z',
    ends_at = '2040-08-25T23:50:00Z'
where id = '98800000-0000-4000-8000-000000000001';

update public.video_sessions
set scheduled_starts_at = '2040-08-25T23:00:00Z',
    scheduled_ends_at = '2040-08-25T23:50:00Z'
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-25T23:10:00.001Z'
  )->>'entitled',
  'false',
  'a previous booking version is not reused and T+10+1 ms is blocked'
);

select throws_ok(
  $$select public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000099',
    '2040-08-25T23:00:00Z'
  )$$,
  '42501',
  'ZOOM_WAITING_ROOM_PARTICIPANT_REQUIRED',
  'arrival validates patient ownership'
);

update public.bookings
set starts_at = '2040-08-26T01:00:00Z',
    ends_at = '2040-08-26T01:50:00Z',
    version = 4
where id = '98800000-0000-4000-8000-000000000001';

update public.video_sessions
set scheduled_starts_at = '2040-08-26T01:00:00Z',
    scheduled_ends_at = '2040-08-26T01:50:00Z'
where booking_id = '98800000-0000-4000-8000-000000000001';

update public.session_payments
set financial_status = 'pending'
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-26T01:00:00Z'
  )->>'entitled',
  'false',
  'unpaid bookings cannot record arrival'
);

update public.session_payments
set financial_status = 'paid'
where booking_id = '98800000-0000-4000-8000-000000000001';

update public.bookings
set starts_at = '2040-08-26T03:00:00Z',
    ends_at = '2040-08-26T03:50:00Z',
    version = 5
where id = '98800000-0000-4000-8000-000000000001';

update public.video_sessions
set status = 'active',
    scheduled_starts_at = '2040-08-26T03:00:00Z',
    scheduled_ends_at = '2040-08-26T03:50:00Z',
    actual_ended_at = null,
    termination_reason = null,
    termination_requested_at = null,
    termination_confirmed_at = null
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.authorize_therapist_zoom_manual_end_v1(
    '98800000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '2040-08-26T03:44:59.999Z'
  )->>'reason',
  'FINAL_END_TOO_EARLY',
  'final end is rejected one millisecond before T-5'
);

select is(
  public.authorize_therapist_zoom_manual_end_v1(
    '98800000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '2040-08-26T03:45:00Z'
  )->>'allowed',
  'true',
  'final end is authorized exactly at T-5'
);

select is(
  public.authorize_therapist_zoom_manual_end_v1(
    '98800000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '2040-08-26T03:45:00.001Z'
  )->>'reason',
  'FINAL_END_IN_PROGRESS',
  'a concurrent final-end attempt cannot duplicate the provider command'
);

update public.video_sessions
set status = 'ended',
    actual_ended_at = '2040-08-26T03:46:00Z',
    termination_confirmed_at = '2040-08-26T03:46:00Z'
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.authorize_therapist_zoom_manual_end_v1(
    '98800000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '2040-08-26T03:50:00Z'
  )->>'alreadyEnded',
  'true',
  'confirmed final end replays idempotently'
);

update public.video_sessions
set actual_ended_at = '2040-08-26T03:40:00Z',
    termination_confirmed_at = '2040-08-26T03:40:00Z'
where booking_id = '98800000-0000-4000-8000-000000000001';

select is(
  public.authorize_therapist_zoom_manual_end_v1(
    '98800000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '2040-08-26T03:47:00Z'
  )->>'reason',
  'EARLY_PROVIDER_END',
  'an early provider end cannot confirm completion in the final window'
);

select is(
  public.session_attendance_state_v1(
    '98800000-0000-4000-8000-000000000001',
    '2040-08-26T03:47:00Z'
  )->>'sessionClosed',
  'false',
  'early provider end keeps completion feedback closed'
);

select is(
  public.session_attendance_state_v1(
    '98800000-0000-4000-8000-000000000001',
    '2040-08-26T03:50:00Z'
  )->>'sessionClosed',
  'true',
  'scheduled end remains the final feedback authority'
);

update public.bookings
set status = 'cancelled_by_patient'
where id = '98800000-0000-4000-8000-000000000001';

select is(
  public.record_patient_zoom_waiting_room_arrival_v1(
    '98800000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '2040-08-26T03:45:00Z'
  )->>'entitled',
  'false',
  'cancelled bookings cannot record arrival'
);

select * from finish();
rollback;
