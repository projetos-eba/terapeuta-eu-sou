begin;

select plan(18);

select has_trigger(
  'public',
  'booking_events',
  'enqueue_booking_email',
  'persisted booking events enqueue transactional email work'
);
select is(
  has_function_privilege('anon', 'public.enqueue_booking_email_v1()', 'EXECUTE'),
  false,
  'anonymous users cannot invoke the booking e-mail trigger'
);
select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key in (
      'booking_confirmed_patient',
      'booking_confirmed_therapist',
      'booking_cancelled_patient',
      'booking_cancelled_therapist',
      'booking_rescheduled_patient',
      'booking_rescheduled_therapist'
    )
  ),
  6,
  'all ready booking action definitions are provisioned'
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
values (
  'f9100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2045-02-20T13:00:00Z',
  '2045-02-20T13:50:00Z',
  'America/Sao_Paulo',
  'pending_payment',
  'pending'
);

update public.bookings
set payment_status = 'paid',
    status = 'confirmed'
where id = 'f9100000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_confirmed_patient'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  1,
  'persisted confirmation queues one patient delivery'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_confirmed_therapist'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  1,
  'persisted confirmation queues one therapist delivery'
);
select is(
  (
    select count(distinct recipient_key)::integer
    from public.email_outbox
    where action_key in ('booking_confirmed_patient', 'booking_confirmed_therapist')
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  2,
  'one confirmed domain event preserves distinct recipients'
);
select is(
  (
    select payload
    from public.email_outbox
    where action_key = 'booking_confirmed_patient'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  '{}'::jsonb,
  'booking delivery payload does not contain meeting or payment data'
);
select is(
  public.enqueue_transactional_email_v1(
    'booking_confirmed_patient',
    (
      select domain_event_id
      from public.email_outbox
      where action_key = 'booking_confirmed_patient'
        and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
    ),
    'booking',
    'f9100000-0000-4000-8000-000000000001',
    'bbbbbbbb-0000-4000-8000-000000000005',
    'profile:bbbbbbbb-0000-4000-8000-000000000005',
    '{}'::jsonb
  ),
  (
    select id
    from public.email_outbox
    where action_key = 'booking_confirmed_patient'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  'a replay of the same confirmation resolves to its original patient delivery'
);

insert into public.email_action_settings (
  action_key,
  enabled,
  automatic_dispatch_enabled
)
values ('booking_cancelled_patient', false, true);

update public.bookings
set status = 'cancelled_by_patient',
    cancellation_reason = 'Informação clínica e operacional que não pode sair por e-mail.'
where id = 'f9100000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_cancelled_patient'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  0,
  'a disabled booking action does not create an automatic delivery'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_cancelled_therapist'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  1,
  'a different enabled recipient action remains deliverable after cancellation'
);
select is(
  (
    select payload
    from public.email_outbox
    where action_key = 'booking_cancelled_therapist'
      and related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  '{}'::jsonb,
  'cancellation reasons are not persisted in the e-mail outbox payload'
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
values (
  'f9100000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2045-02-21T13:00:00Z',
  '2045-02-21T13:50:00Z',
  'America/Sao_Paulo',
  'confirmed',
  'paid'
);

insert into public.booking_events (
  id,
  booking_id,
  event_type,
  request_id,
  source,
  previous_status,
  next_status,
  payload
)
values (
  'e9100000-0000-4000-8000-000000000001',
  'f9100000-0000-4000-8000-000000000002',
  'booking_reschedule_resolved',
  'booking-email-rejected-resolution',
  'agenda_a2',
  'confirmed',
  'confirmed',
  '{"status":"rejected"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key in ('booking_rescheduled_patient', 'booking_rescheduled_therapist')
      and related_entity_id = 'f9100000-0000-4000-8000-000000000002'
  ),
  0,
  'a reschedule decision without applied status does not send a confirmation'
);

insert into public.booking_events (
  id,
  booking_id,
  event_type,
  request_id,
  source,
  previous_status,
  next_status,
  payload
)
values (
  'e9100000-0000-4000-8000-000000000002',
  'f9100000-0000-4000-8000-000000000002',
  'booking_reschedule_resolved',
  'booking-email-applied-resolution',
  'agenda_a2',
  'confirmed',
  'confirmed',
  '{"status":"applied"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key in ('booking_rescheduled_patient', 'booking_rescheduled_therapist')
      and related_entity_id = 'f9100000-0000-4000-8000-000000000002'
  ),
  2,
  'an applied reschedule resolution queues exactly one delivery per participant'
);

insert into public.email_action_settings (
  action_key,
  enabled,
  automatic_dispatch_enabled
)
values ('booking_rescheduled_patient', true, false);

insert into public.booking_events (
  id,
  booking_id,
  event_type,
  request_id,
  source,
  previous_status,
  next_status,
  payload
)
values (
  'e9100000-0000-4000-8000-000000000003',
  'f9100000-0000-4000-8000-000000000002',
  'booking_reschedule_resolved',
  'booking-email-automatic-disabled',
  'agenda_a2',
  'confirmed',
  'confirmed',
  '{"status":"applied"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_rescheduled_patient'
      and domain_event_id = 'e9100000-0000-4000-8000-000000000003'
  ),
  0,
  'automatic dispatch disabled prevents a later patient reschedule delivery'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'booking_rescheduled_therapist'
      and domain_event_id = 'e9100000-0000-4000-8000-000000000003'
  ),
  1,
  'a different action remains eligible when only the patient action is automatic-disabled'
);
select ok(
  (
    select count(*) = count(distinct (action_key, domain_event_id, recipient_key))
    from public.email_outbox
    where related_entity_id = 'f9100000-0000-4000-8000-000000000001'
  ),
  'booking deliveries retain the multi-action and multi-recipient dedupe contract'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where related_entity_id = 'f9100000-0000-4000-8000-000000000001'
      and recipient_key !~ '^profile:'
  ),
  0,
  'booking deliveries retain opaque recipient keys'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.enqueue_transactional_email_v1(text,uuid,text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot enqueue booking e-mails directly'
);

select * from finish();
rollback;
