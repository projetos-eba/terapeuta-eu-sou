begin;

\ir fixtures/weekly-payout-local.inc

select plan(11);

update public.session_payments
set service_status = 'canceled',
    service_confirmed_at = now() - interval '1 minute',
    service_confirmation_source = null,
    transfer_status = 'blocked',
    transfer_blocked_reason = 'retained_cancellation_pending_eligibility',
    refund_pending = false,
    stripe_balance_status = 'available',
    stripe_balance_available_on = now() - interval '1 hour',
    stripe_balance_checked_at = now()
where id = 'fa100000-0000-4000-8000-000000000001';

insert into public.session_cancellation_decisions (
  id, booking_id, session_payment_id, policy_version_id, requested_by_profile_id,
  requested_by_role, request_id, reason, decision, refund_amount_cents,
  retained_amount_cents, therapist_retained_cents, platform_retained_cents,
  requires_manual_review, processed_at, metadata
)
select
  'fa200000-0000-4000-8000-000000000001',
  payment.booking_id, payment.id, payment.policy_version_id, null,
  'admin', 'fa300000-0000-4000-8000-000000000001',
  'patient_cancellation', 'late_cancellation_partial_refund', 0,
  payment.gross_amount_cents, payment.therapist_amount_cents,
  payment.platform_gross_commission_cents, false, now(),
  '{"fixture":"retained_cancellation_eligibility"}'::jsonb
from public.session_payments payment
where payment.id = 'fa100000-0000-4000-8000-000000000001'
on conflict (id) do update
set processed_at = excluded.processed_at,
    requires_manual_review = excluded.requires_manual_review;

select is(
  public.is_fully_retained_cancellation_payment_v1(
    'fa100000-0000-4000-8000-000000000001'
  ),
  true,
  'a processed and reconciled zero-refund decision is fully retained'
);

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'eligible',
  'a fully retained cancellation can enter payout eligibility'
);

select is(
  (
    select service_status::text
    from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'canceled',
  'payout eligibility does not misrepresent the canceled service as performed'
);

select is(
  (
    select refund_pending
    from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  false,
  'a retained cancellation does not claim that a refund is pending'
);

update public.session_cancellation_decisions
set requires_manual_review = true
where id = 'fa200000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'waiting_confirmation',
  'manual-review cancellations cannot use retained cancellation eligibility'
);

update public.session_cancellation_decisions
set requires_manual_review = false
where id = 'fa200000-0000-4000-8000-000000000001';

update public.session_payments
set refund_pending = true
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.refresh_session_transfer_eligibility(
    'fa100000-0000-4000-8000-000000000001', now()
  )::text,
  'blocked',
  'refund pending remains a hard payout block'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.is_fully_retained_cancellation_payment_v1(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the retained cancellation predicate'
);

update public.session_payments
set canceled_at = null,
    eligible_at = null,
    refund_pending = true,
    service_confirmed_at = null,
    service_status = 'scheduled',
    transfer_blocked_reason = 'manual_refund_review',
    transfer_status = 'blocked'
where id = 'fa100000-0000-4000-8000-000000000001';

select is(
  public.reconcile_legacy_retained_cancellations_v1(now()),
  1,
  'the legacy false refund-review projection is reconciled once'
);

select is(
  (
    select refund_pending
    from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  false,
  'legacy reconciliation clears the false pending refund'
);

select is(
  (
    select service_status::text
    from public.session_payments
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'canceled',
  'legacy reconciliation preserves the canceled service projection'
);

select is(
  public.reconcile_legacy_retained_cancellations_v1(now()),
  0,
  'legacy reconciliation is idempotent'
);

select * from finish();
rollback;
