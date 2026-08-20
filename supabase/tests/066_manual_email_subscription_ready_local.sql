begin;

select plan(16);

select has_trigger(
  'public',
  'therapist_subscription_events',
  'enqueue_therapist_subscription_email',
  'persisted subscription lifecycle events enqueue e-mail work'
);
select has_trigger(
  'public',
  'billing_invoices',
  'enqueue_therapist_subscription_renewal_email',
  'persisted recurring paid invoices enqueue renewal e-mail work'
);
select is(
  (
    select count(*)::integer
    from public.email_action_definitions
    where action_key in (
      'therapist_subscription_created',
      'therapist_subscription_renewed',
      'therapist_subscription_cancelled',
      'therapist_subscription_plan_changed'
    )
  ),
  4,
  'all ready subscription action definitions are provisioned'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.enqueue_therapist_subscription_email_v1()',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot invoke the subscription e-mail trigger'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_subscription_created',
  'customer.subscription.created',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-subscription-created',
  '2046-02-10T10:00:00Z',
  'sub_manual_email_primary'
);
select is(
  (
    public.apply_therapist_subscription_event_v1(
      'c1000000-0000-4000-8000-000000000002',
      'sub_manual_email_primary',
      'premium',
      'active',
      'evt_manual_email_subscription_created',
      '2046-02-10T10:00:00Z',
      null,
      null,
      null,
      'cs_manual_email_subscription_created',
      null,
      '2046-02-10T10:00:00Z',
      '2046-03-10T10:00:00Z'
    )->>'applied'
  )::boolean,
  true,
  'a reserved active subscription event is applied'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_created'
      and related_entity_type = 'therapist_subscription'
  ),
  1,
  'an activation queues one subscription-created delivery'
);
select is(
  (
    select payload
    from public.email_outbox
    where action_key = 'therapist_subscription_created'
      and related_entity_type = 'therapist_subscription'
  ),
  '{}'::jsonb,
  'subscription outbox payload does not persist Stripe or billing data'
);
select public.apply_therapist_subscription_event_v1(
  'c1000000-0000-4000-8000-000000000002',
  'sub_manual_email_primary',
  'premium',
  'active',
  'evt_manual_email_subscription_created',
  '2046-02-10T10:00:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_created'
      and related_entity_type = 'therapist_subscription'
  ),
  1,
  'replaying the same subscription event does not duplicate activation delivery'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_subscription_plan_changed',
  'customer.subscription.updated',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-subscription-plan-changed',
  '2046-02-11T10:00:00Z',
  'sub_manual_email_primary'
);
select public.apply_therapist_subscription_event_v1(
  'c1000000-0000-4000-8000-000000000002',
  'sub_manual_email_primary',
  'premium_plus',
  'active',
  'evt_manual_email_subscription_plan_changed',
  '2046-02-11T10:00:00Z',
  null,
  null,
  null,
  null,
  null,
  '2046-02-10T10:00:00Z',
  '2046-03-10T10:00:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_plan_changed'
      and related_entity_type = 'therapist_subscription'
  ),
  1,
  'an effective persisted plan change queues one plan-changed delivery'
);

insert into public.therapist_subscription_events (
  id,
  therapist_subscription_id,
  therapist_profile_id,
  event_type,
  previous_plan,
  next_plan,
  previous_status,
  next_status,
  metadata
)
select
  'fa100000-0000-4000-8000-000000000001',
  id,
  therapist_profile_id,
  'downgrade_scheduled',
  'premium_plus',
  'premium',
  'active',
  'active',
  '{"scheduled":true}'::jsonb
from public.therapist_subscriptions
where stripe_subscription_id = 'sub_manual_email_primary';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_plan_changed'
      and related_entity_type = 'therapist_subscription'
  ),
  1,
  'a scheduled downgrade does not communicate an alteration before it is effective'
);

insert into public.email_action_settings (action_key, enabled, automatic_dispatch_enabled)
values ('therapist_subscription_plan_changed', true, false);
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_subscription_auto_disabled',
  'customer.subscription.updated',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-subscription-auto-disabled',
  '2046-02-12T10:00:00Z',
  'sub_manual_email_primary'
);
select public.apply_therapist_subscription_event_v1(
  'c1000000-0000-4000-8000-000000000002',
  'sub_manual_email_primary',
  'premium',
  'active',
  'evt_manual_email_subscription_auto_disabled',
  '2046-02-12T10:00:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_plan_changed'
      and domain_event_id = (
        select id
        from public.therapist_subscription_events
        where stripe_event_id = 'evt_manual_email_subscription_auto_disabled'
      )
  ),
  0,
  'automatic dispatch disabled blocks a later effective plan-change delivery'
);

delete from public.email_action_settings
where action_key = 'therapist_subscription_plan_changed';
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_subscription_cancelled',
  'customer.subscription.deleted',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-subscription-cancelled',
  '2046-03-10T10:00:00Z',
  'sub_manual_email_primary'
);
select public.apply_therapist_subscription_event_v1(
  'c1000000-0000-4000-8000-000000000002',
  'sub_manual_email_primary',
  'premium',
  'canceled',
  'evt_manual_email_subscription_cancelled',
  '2046-03-10T10:00:00Z',
  null,
  null,
  null,
  null,
  null,
  '2046-02-10T10:00:00Z',
  '2046-03-10T10:00:00Z',
  false,
  '2046-02-12T10:00:00Z',
  '2046-03-10T10:00:00Z'
);
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_cancelled'
      and related_entity_type = 'therapist_subscription'
  ),
  1,
  'an effective persisted cancellation queues one cancellation delivery'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_subscription_renewal_created',
  'customer.subscription.created',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-subscription-renewal-created',
  '2046-02-10T10:00:00Z',
  'sub_manual_email_renewal'
);
select public.apply_therapist_subscription_event_v1(
  'c1000000-0000-4000-8000-000000000001',
  'sub_manual_email_renewal',
  'premium',
  'active',
  'evt_manual_email_subscription_renewal_created',
  '2046-02-10T10:00:00Z',
  null,
  null,
  null,
  'cs_manual_email_subscription_renewal',
  null,
  '2046-02-10T10:00:00Z',
  '2046-03-10T10:00:00Z'
);
select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_invoice_initial',
  'invoice.paid',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-invoice-initial',
  '2046-02-10T10:01:00Z',
  'in_manual_email_initial'
);
insert into public.billing_invoices (
  id,
  therapist_subscription_id,
  therapist_profile_id,
  stripe_invoice_id,
  stripe_subscription_id,
  billing_reason,
  status,
  amount_due_cents,
  amount_paid_cents,
  paid_at
)
select
  'fa200000-0000-4000-8000-000000000001',
  id,
  therapist_profile_id,
  'in_manual_email_initial',
  stripe_subscription_id,
  'subscription_create',
  'paid',
  4900,
  4900,
  '2046-02-10T10:01:00Z'
from public.therapist_subscriptions
where stripe_subscription_id = 'sub_manual_email_renewal';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_renewed'
  ),
  0,
  'the initial subscription invoice does not masquerade as a renewal'
);

select * from public.reserve_stripe_webhook_event_v1(
  'evt_manual_email_invoice_cycle',
  'invoice.paid',
  null,
  false,
  '2026-08-20',
  'platform',
  'test-hash-manual-email-invoice-cycle',
  '2046-03-10T10:01:00Z',
  'in_manual_email_cycle'
);
insert into public.billing_invoices (
  id,
  therapist_subscription_id,
  therapist_profile_id,
  stripe_invoice_id,
  stripe_subscription_id,
  billing_reason,
  status,
  amount_due_cents,
  amount_paid_cents,
  paid_at
)
select
  'fa200000-0000-4000-8000-000000000002',
  id,
  therapist_profile_id,
  'in_manual_email_cycle',
  stripe_subscription_id,
  'subscription_cycle',
  'paid',
  4900,
  4900,
  '2046-03-10T10:01:00Z'
from public.therapist_subscriptions
where stripe_subscription_id = 'sub_manual_email_renewal';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_renewed'
      and related_entity_id = 'fa200000-0000-4000-8000-000000000002'
  ),
  1,
  'a persisted recurring paid invoice queues one renewal delivery'
);
update public.billing_invoices
set status = status
where id = 'fa200000-0000-4000-8000-000000000002';
select is(
  (
    select count(*)::integer
    from public.email_outbox
    where action_key = 'therapist_subscription_renewed'
      and related_entity_id = 'fa200000-0000-4000-8000-000000000002'
  ),
  1,
  'a replayed recurring invoice does not duplicate its renewal delivery'
);
select ok(
  (
    select count(*) = count(distinct (action_key, domain_event_id, recipient_key))
    from public.email_outbox
    where related_entity_type in ('therapist_subscription', 'billing_invoice')
  ),
  'subscription deliveries preserve the action, logical-event, recipient dedupe contract'
);

select * from finish();
rollback;
