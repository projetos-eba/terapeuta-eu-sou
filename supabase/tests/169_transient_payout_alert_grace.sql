begin;

select plan(17);

select ok(
  (select count(*) > 0 from public.profiles where role = 'admin'),
  'the local fixture has at least one eligible administrator'
);

insert into public.payout_operational_incidents (
  id, incident_key, incident_type, severity, status, metadata
) values (
  '16900000-0000-4000-8000-000000000001',
  'pgtap:transient-payout-alert-grace',
  'automatic_payout_reconciliation_required',
  'warning',
  'open',
  '{}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where domain_event_id = '16900000-0000-4000-8000-000000000001'
      and action_key = 'payout_operational_alert_admin'
  ),
  (select count(*)::integer from public.profiles where role = 'admin'
    and nullif(trim(email), '') is not null
    and auth_deleted_at is null and anonymized_at is null),
  'one idempotent external alert is scheduled for each eligible admin'
);

select ok(
  (
    select bool_and(next_attempt_at >= incident.first_occurred_at + interval '15 minutes')
    from public.email_outbox outbox
    join public.payout_operational_incidents incident
      on incident.id = outbox.domain_event_id
    where incident.id = '16900000-0000-4000-8000-000000000001'
  ),
  'the transient reconciliation e-mail is not eligible before the grace period'
);

select ok(
  (
    select bool_and(notification.available_at >= incident.first_occurred_at + interval '15 minutes')
    from public.notifications notification
    join public.payout_operational_incidents incident
      on notification.event_key = 'payout_incident:' || incident.id::text
    where incident.id = '16900000-0000-4000-8000-000000000001'
  ),
  'the internal alert uses the same grace period'
);

create temporary table hidden_notification_update_result (id uuid);
grant select, insert on hidden_notification_update_result to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id from public.profiles where role = 'admin' order by id limit 1),
    'role', 'authenticated'
  )::text,
  true
);
select is(
  (
    select count(*)::integer
    from public.notifications
    where event_key = 'payout_incident:16900000-0000-4000-8000-000000000001'
  ),
  0,
  'RLS keeps the deferred internal alert out of the administrator shell'
);
with updated as (
  update public.notifications
  set read_at = now()
  where event_key = 'payout_incident:16900000-0000-4000-8000-000000000001'
  returning id
)
insert into hidden_notification_update_result (id)
select id from updated;
select is(
  (select count(*)::integer from hidden_notification_update_result),
  0,
  'RLS does not let the recipient expose or mark a deferred alert early'
);
reset role;

update public.payout_operational_incidents
set status = 'resolved', resolved_at = now()
where id = '16900000-0000-4000-8000-000000000001';

select ok(
  (
    select bool_and(available_at = 'infinity'::timestamptz and read_at is not null)
    from public.notifications
    where event_key = 'payout_incident:16900000-0000-4000-8000-000000000001'
  ),
  'a transiently resolved internal alert remains hidden and non-unread'
);

update public.email_outbox
set status = 'skipped',
    attempts = 1,
    next_attempt_at = null,
    last_error = 'payout_incident_resolved_before_alert',
    processed_at = now()
where domain_event_id = '16900000-0000-4000-8000-000000000001'
  and action_key = 'payout_operational_alert_admin';

update public.payout_operational_incidents
set status = 'open', resolved_at = null, last_occurred_at = now()
where id = '16900000-0000-4000-8000-000000000001';

select ok(
  (
    select bool_and(
      status = 'pending'
      and attempts = 0
      and next_attempt_at >= now() + interval '14 minutes'
    )
    from public.email_outbox
    where domain_event_id = '16900000-0000-4000-8000-000000000001'
  ),
  'a provider-unsent alert is rearmed idempotently after reopening'
);

select ok(
  (
    select bool_and((payload ->> 'payoutAlertSuppressedCount')::integer = 1)
    from public.email_outbox
    where domain_event_id = '16900000-0000-4000-8000-000000000001'
  ),
  'rearming preserves an audit count for the suppressed alert'
);

select ok(
  (
    select bool_and(
      available_at >= now() + interval '14 minutes'
      and read_at is null
      and title = 'Conciliação de repasse exige atenção'
    )
    from public.notifications
    where event_key = 'payout_incident:16900000-0000-4000-8000-000000000001'
  ),
  'reopening starts a fresh internal-notification grace period'
);

update public.email_outbox
set next_attempt_at = '2000-01-01 00:00:00+00'
where domain_event_id = '16900000-0000-4000-8000-000000000001'
  and status = 'pending';

select is(
  (
    select count(*)::integer
    from public.claim_email_outbox_v1(
      '16900000-0000-4000-8000-000000000099', 50
    ) claimed
    where claimed.domain_event_id = '16900000-0000-4000-8000-000000000001'
  ),
  (select count(*)::integer from public.profiles where role = 'admin'
    and nullif(trim(email), '') is not null
    and auth_deleted_at is null and anonymized_at is null),
  'a persistent open incident becomes claimable after the grace period'
);

insert into public.payout_operational_incidents (
  id, incident_key, incident_type, severity, status, metadata
) values (
  '16900000-0000-4000-8000-000000000002',
  'pgtap:immediate-non-reconciliation-alert',
  'transfer_blocked',
  'critical',
  'open',
  '{}'::jsonb
);

select ok(
  (
    select bool_and(next_attempt_at <= now() + interval '5 seconds')
    from public.email_outbox
    where domain_event_id = '16900000-0000-4000-8000-000000000002'
  ),
  'other incident types keep immediate external alerts'
);

select ok(
  (
    select bool_and(available_at <= now() + interval '5 seconds')
    from public.notifications
    where event_key = 'payout_incident:16900000-0000-4000-8000-000000000002'
  ),
  'other incident types keep immediate internal alerts'
);

select is(
  (
    select count(*)::integer
    from public.payout_operational_incidents
    where incident_key = 'pgtap:transient-payout-alert-grace'
  ),
  1,
  'the alert lifecycle does not duplicate the financial incident'
);

select is(
  (
    select count(*)::integer
    from public.email_outbox
    where domain_event_id = '16900000-0000-4000-8000-000000000001'
  ),
  (select count(*)::integer from public.profiles where role = 'admin'
    and nullif(trim(email), '') is not null
    and auth_deleted_at is null and anonymized_at is null),
  'reopening reuses the original logical deliveries without duplication'
);

select is(
  (
    select count(*)::integer
    from public.stripe_payout_transfer_allocations
    where created_at >= transaction_timestamp()
  ),
  0,
  'the alert-only scenario creates no payout allocation'
);

select is(
  (
    select count(*)::integer
    from public.financial_ledger_entries
    where recorded_at >= transaction_timestamp()
  ),
  0,
  'the alert-only scenario creates no ledger entry'
);

select * from finish();
rollback;
