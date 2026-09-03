begin;

select plan(25);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_therapist_pending_confirmations_v1()',
    'EXECUTE'
  ),
  'authenticated therapists can invoke the pending confirmations read model'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.therapist_pending_confirmation_rows_v1(uuid)',
    'EXECUTE'
  ),
  'the internal pending rows helper is not exposed to authenticated clients'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.booking_session_reference_counters',
    'SELECT'
  ),
  'therapists cannot read the private session-reference counter'
);

select is(
  public.booking_session_reference_month_code_v1('2026-09-01 12:00:00+00'),
  'S',
  'September maps to the unambiguous session-reference month letter'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.therapist_pending_confirmation_rows_v1(uuid)',
    'EXECUTE'
  ),
  'the internal pending rows helper remains available to server-side callers'
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
  completed_at
)
values
  (
    'a9900000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '3 hours 50 minutes',
    now() - interval '3 hours',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '3 hours'
  ),
  (
    'a9900000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '4 hours 50 minutes',
    now() - interval '4 hours',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '4 hours'
  ),
  (
    'a9900000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '5 hours 50 minutes',
    now() - interval '5 hours',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '5 hours'
  ),
  (
    'a9900000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '6 hours 50 minutes',
    now() - interval '6 hours',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '6 hours'
  ),
  (
    'a9900000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '7 hours 50 minutes',
    now() - interval '7 hours',
    'America/Sao_Paulo',
    'completed',
    'paid',
    now() - interval '7 hours'
  ),
  (
    'a9900000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    now() - interval '8 hours 50 minutes',
    now() - interval '8 hours',
    'America/Sao_Paulo',
    'cancelled_by_patient',
    'paid',
    now() - interval '8 hours'
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
  financial_status,
  service_status
)
select
  payment.id,
  payment.booking_id,
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  10000,
  2000,
  2000,
  8000,
  'paid',
  'occurred_pending_confirmation'
from (
  values
    (
      'a9800000-0000-4000-8000-000000000001'::uuid,
      'a9900000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'a9800000-0000-4000-8000-000000000002'::uuid,
      'a9900000-0000-4000-8000-000000000002'::uuid
    ),
    (
      'a9800000-0000-4000-8000-000000000003'::uuid,
      'a9900000-0000-4000-8000-000000000003'::uuid
    ),
    (
      'a9800000-0000-4000-8000-000000000004'::uuid,
      'a9900000-0000-4000-8000-000000000004'::uuid
    ),
    (
      'a9800000-0000-4000-8000-000000000005'::uuid,
      'a9900000-0000-4000-8000-000000000005'::uuid
    ),
    (
      'a9800000-0000-4000-8000-000000000006'::uuid,
      'a9900000-0000-4000-8000-000000000006'::uuid
    )
) as payment(id, booking_id)
cross join lateral (
  select id
  from public.financial_policy_versions
  where is_active
  order by effective_from desc
  limit 1
) as policy;

select ok(
  (
    select session_reference ~ '^[0-9]{2}[JFMAIULGSOND][0-9]{6}$'
    from public.bookings
    where id = 'a9900000-0000-4000-8000-000000000001'
  ),
  'a booking receives a compact human-readable session reference'
);

select isnt(
  (
    select session_reference
    from public.bookings
    where id = 'a9900000-0000-4000-8000-000000000001'
  ),
  (
    select session_reference
    from public.bookings
    where id = 'a9900000-0000-4000-8000-000000000002'
  ),
  'consecutive bookings receive unique session references'
);

select throws_ok(
  $$update public.bookings
      set session_reference = '26S999999'
    where id = 'a9900000-0000-4000-8000-000000000001'$$,
  '22000',
  'session_reference_immutable',
  'the human-readable reference cannot be changed'
);

create temporary table pending_confirmation_reference_before_reschedule as
select id, session_reference
from public.bookings
where id = 'a9900000-0000-4000-8000-000000000002';

update public.bookings
set starts_at = starts_at - interval '14 days',
    ends_at = ends_at - interval '14 days'
where id = 'a9900000-0000-4000-8000-000000000002';

select is(
  (
    select session_reference
    from public.bookings
    where id = 'a9900000-0000-4000-8000-000000000002'
  ),
  (
    select session_reference
    from pending_confirmation_reference_before_reschedule
  ),
  'rescheduling keeps the original session reference'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  public.get_therapist_pending_confirmations_v1() ->> 'therapistProfileId',
  'c1000000-0000-4000-8000-000000000001',
  'the read model resolves the authenticated therapist profile'
);

select is(
  (public.get_therapist_pending_confirmations_v1() ->> 'version')::integer,
  1,
  'the read model exposes version 1'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements_text(
      public.get_therapist_pending_confirmations_v1() -> 'pendingBookingIds'
    ) as pending(booking_id)
    where pending.booking_id::uuid in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  5,
  'five ended paid unconfirmed sessions are pending'
);

select is(
  jsonb_array_length(
    public.get_therapist_pending_confirmations_v1() -> 'pendingBookingIds'
  ),
  (public.get_therapist_pending_confirmations_v1() ->> 'pendingCount')::integer,
  'pendingCount matches the pending booking ids'
);

select is(
  jsonb_array_length(
    public.get_therapist_pending_confirmations_v1() -> 'pendingSessions'
  ),
  (public.get_therapist_pending_confirmations_v1() ->> 'pendingCount')::integer,
  'pending sessions expose one human-readable reference per pending booking'
);

select ok(
  (
    public.get_therapist_pending_confirmations_v1()
      -> 'pendingSessions' -> 0 ->> 'sessionReference'
  ) ~ '^[0-9]{2}[JFMAIULGSOND][0-9]{6}$',
  'pending confirmation payload exposes the compact session reference'
);

select ok(
  public.get_therapist_pending_confirmations_v1() ->> 'generatedAt' is not null,
  'the read model reports when it was generated'
);

select ok(
  (
    select count(*)::integer
    from jsonb_array_elements_text(
      public.get_therapist_pending_confirmations_v1() -> 'pendingBookingIds'
    ) as pending(booking_id)
    where pending.booking_id::uuid in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ) = 5
  and not exists (
    select 1
    from jsonb_array_elements_text(
      public.get_therapist_pending_confirmations_v1() -> 'pendingBookingIds'
    ) as pending(booking_id)
    where pending.booking_id::uuid = 'a9900000-0000-4000-8000-000000000006'
  ),
  'the read model includes the qualifying fixture sessions and excludes the cancelled session'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  5,
  'the server-side rows helper returns the five qualifying fixture sessions'
);

reset role;
set local role authenticated;

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.get_therapist_reviews_v1() -> 'pendingConfirmations'
    ) as pending(row)
    where (pending.row ->> 'bookingId')::uuid in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  5,
  'the reviews page shares the pending confirmation predicate'
);

reset role;
set local role service_role;

select ok(
  not exists (
    select 1
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000002'
    ) as pending
    where pending.booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004'
    )
  ),
  'pending confirmations are isolated by therapist profile'
);

insert into public.session_participant_confirmations (
  booking_id,
  participant_role,
  outcome,
  source,
  confirmed_by_profile_id,
  request_id,
  payload_hash,
  due_at,
  policy_version_id
)
select
  'a9900000-0000-4000-8000-000000000001',
  'therapist',
  'completed',
  'manual',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a9700000-0000-4000-8000-000000000001',
  'pending-confirmation-participant-test',
  now(),
  policy_version_id
from public.session_payments
where booking_id = 'a9900000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  4,
  'a participant confirmation removes the session from the pending set'
);

insert into public.session_feedback (
  booking_id,
  author_profile_id,
  author_role,
  outcome,
  rating,
  request_id,
  payload_hash
)
values (
  'a9900000-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'therapist',
  'completed',
  5,
  'a9700000-0000-4000-8000-000000000002',
  'pending-confirmation-test'
)
on conflict (booking_id, author_role) do nothing;

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  3,
  'therapist feedback removes the session from the pending set'
);

update public.session_payments
set service_status = 'confirmed_by_therapist',
    service_confirmed_at = now()
where booking_id = 'a9900000-0000-4000-8000-000000000003';

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  2,
  'a manually confirmed service is no longer pending'
);

update public.session_payments
set financial_status = 'refunded'
where booking_id = 'a9900000-0000-4000-8000-000000000004';

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  1,
  'a refunded service is no longer pending'
);

update public.session_payments
set refund_pending = true
where booking_id = 'a9900000-0000-4000-8000-000000000005';

select is(
  (
    select count(*)::integer
    from public.therapist_pending_confirmation_rows_v1(
      'c1000000-0000-4000-8000-000000000001'
    )
    where booking_id in (
      'a9900000-0000-4000-8000-000000000001',
      'a9900000-0000-4000-8000-000000000002',
      'a9900000-0000-4000-8000-000000000003',
      'a9900000-0000-4000-8000-000000000004',
      'a9900000-0000-4000-8000-000000000005'
    )
  ),
  0,
  'a blocked refund removes the service from the pending set'
);

select * from finish();

rollback;
