begin;

select plan(19);

select has_table(
  'public',
  'booking_reminder_jobs',
  'persistent booking reminder jobs exist'
);
select is(
  has_table_privilege('anon', 'public.booking_reminder_jobs', 'SELECT'),
  false,
  'anonymous users cannot read reminder jobs'
);
select is(
  has_function_privilege(
    'anon',
    'public.run_booking_reminder_scheduler_v1(timestamp with time zone,integer)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot run the reminder scheduler'
);
select is(
  has_function_privilege(
    'service_role',
    'public.run_booking_reminder_scheduler_v1(timestamp with time zone,integer)',
    'EXECUTE'
  ),
  true,
  'the trusted scheduler can run reminder work'
);
select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key in (
      'booking_reminder_24h_patient',
      'booking_reminder_1h_patient'
    )
  ),
  2,
  'both patient reminder action definitions are provisioned'
);
select is(
  (
    select count(*)::integer
    from cron.job
    where jobname = 'tes-booking-reminders-v1'
  ),
  1,
  'the reminder scheduler is registered exactly once'
);

update public.email_action_settings
set enabled = true,
    automatic_dispatch_enabled = true
where action_key in (
  'booking_reminder_24h_patient',
  'booking_reminder_1h_patient'
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
  payment_status
)
values
  (
    'fa800000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2045-02-20T13:00:00Z',
    '2045-02-20T13:50:00Z',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'fa800000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2045-02-21T13:00:00Z',
    '2045-02-21T13:50:00Z',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
  ),
  (
    'fa800000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    '2045-02-22T13:00:00Z',
    '2045-02-22T13:50:00Z',
    'America/Sao_Paulo',
    'pending_payment',
    'pending'
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
  financial_status
)
select
  payment.id,
  payment.booking_id,
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  policy.id,
  17000,
  2000,
  3400,
  13600,
  'paid'::public.session_financial_status
from (
  values
    (
      'fa810000-0000-4000-8000-000000000001'::uuid,
      'fa800000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'fa810000-0000-4000-8000-000000000002'::uuid,
      'fa800000-0000-4000-8000-000000000002'::uuid
    ),
    (
      'fa810000-0000-4000-8000-000000000003'::uuid,
      'fa800000-0000-4000-8000-000000000003'::uuid
    )
) as payment(id, booking_id)
cross join lateral (
  select id
  from public.financial_policy_versions
  where is_active
  limit 1
) policy;

update public.bookings
set status = 'confirmed',
    payment_status = 'paid'
where id in (
  'fa800000-0000-4000-8000-000000000001',
  'fa800000-0000-4000-8000-000000000002',
  'fa800000-0000-4000-8000-000000000003'
);

select is(
  (
    select count(*)::integer
    from public.booking_reminder_jobs
    where booking_id = 'fa800000-0000-4000-8000-000000000001'
      and status = 'scheduled'
  ),
  2,
  'a future confirmed paid booking creates both patient reminders'
);
select is(
  (
    select scheduled_for
    from public.booking_reminder_jobs
    where booking_id = 'fa800000-0000-4000-8000-000000000001'
      and action_key = 'booking_reminder_24h_patient'
  ),
  '2045-02-19T13:00:00Z'::timestamptz,
  'the 24 hour reminder uses the absolute booking instant'
);
select is(
  (
    select scheduled_for
    from public.booking_reminder_jobs
    where booking_id = 'fa800000-0000-4000-8000-000000000001'
      and action_key = 'booking_reminder_1h_patient'
  ),
  '2045-02-20T12:00:00Z'::timestamptz,
  'the 1 hour reminder uses the absolute booking instant'
);
select is(
  (
    public.run_booking_reminder_scheduler_v1(
      '2045-02-19T13:00:00Z'::timestamptz,
      25
    )->>'enqueued'
  ),
  '1',
  'the scheduler enqueues the 24 hour reminder at its target tick'
);
select is(
  (
    public.run_booking_reminder_scheduler_v1(
      '2045-02-20T12:00:00Z'::timestamptz,
      25
    )->>'enqueued'
  ),
  '1',
  'the scheduler enqueues the 1 hour reminder at its target tick'
);
select is(
  (
    public.run_booking_reminder_scheduler_v1(
      '2045-02-20T12:00:00Z'::timestamptz,
      25
    )->>'enqueued'
  ),
  '0',
  'repeating a scheduler tick does not enqueue a duplicate'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'fa800000-0000-4000-8000-000000000001'
      and action_key in (
        'booking_reminder_24h_patient',
        'booking_reminder_1h_patient'
      )
  ),
  2,
  'the two reminder jobs create two distinct patient outbox deliveries'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'fa800000-0000-4000-8000-000000000001'
      and action_key in (
        'booking_reminder_24h_patient',
        'booking_reminder_1h_patient'
      )
      and payload = '{}'::jsonb
  ),
  2,
  'reminder outbox payloads contain no meeting or provider data'
);

select is(
  (
    select count(*)::integer
    from public.booking_reminder_jobs
    where booking_id = 'fa800000-0000-4000-8000-000000000002'
      and status = 'scheduled'
  ),
  2,
  'the cancellation fixture starts with two scheduled reminder jobs'
);

select is(
  (
    public.run_booking_reminder_scheduler_v1(
      '2045-02-20T13:00:00Z'::timestamptz,
      25
    )->>'enqueued'
  ),
  '1',
  'a due cancellation fixture can enqueue its 24 hour reminder before cancellation'
);

update public.bookings
set status = 'cancelled_by_patient',
    payment_status = 'cancelled'
where id = 'fa800000-0000-4000-8000-000000000002';

select is(
  (
    select count(*)::integer
    from public.booking_reminder_jobs
    where booking_id = 'fa800000-0000-4000-8000-000000000002'
      and status = 'cancelled'
  ),
  2,
  'cancellation invalidates scheduled and enqueued reminder jobs'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'fa800000-0000-4000-8000-000000000002'
      and action_key = 'booking_reminder_24h_patient'
      and status = 'skipped'
  ),
  1,
  'cancellation suppresses a pending reminder outbox delivery'
);

delete from public.booking_reminder_jobs
where booking_id = 'fa800000-0000-4000-8000-000000000003';
select is(
  public.schedule_booking_reminder_jobs_v1(
    'fa800000-0000-4000-8000-000000000003',
    '2045-02-22T12:30:00Z'::timestamptz
  ),
  0,
  'strict scheduling does not backfill reminders after both target times'
);

select * from finish();
rollback;
