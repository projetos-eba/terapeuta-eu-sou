begin;

select plan(8);

select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key = 'booking_reminder_24h_patient'
  ),
  1,
  'the T-24 reminder action remains registered'
);

select is(
  (
    select active
    from public.email_action_definitions
    where action_key = 'booking_reminder_24h_patient'
  ),
  false,
  'the T-24 reminder action is inactive by default in V10'
);

select is(
  (
    select enabled
    from public.email_action_settings
    where action_key = 'booking_reminder_24h_patient'
  ),
  false,
  'the T-24 reminder is disabled operationally'
);

select is(
  (
    select automatic_dispatch_enabled
    from public.email_action_settings
    where action_key = 'booking_reminder_24h_patient'
  ),
  false,
  'automatic dispatch is disabled for the T-24 reminder'
);

select is(
  (
    select count(*)::integer
    from public.booking_reminder_jobs
    where action_key = 'booking_reminder_24h_patient'
      and status in ('scheduled', 'processing', 'enqueued')
  ),
  0,
  'no T-24 reminder job remains claimable'
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_reminder_24h_patient'
      and status in ('pending', 'retry_pending')
  ),
  0,
  'no unsent T-24 reminder remains dispatchable'
);

select has_table(
  'public',
  'booking_reminder_jobs',
  'the reminder job structure is preserved'
);

select has_function(
  'public',
  'run_booking_reminder_scheduler_v1',
  array['timestamp with time zone', 'integer'],
  'the reminder scheduler is preserved for the active 1-hour event'
);

select * from finish();

rollback;
