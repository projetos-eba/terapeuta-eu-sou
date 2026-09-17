begin;

select plan(18);

create temporary table therapist_change_slots as
with payload as (
  select public.get_booking_reschedule_availability_v1(
    'f2000000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000001',
    'next', null, 20
  ) as value
)
select
  slot."startsAt" as starts_at,
  slot."endsAt" as ends_at,
  payload.value ->> 'timezone' as timezone
from payload
cross join lateral jsonb_to_recordset(payload.value -> 'slots')
  as slot("startsAt" timestamptz, "endsAt" timestamptz)
limit 3;

update public.bookings
set starts_at = (select starts_at from therapist_change_slots offset 0 limit 1),
    ends_at = (select ends_at from therapist_change_slots offset 0 limit 1),
    timezone = (select timezone from therapist_change_slots offset 0 limit 1),
    updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000001';

select is(
  has_function_privilege(
    'authenticated',
    'public.open_therapist_booking_change_v1(uuid,uuid,text,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot open a therapist change directly'
);

select is(
  has_function_privilege(
    'service_role',
    'public.open_therapist_booking_change_v1(uuid,uuid,text,text,text,integer)',
    'EXECUTE'
  ),
  true,
  'the authenticated Edge Function can open a therapist change'
);

select is(
  (
    public.open_therapist_booking_change_v1(
      'f2000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'reschedule', 'Conflito de agenda.',
      'therapist-change-reschedule-0001',
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    ) ->> 'status'
  ),
  'pending',
  'the therapist can ask the patient to choose a new slot'
);

select is(
  (
    select change_kind from public.booking_reschedule_requests
    where request_id = 'therapist-change-reschedule-0001'
  ),
  'therapist_reschedule',
  'the workflow distinguishes a therapist reschedule request'
);

select ok(
  (
    select proposed_starts_at is null and proposed_ends_at is null
    from public.booking_reschedule_requests
    where request_id = 'therapist-change-reschedule-0001'
  ),
  'the request begins without a therapist-selected slot'
);

select is(
  (
    select count(*)::integer from public.notifications
    where kind = 'booking_reschedule_requested_patient'
      and profile_id = 'bbbbbbbb-0000-4000-8000-000000000001'
  ),
  1,
  'the patient receives one unilateral notification about the change'
);

select ok(
  position(
    'request.status in (''pending'', ''pending_admin_review'')' in pg_get_functiondef(
      'public.reserve_video_session_control_jobs_v1(text,integer,integer)'::regprocedure
    )
  ) > 0,
  'a pending therapist change blocks automatic patient-no-show reservation'
);

select is(
  (
    public.open_therapist_booking_change_v1(
      'f2000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'reschedule', 'Conflito de agenda.',
      'therapist-change-reschedule-0001',
      null
    ) ->> 'rescheduleRequestId'
  )::uuid,
  (
    select id from public.booking_reschedule_requests
    where request_id = 'therapist-change-reschedule-0001'
  ),
  'repeating the same request is idempotent'
);

select is(
  (
    public.resolve_therapist_booking_change_v1(
      (select id from public.booking_reschedule_requests
        where request_id = 'therapist-change-reschedule-0001'),
      'bbbbbbbb-0000-4000-8000-000000000001',
      'reschedule',
      (select starts_at from therapist_change_slots offset 1 limit 1),
      (select ends_at from therapist_change_slots offset 1 limit 1),
      (select timezone from therapist_change_slots offset 1 limit 1),
      'therapist-change-choice-0001',
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    ) ->> 'status'
  ),
  'applied',
  'the patient can atomically apply an authoritative new slot'
);

select is(
  (select starts_at from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  (select starts_at from therapist_change_slots offset 1 limit 1),
  'the selected slot becomes the booking interval'
);

select is(
  (
    select count(*)::integer from public.session_payments
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  1,
  'applying the new slot creates no additional session payment'
);

select is(
  (
    public.open_therapist_booking_change_v1(
      'f2000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'cancellation', 'Não conseguirei conduzir a sessão.',
      'therapist-change-cancellation-0001',
      (select version from public.bookings where id = 'f2000000-0000-4000-8000-000000000001')
    ) ->> 'status'
  ),
  'pending',
  'a therapist cancellation also awaits the patient decision'
);

update public.booking_reschedule_requests
set expires_at = now() - interval '1 second'
where request_id = 'therapist-change-cancellation-0001';

select lives_ok(
  $$ select public.expire_booking_reschedule_requests_v1(now()) $$,
  'expiry processing accepts therapist changes'
);

select is(
  (
    select status from public.booking_reschedule_requests
    where request_id = 'therapist-change-cancellation-0001'
  ),
  'pending_admin_review',
  'an unanswered therapist cancellation moves to administrative review after 48 hours'
);

select is(
  (select status::text from public.bookings where id = 'f2000000-0000-4000-8000-000000000001'),
  'cancelled_by_therapist',
  'administrative review operationally cancels the session'
);

select ok(
  (
    select refund_pending
      and transfer_status = 'blocked'
      and transfer_blocked_reason = 'manual_refund_review'
    from public.session_payments
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'administrative review blocks transfer eligibility without creating a refund decision'
);

select is(
  (
    select count(*)::integer from public.session_refund_decisions_v10
    where session_payment_id = (
      select id from public.session_payments
      where booking_id = 'f2000000-0000-4000-8000-000000000001'
    )
  ),
  0,
  'no Stripe refund mutation is queued before the Admin makes a decision'
);

select is(
  (
    select count(*)::integer from public.notifications
    where kind in (
      'therapist_change_refund_review_patient',
      'therapist_change_refund_review_therapist'
    )
  ),
  2,
  'administrative review notifies both participants exactly once'
);

select * from finish();
rollback;
