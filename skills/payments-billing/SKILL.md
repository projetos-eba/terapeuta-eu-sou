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
- Stripe fees are TES cost and must not reduce the therapist 85% share for
  new payments under the active 15% policy; historical snapshots retain their
  own contracted split.
- Connect transfer and bank payout are different events.
- Connect Accounts v2 creation must send the Brazilian identity country plus
  the recipient transfer capability and the merchant card payment capability
  required by Stripe; this does not change the TES separate charges and
  transfers model.
- Payment confirmed is not service performed.
- Under legacy V9, eligibility requires paid payment, bilateral service
  confirmation, an available and recently verified source Charge Balance
  Transaction, Connect readiness, and no refund/dispute/block. There is no
  additional local safety waiting period after confirmation.
- V10 is a separate, initially inactive contract: reserve with SetupIntent
  `usage=off_session`, charge at T-24 (or immediately at 24 hours or less), and
  enqueue the therapist Transfer as soon as Stripe confirms payment. Session
  confirmation and evaluation remain auditable product signals but are not a
  V10 financial gate.
- The local-only Phase 2 and Phase 3 flows are behind an explicit flag and default to
  V9. A successful future SetupIntent is bound to the exact booking version,
  Customer and PaymentMethod only by the signed `checkout.session.completed`
  webhook; it schedules T-24 without marking the card payment paid. The draft
  booking's legacy payment projection can advance its version during V10
  preparation, so always use the persisted version returned after that insert.
  The local T-24 worker creates one off-session PaymentIntent with the schedule
  idempotency key. Customer action reuses that exact PaymentIntent through an
  authenticated recovery preflight; a replacement card must never create a
  second PaymentIntent. No V10 cron is active. The local direct Transfer worker
  creates a source-linked obligation against the frozen Connect account and
  compensates existing therapist debt before it calls Stripe.
  A full debt offset creates no Stripe Transfer and must be projected to users
  as `Compensado`, with zero bank-bound net amount and no contribution to
  processing totals or status charts.
- Local V10 Refund and Transfer Reversal webhooks reconcile each provider
  object by its Stripe ID through service-role transactional RPCs. Preserve
  partial amounts, source-Charge and frozen Connect bindings, ledger
  idempotency, and the separate V9 path. These project observed provider
  events only. The local V10 support command accepts only a full-session
  refund, records one audited decision and blocks room/transfer access before
  calling Stripe. Recovery is attempted once against the frozen Transfer; a
  definite insufficient-balance result becomes internal therapist debt after
  the full customer refund succeeds. Ambiguous provider outcomes require
  reconciliation, never a blind retry. Provider-originated partial refunds
  remain observable for manual analysis but are not offered by TES. The real
  Stripe Test, signed webhook delivery and authenticated admin-browser gates
  for the local full-refund path were exercised in Phase 5. Phase 6 is also
  closed locally: therapist and admin projections merge V9/V10 without
  duplication, show contractual amount, debt compensation and bank-bound
  amount separately, and reserve `Pago` for a fully reconciled bank payout.
  This does not authorize HML or production activation.
  Payment-recovery messages must cover both bank confirmation and card
  replacement without claiming a definitive decline. Never expose provider
  object names, policy nicknames, scheduler names or architecture terms in
  customer, therapist or administrator UI and e-mail copy.
  Never infer authorization to issue a Refund from a webhook or treat a
  partial reversal as a fully reversed Transfer.
- The TES, nesta versao, nao emite nota fiscal. Para cobranca e comprovacao de pagamento, sao utilizadas invoices e recibos gerados pela Stripe. Esses documentos nao devem ser apresentados como substitutos de nota fiscal.

## Invariants

- Never trust money, Price IDs, Customer IDs, PaymentIntent IDs, transfer IDs, or plan activation from the browser.
- Never treat `checkout=success`, `session_id`, `plan`, or any browser-provided
  status as sufficient evidence; recover the object from Stripe and validate
  therapist ownership before syncing.
- Use integer cents and basis points only.
- Preserve policy snapshots through `financial_policy_versions`; commission
  changes create a new policy version and never rewrite existing payments,
  ledger entries, payout batches or transfers.
- Use Separate Charges and Transfers. V9 keeps its weekly Transfer gate. When
  V10 is explicitly activated, create the 85% direct Transfer obligation
  immediately after confirmed payment, with the original Charge as
  `source_transaction`; never wait for session confirmation or settlement to
  enqueue it.
- Use Stripe idempotency keys for creating checkout sessions, refunds, schedules, and transfers.
- Webhooks must read raw body and verify Stripe signature.
- Webhook events must be idempotent and must not reopen `processed` events.
- When a worker persists a Stripe object before the signed webhook arrives, it
  must use the provider object's own `created` instant as the event instant.
  Never use the worker's local clock as Stripe event authority: doing so can
  make the later signed event look stale and prevent enrichment of payment
  method, receipt and balance-transaction evidence. A missing or invalid
  provider instant must fail closed and enter the existing retry path.
- For a V10 charge incomplete at session start, retrieve Stripe state before
  releasing the booking. Reconcile a late success, keep `processing` fail-closed
  with an incident, and close only a never-created or canceled PaymentIntent.
  The closure must be idempotent, release the occupied interval, keep Zoom
  blocked, create no Transfer obligation, and notify both participants in
  end-user language.
- V10 self-service cancellation is allowed only when the T-24 schedule is still
  `scheduled`, has zero attempts and no PaymentIntent, Charge, lease, Transfer
  job or Transfer. The transaction cancels the schedule and setup, releases a
  reserved promotion, closes the payment without Refund and cancels the
  booking. Claimed, retried, ambiguous or paid states go to support.
- A V10 patient reschedule before charging must reuse the SetupIntent and
  PaymentMethod bound to that booking; never create or replace a global default
  card. It supersedes the old schedule and leaves exactly one active schedule
  whose `expected_booking_version` matches the current booking version. T-24 is
  recalculated from the new start; a due time at or before now is immediately
  claimable by the charge worker. A claimed schedule, PaymentIntent, Charge or
  Transfer must fail closed and go to support. Never apply a V9 refund decision
  or reschedule mutation to V10.
- Coupon defines the financial benefit; Promotion Code is resolved server-side
  and must carry `tes_checkout_scope`. Subscription Coupons must explicitly
  list eligible Stripe Products. Never maintain a parallel local coupon list.
- Applying or removing a code replaces the Checkout Session. Non-success
  events from superseded attempts cannot mutate the current session payment;
  a real paid older attempt remains authoritative and closes siblings.
- An expired V10 Checkout retry must honor the explicit `payment_retry` mode;
  never infer an initial hold merely because the booking was already reopened.
  Replacing the terminal current Checkout is allowed only through the
  idempotent V10 retry command. If that command reopened the booking before a
  provider or persistence failure, a repeated call may resume only while the
  current attempt is terminal and unclaimed and no succeeded setup, active
  schedule, PaymentIntent, Charge, transfer job or Transfer exists. The
  authenticated retry page must require the server-derived `canRetry` flag.
- Webhook reservation must be atomic; failed/stale leases may be retried.
- Checkout completion only confirms a session when `payment_status` is paid.
- Legacy V9 Session Checkout uses `capture_method=manual`. For `initial_hold`, the
  database deadline is five minutes; for `payment_retry`, no slot is occupied
  before authorization. On `payment_intent.amount_capturable_updated`, the
  service-role claim RPC locks therapist then patient, revalidates the current
  attempt and slot, and only the winner captures. A loser cancels the
  authorization and records `slot_conflict`.
- A consumed initial hold without persisted Stripe Checkout must be released by
  `cancel_unstarted_initial_checkout_v1`; maintenance also sweeps expired
  bootstrap orphans. Never cancel when a Checkout Session is already persisted.
- `cancelled_by_payment -> pending_payment` is forbidden to RLS, direct SQL and
  generic booking commands; only `claim_session_payment_authorization_v1` may
  reopen it. Superseded attempts never release or confirm the current one.
- Subscription plan comes from the effective Stripe Price mapping.
- Paid catalog Prices are monthly only. Public catalog reads require
  `is_public=true`; hidden offers require a server-resolved `offer_key` and
  are never browser-selectable.
- `TERAPEUTAFUNDADOR` is a Premium Plus monthly campaign: three
  invoices at 100% discount followed by the hidden R$ 79,90 monthly Price.
  Checkout always collects a payment method. Test Mode stays active for
  homologation; Live Mode is provisioned inactive for manual activation.
  Plan changes select a normal public Price and do not preserve the founder
  Price.
- Subscription upgrade is immediate and prorated; Premium Plus to Premium uses
  a Subscription Schedule at period end; cancellation uses
  `cancel_at_period_end` and can be reversed without removing already-paid
  benefits.
- Separate transfers require the session Charge as `source_transaction`.
- Under V9, do not mark a session payment `eligible` until its source Charge Balance
  Transaction is `available`, `available_on` has passed, and the Stripe snapshot
  is recent. Use `waiting_settlement` before that gate; reconcile hourly and
  again at the weekly cutoff.
- Ledger is append-only; use compensating entries.
- Refunds, disputes, internal contests, and admin blocks prevent payout.
- O novo cancelamento solicitado pelo terapeuta sem resolução não executa
  Stripe automaticamente: deve entrar em revisão explícita Admin TES,
  bloquear sala, falta e repasse e preservar decisão/auditoria/idempotência.
  A regra de sete dias e refund automático por silêncio foram adiados. Este
  workflow não está liberado para produção até os gates de banco e
  homologação. O comando V10 de reembolso integral reconhece a revisão e
  reconcilia o Transfer Reversal aplicável antes de confirmar o reembolso;
  nunca acrescente uma chamada Stripe automática ao prazo ou à decisão do
  participante.
- A session cancellation must claim exactly one local financial decision before
  it calls Stripe. `session_cancellation_decisions.request_id` is the command
  idempotency key and `claim_session_cancellation_decision_v1` is service-role
  only; retries reuse the stored decision, Stripe refund key, and booking
  transition request id.
- TES does not collect bank, KYC, identity, or tax details for connected accounts; Stripe-hosted onboarding does.
- Do not call Stripe invoices or receipts "nota fiscal".
- Financial status charts must map every receipt status explicitly to a stable,
  semantically distinct color. Keep the textual legend and amounts so color is
  never the only status cue, and key legend entries by the canonical status
  rather than by translated labels that may repeat.

## Architecture Map

Tables: `billing_plans`, `billing_plan_prices`, `stripe_customers`, `therapist_subscriptions`, `billing_invoices`, `therapist_connect_accounts`, `session_payments`, `session_payment_attempts`, `session_payment_setups`, `session_payment_schedules`, `session_promotion_reservations`, `session_refunds`, `session_cancellation_decisions`, `session_disputes`, `session_service_confirmations`, `payout_batches`, `payout_batch_items`, `stripe_transfers`, `session_transfer_jobs`, `stripe_transfer_reversals`, `stripe_payouts`, `stripe_payout_transfer_allocations`, `therapist_financial_debts`, `therapist_financial_debt_events`, `therapist_financial_debt_allocations`, `payout_scheduler_runs`, `payout_operational_incidents`, `financial_ledger_entries`, `stripe_webhook_events`, `financial_policy_versions`.

Shared modules: `supabase/functions/_shared/payments/runtime.ts`, `stripe-client.ts`, `connect.ts`, `http.ts`, `idempotency.ts`, `money.ts`, `promotion-codes.ts`, `session-attempt-policy.ts`, `subscription-sync.ts`.

Edge Functions:

- Billing: `stripe-sync-billing-catalog`, `stripe-create-subscription-checkout`, `stripe-subscription-checkout-status`, `stripe-change-therapist-subscription`, `stripe-cancel-therapist-subscription`, `stripe-create-billing-portal`, `stripe-billing-webhook`.
- Connect: `stripe-connect-create-account`, `stripe-connect-create-account-link`, `stripe-connect-create-login-link`, `stripe-connect-sync-account`, `stripe-connect-webhook`.
- Sessions and payouts: `stripe-create-session-payment`, `reservation-checkout-maintenance`, `request-session-cancellation`, `confirm-session-by-therapist`, `auto-confirm-sessions`, `evaluate-transfer-eligibility`, `create-weekly-payout-batch`, `process-payout-batch`, `retry-failed-payout-items`, `reconcile-stripe-transfers`, `weekly-payout-scheduler`, `stripe-connect-payout-schedule`.
- Read `docs/payments/weekly-payouts.md` before changing weekly batches, Balance Settings, Transfer/Payout states, retry, reconciliation or alerts.
- `payouts_enabled` comes from Balance Settings, never from the Transfer capability. Scheduler must not auto-correct the payout schedule.
- ADR-018 remains authoritative for legacy V9: weekly TES Transfers followed
  by Stripe automatic daily Payouts. The approved V10 implementation contract
  is `docs/payments/session-financial-flow-v10-implementation-plan.md`; its
  policy must remain inactive until the rollout gate. Persist
  `destination_payment`, import Payouts without
  TES metadata and reconcile `balance_transactions?payout=...` into the
  allocation table. Each Transfer belongs to one Payout; batches and Payouts
  derive the many-to-many relation. Exclude the aggregate Payout debit from the
  component list and require full Transfer allocation before bank-paid status.
- A Transfer creates the ledger debit; the Payout is a separate bank-delivery state and must not create a second ledger debit.
- Only `payout.paid` queues payout success. Accept and escalate a later `payout.failed`.

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
3. Start functions: `npm run dev:functions`. For signed Stripe Test webhook
   homologation, use `npm run dev:functions:webhooks` instead; it starts the
   listener and Functions with one ephemeral, redacted signing secret.
4. Start Next: `npm run dev`.
5. Start Stripe listener: `npm run payments:webhooks:listen` only when the
   combined command from step 3 is not already running.
6. Validate Test Mode destinations: `npm run payments:webhooks:verify:test`.
   For the linked HML project, use the read-only verifier with
   `--target=test --project-ref=emzwqkmrryuqvqiohqnu` and load
   `supabase/functions/.env.homolog` only in that process. Matching the event
   names alone is insufficient: require the exact HTTPS Supabase host and
   Function path. Never run the configuration script as an audit.
7. Validate env: `npm run payments:env`.
8. Sync catalog: `npm run payments:catalog:sync`.
9. Verify catalog: `npm run payments:catalog:verify`.
10. Create E2E data: `npm run payments:e2e:seed`.
11. Run headed payment navigation: `npm run test:e2e:payments:headed`.
12. Inspect failed Stripe events in `stripe_webhook_events`.
13. Cleanup E2E data: `npm run payments:e2e:cleanup`.
14. For joint Stripe session payment + Zoom Video SDK homologation, run
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
- Transfer based only on a browser redirect or unverified payment. V10 must
  enqueue the direct Transfer after the signed, reconciled paid event, without
  waiting for service confirmation; V9 keeps its own eligibility gate.
- Logs of secrets, client secrets, raw Stripe payloads, card data, documents, or bank data.
- Custom TES forms for Connect bank/KYC data.
- Deleting financial history instead of compensating.
- Calling Stripe invoice/receipt a tax invoice or nota fiscal.
