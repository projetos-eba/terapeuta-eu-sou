begin;

select plan(18);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_zoom_waiting_room_arrival_v2(uuid,uuid,public.user_role,timestamptz)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot forge waiting-room arrivals'
);

select is(
  has_function_privilege(
    'service_role',
    'public.record_zoom_waiting_room_arrival_v2(uuid,uuid,public.user_role,timestamptz)',
    'EXECUTE'
  ),
  true,
  'the authenticated Zoom backend can record arrivals'
);

select is(
  (
    select is_active
    from public.financial_policy_versions
    where policy_key = 'tes-payments-v11-attendance-accountability'
  ),
  false,
  'the future accountability policy is inactive pending legal approval'
);

update public.bookings
set starts_at = now() - interval '5 minutes',
    ends_at = now() + interval '45 minutes',
    status = 'confirmed',
    updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000001';

update public.bookings
set starts_at = now() - interval '2 hours',
    ends_at = now() - interval '1 hour',
    status = 'confirmed',
    updated_at = now()
where id = 'f2000000-0000-4000-8000-000000000002';

select is(
  (
    public.record_zoom_waiting_room_arrival_v2(
      'f2000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'patient',
      now()
    ) ->> 'entitled'
  )::boolean,
  true,
  'the patient arrival is accepted inside the tolerance window'
);

select is(
  (
    public.record_zoom_waiting_room_arrival_v2(
      'f2000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'patient',
      now()
    ) ->> 'recorded'
  )::boolean,
  false,
  'repeating the same participant arrival is idempotent'
);

select is(
  public.finalize_due_session_attendance_v1(now() + interval '6 minutes', 20),
  2,
  'the finalizer classifies the therapist absence and the double absence once T+10 passes'
);

select is(
  (select status::text from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000001'),
  'no_show_therapist',
  'a patient arrival without therapist arrival is therapist no-show'
);

select is(
  (select status::text from public.bookings
    where id = 'f2000000-0000-4000-8000-000000000002'),
  'no_show_both',
  'no arrival from either participant is double no-show'
);

select is(
  (select classification from public.session_confirmation_incidents
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
    order by booking_version desc limit 1),
  'no_show_therapist',
  'the therapist absence opens a versioned incident'
);

select is(
  (select classification from public.session_confirmation_incidents
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
    order by booking_version desc limit 1),
  'no_show_both',
  'the double absence opens a distinct incident'
);

select ok(
  (
    select admin_blocked_at is not null
      and internal_contested_at is not null
      and transfer_blocked_reason = 'attendance_review'
    from public.session_payments
    where booking_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'therapist absence blocks financial completion before Admin review'
);

select is(
  (select count(*)::integer from public.session_refunds
    where session_payment_id = (
      select id from public.session_payments
      where booking_id = 'f2000000-0000-4000-8000-000000000001'
    )),
  0,
  'attendance classification performs no provider refund'
);

select is(
  (select count(*)::integer from public.stripe_transfer_reversals
    where stripe_transfer_id in (
      select id from public.stripe_transfers
      where session_payment_id = (
        select id from public.session_payments
        where booking_id = 'f2000000-0000-4000-8000-000000000001'
      )
    )),
  0,
  'attendance classification performs no transfer reversal'
);

select ok(
  (
    select not retention_authorized
      and not processing_cost_recovery_authorized
    from public.session_confirmation_incidents
    where booking_id = 'f2000000-0000-4000-8000-000000000002'
    order by booking_version desc limit 1
  ),
  'legacy policy snapshots authorize neither retention nor Stripe fee recovery'
);

select is(
  public.finalize_due_session_attendance_v1(now() + interval '6 minutes', 20),
  0,
  'repeating finalization is idempotent'
);

select is(
  (select count(*)::integer from public.notifications
    where event_key like 'attendance-review:%:patient'),
  2,
  'each reviewed incident notifies its patient exactly once'
);

select is(
  (select count(*)::integer from public.notifications
    where event_key like 'attendance-review:%:therapist'),
  2,
  'each reviewed incident notifies its therapist exactly once'
);

select is(
  (select count(*)::integer from public.therapist_financial_debts
    where origin = 'attendance_processing_cost'),
  0,
  'classification never creates a processing-cost debt before refund and legal authorization'
);

select * from finish();
rollback;
