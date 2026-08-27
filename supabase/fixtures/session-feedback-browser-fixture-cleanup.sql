-- Removes only the temporary patient-feedback browser fixture.

delete from public.financial_ledger_entries
where session_payment_id in (
  'b8e00000-0000-4000-8000-000000000001'::uuid,
  'b8e00000-0000-4000-8000-000000000002'::uuid
);
delete from public.booking_payment_receipts
where booking_id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid
);
delete from public.payments
where booking_id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid
);
delete from public.session_payments
where id in (
  'b8e00000-0000-4000-8000-000000000001'::uuid,
  'b8e00000-0000-4000-8000-000000000002'::uuid
);
delete from public.bookings
where id in (
  'b8f00000-0000-4000-8000-000000000001'::uuid,
  'b8f00000-0000-4000-8000-000000000002'::uuid
);
