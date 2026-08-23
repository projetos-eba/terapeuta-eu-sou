begin;

select plan(12);

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
  meeting_provider
) values (
  'f9200000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  '2040-04-02T13:00:00Z',
  '2040-04-02T13:50:00Z',
  'America/Sao_Paulo',
  'pending_payment',
  'pending',
  'zoom'
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
  transfer_status
)
select
  'f9200000-0000-4000-8000-000000000002',
  'f9200000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000005',
  'c1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  id,
  20000,
  2000,
  4000,
  16000,
  'pending',
  'not_eligible'
from public.financial_policy_versions
where is_active
limit 1;

select is(
  (
    public.reconcile_session_payment_amount_v1(
      'f9200000-0000-4000-8000-000000000002',
      16000,
      20000,
      4000,
      'cs_test_promotion_074',
      jsonb_build_object(
        'source', 'stripe_checkout_session',
        'discount_count', 1,
        'currency', 'BRL'
      )
    )->>'applied'
  )::boolean,
  true,
  'Stripe Checkout amount reconciliation is applied'
);

select is(
  (
    select gross_amount_cents
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  16000,
  'gross amount becomes the actual discounted charge'
);

select is(
  (
    select metadata #>> '{stripe_checkout,original_amount_cents}'
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  '20000',
  'original subtotal remains available in Stripe metadata'
);

select is(
  (
    select metadata #>> '{stripe_checkout,discount_amount_cents}'
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  '4000',
  'Stripe discount amount remains available in metadata'
);

select is(
  (
    select platform_gross_commission_cents
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  3200,
  'TES commission is recalculated from the discounted charge'
);

select is(
  (
    select therapist_amount_cents
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  12800,
  'therapist amount is recalculated from the discounted charge'
);

select is(
  (
    public.apply_session_payment_state_v1(
      'f9200000-0000-4000-8000-000000000002',
      'paid',
      'evt_test_promotion_074',
      '2040-04-02T12:50:00Z',
      'pi_test_promotion_074',
      'ch_test_promotion_074',
      'cs_test_promotion_074'
    )->>'applied'
  )::boolean,
  true,
  'paid webhook keeps the reconciled amount'
);

select is(
  (
    select sum(amount_cents)::integer
    from public.financial_ledger_entries
    where session_payment_id = 'f9200000-0000-4000-8000-000000000002'
      and entry_type in ('therapist_payable', 'platform_gross_commission')
  ),
  16000,
  'ledger commission plus therapist payable equals the actual charge'
);

select is(
  (
    select financial_status::text
    from public.session_payments
    where id = 'f9200000-0000-4000-8000-000000000002'
  ),
  'paid',
  'session payment is paid only after the authoritative webhook'
);

select is(
  (
    select status::text
    from public.bookings
    where id = 'f9200000-0000-4000-8000-000000000001'
  ),
  'confirmed',
  'booking is confirmed by the paid webhook'
);

select is(
  (
    select count(*)::integer
    from public.financial_ledger_entries
    where session_payment_id = 'f9200000-0000-4000-8000-000000000002'
      and entry_type = 'session_gross_payment'
  ),
  1,
  'gross payment ledger entry remains idempotent'
);

select is(
  (
    public.reconcile_session_payment_amount_v1(
      'f9200000-0000-4000-8000-000000000002',
      16000,
      20000,
      4000,
      'cs_test_promotion_074',
      jsonb_build_object('source', 'stripe_checkout_session')
    )->>'applied'
  )::boolean,
  true,
  'replaying the same Stripe amounts remains idempotent'
);

select * from finish();
rollback;
