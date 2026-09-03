alter table public.session_payments
  add column if not exists stripe_balance_status text,
  add column if not exists stripe_balance_available_on timestamptz,
  add column if not exists stripe_balance_checked_at timestamptz;

alter table public.session_payments
  drop constraint if exists session_payments_stripe_balance_status_check;

alter table public.session_payments
  add constraint session_payments_stripe_balance_status_check
  check (stripe_balance_status is null or stripe_balance_status in ('pending', 'available'));

create index if not exists session_payments_settlement_candidates_idx
  on public.session_payments (stripe_balance_status, stripe_balance_available_on, eligible_at)
  where financial_status in ('paid', 'partially_refunded')
    and transfer_status in ('waiting_safety_period', 'waiting_settlement', 'eligible');

comment on column public.session_payments.stripe_balance_status is
  'Last verified status of the source Charge Balance Transaction. Only available may authorize weekly Transfer eligibility.';

comment on column public.session_payments.stripe_balance_available_on is
  'Provider availability instant from the source Charge Balance Transaction.';

comment on column public.session_payments.stripe_balance_checked_at is
  'Instant when the source Charge Balance Transaction snapshot was verified against Stripe.';
