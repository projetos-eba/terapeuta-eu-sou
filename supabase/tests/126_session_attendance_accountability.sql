begin;

select plan(20);

-- Keep the schedule fixture independent of other confirmed local bookings.
update public.bookings set status = 'cancelled_by_patient'
where therapist_profile_id = 'c1000000-0000-4000-8000-000000000001'
  and status in ('draft','pending_payment','confirmed')
  and id not in (
    'f2000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000002'
  );

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

create temporary table attendance_payment_before as
select booking_id, to_jsonb(payment) as payment_snapshot
from public.session_payments payment
where booking_id in (
  'f2000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002'
);

select cmp_ok(
  public.finalize_due_session_attendance_v1(now() + interval '6 minutes', 20),
  '>=', 2,
  'the finalizer reaches both target absences once T+10 passes'
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

select is(
  (select count(*)::integer from public.session_payments payment
    join attendance_payment_before before on before.booking_id = payment.booking_id
    where to_jsonb(payment) = before.payment_snapshot),
  2,
  'attendance classification leaves both payments and Transfers unchanged'
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
    where event_key in (
      select 'attendance-review:' || incident.id::text || ':patient'
      from public.session_confirmation_incidents incident
      where incident.booking_id in (
        'f2000000-0000-4000-8000-000000000001',
        'f2000000-0000-4000-8000-000000000002'
      )
    )),
  2,
  'each reviewed incident notifies its patient exactly once'
);

select is(
  (select count(*)::integer from public.notifications
    where event_key in (
      select 'attendance-review:' || incident.id::text || ':therapist'
      from public.session_confirmation_incidents incident
      where incident.booking_id in (
        'f2000000-0000-4000-8000-000000000001',
        'f2000000-0000-4000-8000-000000000002'
      )
    )),
  2,
  'each reviewed incident notifies its therapist exactly once'
);

select is(
  (select body from public.notifications
    where event_key = (
      select 'attendance-review:' || incident.id::text || ':patient'
      from public.session_confirmation_incidents incident
      where incident.booking_id = 'f2000000-0000-4000-8000-000000000002'
      order by incident.booking_version desc limit 1
    )),
  'Sessão não realizada. Se precisar de ajuda, fale com o suporte.',
  'the double no-show notification is neutral for the patient'
);

select is(
  (select body from public.notifications
    where event_key = (
      select 'attendance-review:' || incident.id::text || ':therapist'
      from public.session_confirmation_incidents incident
      where incident.booking_id = 'f2000000-0000-4000-8000-000000000002'
      order by incident.booking_version desc limit 1
    )),
  'Sessão não realizada. Se precisar de ajuda, fale com o suporte.',
  'the double no-show notification is neutral for the therapist'
);

select is(
  (select count(*)::integer from public.therapist_financial_debts
    where origin = 'attendance_processing_cost'),
  0,
  'classification never creates a processing-cost debt before refund and legal authorization'
);

select * from finish();
rollback;
