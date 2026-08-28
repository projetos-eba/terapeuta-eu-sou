-- Temporary local-only fixture used to validate the patient feedback surfaces.
-- The UUID namespace is reserved for this fixture and cleaned by the companion
-- script after browser validation.

delete from public.financial_ledger_entries
where session_payment_id in (
  'b8e00000-0000-4000-8000-000000000001'::uuid,
  'b8e00000-0000-4000-8000-000000000002'::uuid,
  'b8e00000-0000-4000-8000-000000000003'::uuid,
  'b8e00000-0000-4000-8000-000000000004'::uuid,
  'b8e00000-0000-4000-8000-000000000005'::uuid
);
delete from public.booking_payment_receipts
where booking_id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid,
  'b8f00000-0000-4000-8000-000000000003'::uuid,
  'b8f00000-0000-4000-8000-000000000004'::uuid,
  'b8f00000-0000-4000-8000-000000000005'::uuid
);
delete from public.payments
where booking_id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid,
  'b8f00000-0000-4000-8000-000000000003'::uuid,
  'b8f00000-0000-4000-8000-000000000004'::uuid,
  'b8f00000-0000-4000-8000-000000000005'::uuid
);
delete from public.session_payments
where id in (
  'b8e00000-0000-4000-8000-000000000001'::uuid,
  'b8e00000-0000-4000-8000-000000000002'::uuid,
  'b8e00000-0000-4000-8000-000000000003'::uuid,
  'b8e00000-0000-4000-8000-000000000004'::uuid,
  'b8e00000-0000-4000-8000-000000000005'::uuid
);
delete from public.bookings
where id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid,
  'b8f00000-0000-4000-8000-000000000003'::uuid,
  'b8f00000-0000-4000-8000-000000000004'::uuid,
  'b8f00000-0000-4000-8000-000000000005'::uuid
);

insert into public.bookings (
  id, patient_profile_id, therapist_profile_id, service_id,
  starts_at, ends_at, timezone, status, payment_status
)
values
  (
    'b8f00000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '32 hours', now() - interval '31 hours',
    'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'b8f00000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000004',
    '93000000-0000-4000-8000-000000000017',
    now() - interval '37 hours', now() - interval '36 hours',
    'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'b8f00000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '42 hours', now() - interval '41 hours',
    'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'b8f00000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '48 hours', now() - interval '47 hours',
    'America/Sao_Paulo', 'confirmed', 'paid'
  ),
  (
    'b8f00000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    now() - interval '54 hours', now() - interval '53 hours',
    'America/Sao_Paulo', 'confirmed', 'paid'
  );

insert into public.session_payments (
  id, booking_id, patient_profile_id, therapist_profile_id, service_id,
  policy_version_id, gross_amount_cents, platform_commission_bps,
  platform_gross_commission_cents, therapist_amount_cents, currency,
  financial_status, service_status, transfer_status,
  stripe_charge_id, stripe_balance_transaction_id, paid_at
)
values
  (
    'b8e00000-0000-4000-8000-000000000001',
    'b8f00000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where is_active),
    17000, 1500, 2550, 14450, 'BRL',
    'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
    'ch_local_feedback_browser_1', 'txn_local_feedback_browser_1', now() - interval '31 hours'
  ),
  (
    'b8e00000-0000-4000-8000-000000000002',
    'b8f00000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000004',
    '93000000-0000-4000-8000-000000000017',
    (select id from public.financial_policy_versions where is_active),
    15000, 1500, 2250, 12750, 'BRL',
    'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
    'ch_local_feedback_browser_2', 'txn_local_feedback_browser_2', now() - interval '36 hours'
  ),
  (
    'b8e00000-0000-4000-8000-000000000003',
    'b8f00000-0000-4000-8000-000000000003',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where is_active),
    17000, 1500, 2550, 14450, 'BRL',
    'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
    'ch_local_feedback_browser_3', 'txn_local_feedback_browser_3', now() - interval '41 hours'
  ),
  (
    'b8e00000-0000-4000-8000-000000000004',
    'b8f00000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where is_active),
    17000, 1500, 2550, 14450, 'BRL',
    'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
    'ch_local_feedback_browser_4', 'txn_local_feedback_browser_4', now() - interval '47 hours'
  ),
  (
    'b8e00000-0000-4000-8000-000000000005',
    'b8f00000-0000-4000-8000-000000000005',
    '91000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000011',
    '93000000-0000-4000-8000-000000000020',
    (select id from public.financial_policy_versions where is_active),
    17000, 1500, 2550, 14450, 'BRL',
    'paid', 'occurred_pending_confirmation', 'waiting_confirmation',
    'ch_local_feedback_browser_5', 'txn_local_feedback_browser_5', now() - interval '53 hours'
  );
