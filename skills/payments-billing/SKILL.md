---
name: payments-billing
description: Use when working on TES Stripe Billing, therapist subscriptions, checkout, invoices, session payments, Stripe Connect onboarding, platform commission, ledger, refunds, disputes, payout batches, transfers, reconciliation, payment webhooks, payment secrets, E2E payment data, or financial tests.
---

# Payments Billing

Use this skill for every change in TES payments. Read `AGENTS.md`, `docs/payments/architecture.md`, `docs/payments/promotion-codes.md`, `docs/payments/stripe-secrets-setup.md`, and `docs/payments/internal-operations-token.md` before editing code.

## Boundaries

- Therapist subscriptions use Stripe Billing and activate paid plans only from
  signed webhooks or authenticated server-side reconciliation against Stripe
  Checkout Session/Subscription.
- Patient session payments use Stripe Checkout/PaymentIntent and `session_payments` as the canonical financial source.
- TES revenue is subscription revenue plus platform commission. Therapist share is a payable obligation until transfer.
- Stripe fees are TES cost and must not reduce the therapist 80% share.
- Connect transfer and bank payout are different events.
- Connect Accounts v2 creation must send the Brazilian identity country plus
  the recipient transfer capability and the merchant card payment capability
  required by Stripe; this does not change the TES separate charges and
  transfers model.
- Payment confirmed is not service performed.
- Eligibility requires paid payment, service confirmation, safety period, Connect readiness, and no refund/dispute/block.
- The TES, nesta versao, nao emite nota fiscal. Para cobranca e comprovacao de pagamento, sao utilizadas invoices e recibos gerados pela Stripe. Esses documentos nao devem ser apresentados como substitutos de nota fiscal.

## Invariants

- Never trust money, Price IDs, Customer IDs, PaymentIntent IDs, transfer IDs, or plan activation from the browser.
- Never treat `checkout=success`, `session_id`, `plan`, or any browser-provided
  status as sufficient evidence; recover the object from Stripe and validate
  therapist ownership before syncing.
- Use integer cents and basis points only.
- Preserve policy snapshots through `financial_policy_versions`.
- Use Separate Charges and Transfers; never transfer at charge time.
- Use Stripe idempotency keys for creating checkout sessions, refunds, schedules, and transfers.
- Webhooks must read raw body and verify Stripe signature.
- Webhook events must be idempotent and must not reopen `processed` events.
- Coupon defines the financial benefit; Promotion Code is resolved server-side
  and must carry `tes_checkout_scope`. Subscription Coupons must explicitly
  list eligible Stripe Products. Never maintain a parallel local coupon list.
- Applying or removing a code replaces the Checkout Session. Non-success
  events from superseded attempts cannot mutate the current session payment;
  a real paid older attempt remains authoritative and closes siblings.
- Webhook reservation must be atomic; failed/stale leases may be retried.
- Checkout completion only confirms a session when `payment_status` is paid.
- Subscription plan comes from the effective Stripe Price mapping.
- Subscription upgrade is immediate and prorated; Premium Plus to Premium uses
  a Subscription Schedule at period end; cancellation uses
  `cancel_at_period_end` and can be reversed without removing already-paid
  benefits.
- Separate transfers require the session Charge as `source_transaction`.
- Ledger is append-only; use compensating entries.
- Refunds, disputes, internal contests, and admin blocks prevent payout.
- A session cancellation must claim exactly one local financial decision before
  it calls Stripe. `session_cancellation_decisions.request_id` is the command
  idempotency key and `claim_session_cancellation_decision_v1` is service-role
  only; retries reuse the stored decision, Stripe refund key, and booking
  transition request id.
- TES does not collect bank, KYC, identity, or tax details for connected accounts; Stripe-hosted onboarding does.
- Do not call Stripe invoices or receipts "nota fiscal".

## Architecture Map

Tables: `billing_plans`, `billing_plan_prices`, `stripe_customers`, `therapist_subscriptions`, `billing_invoices`, `therapist_connect_accounts`, `session_payments`, `session_payment_attempts`, `session_refunds`, `session_cancellation_decisions`, `session_disputes`, `session_service_confirmations`, `payout_batches`, `payout_batch_items`, `stripe_transfers`, `stripe_transfer_reversals`, `financial_ledger_entries`, `stripe_webhook_events`, `financial_policy_versions`.

Shared modules: `supabase/functions/_shared/payments/runtime.ts`, `stripe-client.ts`, `connect.ts`, `http.ts`, `idempotency.ts`, `money.ts`, `promotion-codes.ts`, `session-attempt-policy.ts`, `subscription-sync.ts`.

Edge Functions:

- Billing: `stripe-sync-billing-catalog`, `stripe-create-subscription-checkout`, `stripe-subscription-checkout-status`, `stripe-change-therapist-subscription`, `stripe-cancel-therapist-subscription`, `stripe-create-billing-portal`, `stripe-billing-webhook`.
- Connect: `stripe-connect-create-account`, `stripe-connect-create-account-link`, `stripe-connect-create-login-link`, `stripe-connect-sync-account`, `stripe-connect-webhook`.
- Sessions and payouts: `stripe-create-session-payment`, `request-session-cancellation`, `confirm-session-by-therapist`, `auto-confirm-sessions`, `evaluate-transfer-eligibility`, `create-weekly-payout-batch`, `process-payout-batch`, `retry-failed-payout-items`, `reconcile-stripe-transfers`.

## Secrets

- `STRIPE_SECRET_KEY`: server-side API key; accepts `sk_*` or `rk_*`; rejects `pk_*`.
- `STRIPE_WEBHOOK_SECRET`: local Stripe CLI fallback.
- `STRIPE_PLATFORM_WEBHOOK_SECRET`: platform endpoint signing secret.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: connected-account endpoint signing secret.
- `STRIPE_CONNECT_V2_WEBHOOK_SECRET`: Accounts v2 thin destination signing secret.
- `PAYMENTS_INTERNAL_OPERATIONS_TOKEN`: machine-to-machine token. Use only with `x-tes-internal-operations-token`. See `docs/payments/internal-operations-token.md`.

Never expose, log, screenshot, or write real secret values.

## Runbook

1. Start Supabase: `npx supabase start`.
2. Apply migrations: `npx supabase db reset`.
3. Start functions: `npm run dev:functions`.
4. Start Next: `npm run dev`.
5. Start Stripe listener: `npm run payments:webhooks:listen`.
6. Validate env: `npm run payments:env`.
7. Sync catalog: `npm run payments:catalog:sync`.
8. Verify catalog: `npm run payments:catalog:verify`.
9. Create E2E data: `npm run payments:e2e:seed`.
10. Run headed payment navigation: `npm run test:e2e:payments:headed`.
11. Inspect failed Stripe events in `stripe_webhook_events`.
12. Cleanup E2E data: `npm run payments:e2e:cleanup`.
13. For joint Stripe session payment + Zoom Video SDK homologation, run
    `npm run homologation:zoom:local` and require canonical webhook evidence
    before any real Zoom session.

## Testing Rules

- Run unit tests, SQL migration reset, RLS checks where applicable, Stripe CLI tests, duplicate webhook tests, out-of-order event tests, retry tests, and reconciliation checks.
- Payment navigation tests must run with a visible browser. Do not validate financial flows exclusively in headless.
- `/terapeuta/checkout?checkout=success&session_id=...` must not mount a new
  embedded Checkout; it must poll the authenticated status route with a bounded
  retry window.
- When that authenticated status route returns a Stripe-confirmed paid
  subscription as `active`, the web session may refresh its auxiliary plan
  cookie and the checkout UI must redirect to `/terapeuta`.
- `/terapeuta/plano` reads catalog prices from `billing_plan_prices`; it must
  fail closed instead of substituting static or demonstrative prices.
- `/terapeuta/configuracoes#plano-assinatura` represents scheduled plan changes
  from subscription metadata and never changes entitlements before the
  effective date.
- E2E must use real Supabase Auth users and RLS, no auth bypass.
- For cancellation/refund flows, test duplicate command IDs, concurrent
  command IDs for the same booking, divergent idempotency reuse, and retry
  after a provider failure. Verify the booking transition and local decision
  before treating a Stripe response as success.
- Use Stripe test mode only and never real cards.
- Validate Promotion Codes for session, Premium, Premium Plus and both
  Products, including remove/reapply, concurrent replacement, hosted fallback,
  locale `pt-BR`, zero-total session completion through the signed webhook and
  out-of-order superseded events.
- Do not persist passwords, tokens, card data, or secrets in screenshots, traces, or reports.

## Prohibited Practices

- Hardcoded Price IDs in React.
- Floats for money.
- Plan activation by redirect query string.
- Return URLs hardcoded to `/basico/*`, `/pro/*`, or `/plus/*`; use canonical
  `/terapeuta/*` destinations.
- Automatic transfer on payment.
- Logs of secrets, client secrets, raw Stripe payloads, card data, documents, or bank data.
- Custom TES forms for Connect bank/KYC data.
- Deleting financial history instead of compensating.
- Calling Stripe invoice/receipt a tax invoice or nota fiscal.
