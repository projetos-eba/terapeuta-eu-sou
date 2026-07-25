---
name: payments-billing
description: Use when working on TES Stripe Billing, therapist subscriptions, checkout, invoices, session payments, Stripe Connect onboarding, platform commission, ledger, refunds, disputes, payout batches, transfers, reconciliation, payment webhooks, payment secrets, E2E payment data, or financial tests.
---

# Payments Billing

Use this skill for every change in TES payments. Read `AGENTS.md`, `docs/payments/architecture.md`, `docs/payments/stripe-secrets-setup.md`, and `docs/payments/internal-operations-token.md` before editing code.

## Boundaries

- Therapist subscriptions use Stripe Billing and activate paid plans only from signed webhooks.
- Patient session payments use Stripe Checkout/PaymentIntent and `session_payments` as the canonical financial source.
- TES revenue is subscription revenue plus platform commission. Therapist share is a payable obligation until transfer.
- Stripe fees are TES cost and must not reduce the therapist 80% share.
- Connect transfer and bank payout are different events.
- Payment confirmed is not service performed.
- Eligibility requires paid payment, service confirmation, safety period, Connect readiness, and no refund/dispute/block.
- The TES, nesta versao, nao emite nota fiscal. Para cobranca e comprovacao de pagamento, sao utilizadas invoices e recibos gerados pela Stripe. Esses documentos nao devem ser apresentados como substitutos de nota fiscal.

## Invariants

- Never trust money, Price IDs, Customer IDs, PaymentIntent IDs, transfer IDs, or plan activation from the browser.
- Use integer cents and basis points only.
- Preserve policy snapshots through `financial_policy_versions`.
- Use Separate Charges and Transfers; never transfer at charge time.
- Use Stripe idempotency keys for creating checkout sessions, refunds, schedules, and transfers.
- Webhooks must read raw body and verify Stripe signature.
- Webhook events must be idempotent and must not reopen `processed` events.
- Ledger is append-only; use compensating entries.
- Refunds, disputes, internal contests, and admin blocks prevent payout.
- TES does not collect bank, KYC, identity, or tax details for connected accounts; Stripe-hosted onboarding does.
- Do not call Stripe invoices or receipts "nota fiscal".

## Architecture Map

Tables: `billing_plans`, `billing_plan_prices`, `stripe_customers`, `therapist_subscriptions`, `billing_invoices`, `therapist_connect_accounts`, `session_payments`, `session_payment_attempts`, `session_refunds`, `session_cancellation_decisions`, `session_disputes`, `session_service_confirmations`, `payout_batches`, `payout_batch_items`, `stripe_transfers`, `stripe_transfer_reversals`, `financial_ledger_entries`, `stripe_webhook_events`, `financial_policy_versions`.

Shared modules: `supabase/functions/_shared/payments/runtime.ts`, `stripe-client.ts`, `connect.ts`, `http.ts`, `idempotency.ts`, `money.ts`.

Edge Functions:

- Billing: `stripe-sync-billing-catalog`, `stripe-create-subscription-checkout`, `stripe-change-therapist-subscription`, `stripe-cancel-therapist-subscription`, `stripe-create-billing-portal`, `stripe-billing-webhook`.
- Connect: `stripe-connect-create-account`, `stripe-connect-create-account-link`, `stripe-connect-create-login-link`, `stripe-connect-sync-account`, `stripe-connect-webhook`.
- Sessions and payouts: `stripe-create-session-payment`, `request-session-cancellation`, `confirm-session-by-therapist`, `auto-confirm-sessions`, `evaluate-transfer-eligibility`, `create-weekly-payout-batch`, `process-payout-batch`, `retry-failed-payout-items`, `reconcile-stripe-transfers`.

## Secrets

- `STRIPE_SECRET_KEY`: server-side API key; accepts `sk_*` or `rk_*`; rejects `pk_*`.
- `STRIPE_WEBHOOK_SECRET`: local Stripe CLI fallback.
- `STRIPE_PLATFORM_WEBHOOK_SECRET`: platform endpoint signing secret.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: connected-account endpoint signing secret.
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

## Testing Rules

- Run unit tests, SQL migration reset, RLS checks where applicable, Stripe CLI tests, duplicate webhook tests, out-of-order event tests, retry tests, and reconciliation checks.
- Payment navigation tests must run with a visible browser. Do not validate financial flows exclusively in headless.
- E2E must use real Supabase Auth users and RLS, no auth bypass.
- Use Stripe test mode only and never real cards.
- Do not persist passwords, tokens, card data, or secrets in screenshots, traces, or reports.

## Prohibited Practices

- Hardcoded Price IDs in React.
- Floats for money.
- Plan activation by redirect query string.
- Automatic transfer on payment.
- Logs of secrets, client secrets, raw Stripe payloads, card data, documents, or bank data.
- Custom TES forms for Connect bank/KYC data.
- Deleting financial history instead of compensating.
- Calling Stripe invoice/receipt a tax invoice or nota fiscal.
