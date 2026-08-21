begin;

select plan(14);

select has_column(
  'public',
  'notifications',
  'event_key',
  'notifications retain an internal event key for idempotency'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'notifications'
      and indexname = 'notifications_profile_event_key_unique_idx'
  ),
  'notification event keys are unique for each recipient'
);

select has_trigger(
  'public',
  'session_payments',
  'z_notify_paid_session_payment',
  'paid payment transition emits shell notifications'
);

select has_trigger(
  'public',
  'messages',
  'notify_message_recipient',
  'template message insertion emits a recipient notification'
);

select has_trigger(
  'public',
  'support_tickets',
  'notify_support_ticket_created',
  'new support tickets notify administrators'
);

select has_trigger(
  'public',
  'support_tickets',
  'notify_support_ticket_updated',
  'support ticket updates notify the requester'
);

select has_trigger(
  'public',
  'therapy_catalog_requests',
  'notify_therapy_catalog_request_admins',
  'therapy requests notify administrators'
);

create temporary table notification_message_fixture as
with inserted as (
  insert into public.messages (conversation_id, sender_profile_id, body)
  select
    conversation.id,
    patient.user_id,
    'Mensagem de teste para notificação.'
  from public.conversations as conversation
  join public.patient_profiles as patient
    on patient.id = conversation.patient_profile_id
  limit 1
  returning id, conversation_id
)
select
  inserted.id,
  therapist.user_id as recipient_profile_id
from inserted
join public.conversations as conversation
  on conversation.id = inserted.conversation_id
join public.therapist_profiles as therapist
  on therapist.id = conversation.therapist_profile_id;

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_message_fixture as fixture
      on notification.profile_id = fixture.recipient_profile_id
    where notification.event_key = 'message:' || fixture.id::text
      and notification.kind = 'message_received'
  ),
  1,
  'a template message notifies only its recipient'
);

create temporary table notification_support_fixture as
with inserted as (
  insert into public.support_tickets (
    requester_profile_id,
    category,
    subject,
    description,
    status,
    priority
  )
  select
    profile.id,
    'notification_test',
    'Chamado de teste para notificação',
    'Conteúdo de teste.',
    'open',
    'normal'
  from public.profiles as profile
  where profile.role = 'patient'::public.user_role
  limit 1
  returning id, requester_profile_id
)
select * from inserted;

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_support_fixture as fixture
      on notification.event_key =
        'support-ticket-created:' || fixture.id::text || ':' || notification.profile_id::text
    where notification.kind = 'support_ticket_created'
  ),
  (select count(*)::integer from public.profiles where role = 'admin'::public.user_role),
  'a new support ticket notifies every administrator'
);

update public.support_tickets
set
  status = 'resolved',
  resolution_summary = 'Atualização de teste para notificação.',
  reviewed_at = now()
where id = (select id from notification_support_fixture);

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_support_fixture as fixture
      on notification.profile_id = fixture.requester_profile_id
    where notification.kind = 'support_ticket_updated'
      and notification.event_key like 'support-ticket-updated:' || fixture.id::text || ':%'
  ),
  1,
  'a resolved support ticket notifies its requester'
);

create temporary table notification_therapy_fixture as
with inserted as (
  insert into public.therapy_catalog_requests (
    requester_profile_id,
    requester_therapist_profile_id,
    informed_name,
    description,
    justification,
    status
  )
  select
    therapist.user_id,
    therapist.id,
    'Terapia de teste de notificação',
    'Descrição estruturada para teste.',
    'Justificativa para análise.',
    'submitted'
  from public.therapist_profiles as therapist
  limit 1
  returning id
)
select * from inserted;

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_therapy_fixture as fixture
      on notification.event_key like 'therapy-catalog-request:' || fixture.id::text || ':%'
    where notification.kind = 'therapy_catalog_request_submitted'
  ),
  (select count(*)::integer from public.profiles where role = 'admin'::public.user_role),
  'a therapy request notifies every administrator'
);

create temporary table notification_payment_fixture as
select payment.id, payment.booking_id
from public.session_payments as payment
join public.bookings as booking
  on booking.id = payment.booking_id
where payment.financial_status in (
  'pending'::public.session_financial_status,
  'processing'::public.session_financial_status,
  'failed'::public.session_financial_status,
  'canceled'::public.session_financial_status
)
  and booking.status in ('draft'::public.booking_status, 'pending_payment'::public.booking_status)
order by payment.created_at
limit 1;

select is(
  (select count(*)::integer from notification_payment_fixture),
  1,
  'a payable booking fixture exists'
);

update public.session_payments
set
  financial_status = 'paid'::public.session_financial_status,
  paid_at = coalesce(paid_at, now())
where id = (select id from notification_payment_fixture);

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_payment_fixture as fixture
      on notification.href in (
        '/app/encontros/' || fixture.booking_id::text,
        '/terapeuta/sessoes/' || fixture.booking_id::text
      )
    where notification.kind = 'booking_confirmed'
  ),
  2,
  'a confirmed payment notifies the patient and therapist'
);

update public.session_payments
set financial_status = 'paid'::public.session_financial_status
where id = (select id from notification_payment_fixture);

select is(
  (
    select count(*)::integer
    from public.notifications as notification
    join notification_payment_fixture as fixture
      on notification.href in (
        '/app/encontros/' || fixture.booking_id::text,
        '/terapeuta/sessoes/' || fixture.booking_id::text
      )
    where notification.kind = 'booking_confirmed'
  ),
  2,
  'replaying a paid state does not duplicate booking notifications'
);

select * from finish();
rollback;
