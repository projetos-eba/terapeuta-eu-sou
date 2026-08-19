---
name: therapist-finance
description: Use when working on the therapist shell financial page, private financial read models, receipts, payouts, Stripe Connect account status, or finance UI under /terapeuta/financeiro.
---

# Therapist Finance

Read `AGENTS.md`, `docs/payments/architecture.md`,
`docs/payments/therapist-finance-f0-f1.md` and
`docs/architecture/adr/ADR-012-therapist-finance-f0-f1.md`,
`docs/architecture/adr/ADR-013-therapist-finance-f2-metrics.md` and
`docs/architecture/adr/ADR-014-therapist-finance-f3-advanced-dashboard.md`
before editing this area.

## Route

Canonical route: `/terapeuta/financeiro`.

Supported tabs:

- `/terapeuta/financeiro`;
- `/terapeuta/financeiro?tab=recebimentos`;
- `/terapeuta/financeiro?tab=repasses`;
- `/terapeuta/financeiro?tab=conta`.

Technical aliases `receipts`, `payouts` and `account` are accepted as
compatibility input only.

Do not add a dedicated history tab. Older records belong in paginated receipts
and payouts lists.

## Sources

- Canonical payment source: `session_payments`.
- Refunds: `session_refunds`.
- Disputes: `session_disputes`.
- Payout batches: `payout_batches`, `payout_batch_therapists`,
  `payout_batch_items`.
- Transfers: `stripe_transfers`, `stripe_transfer_reversals`.
- Connect state: `therapist_connect_accounts`.

Never use `bookings.payment_status` for balances or financial authority.

## Contracts

Private RPCs:

- `get_private_therapist_financial_overview_v1`;
- `get_private_therapist_receipts_v1`;
- `get_private_therapist_payouts_v1`;
- `get_private_therapist_connect_account_v1`.
- `get_private_therapist_financial_metrics_v1` for F2 Premium/Premium Plus
  summary metrics.
- `get_private_therapist_advanced_financial_dashboard_v1` for F3 Premium Plus
  advanced dashboard.
- Segmented F3 contracts:
  `get_private_therapist_financial_forecast_v1`,
  `get_private_therapist_agenda_revenue_potential_v1`,
  `get_private_therapist_financial_opportunities_v1`,
  `get_private_therapist_retention_analytics_v1` and
  `get_private_therapist_financial_benchmark_v1`.

All derive the therapist from `auth.uid()`. Do not accept
`therapist_profile_id` from the browser as authority.

## UI Rules

- Four tabs only: Resumo, Recebimentos, Repasses, Conta de recebimento.
- Values are integer cents from read models; frontend only formats.
- Formula: Valor bruto das sessões - Comissão TES - Reembolsos ao cliente when
  present = Valor líquido do terapeuta.
- Do not show Stripe fees as therapist discounts.
- Payment method and payment origin are separate.
- No local form for bank, agency, account, Pix, CPF, CNPJ or documents.
- Use hosted Stripe Connect CTAs and sync state after return.
- Connect Accounts v2 creation for the Brazilian TES platform must include
  `identity.country = br`, `identity.entity_type = individual`,
  recipient `stripe_balance.stripe_transfers` and merchant `card_payments`.
  Keep session charges on the platform with separate charges and transfers.
- Connect creation is idempotent by therapist and environment; onboarding
  retries reuse the persisted account and create a fresh Account Link. Login
  Link is only allowed after synchronized readiness.
- Operation is available to Free, Premium and Premium Plus.
- F2 summary metrics use `advanced_metrics` and are available to Premium and
  Premium Plus. Free keeps the F0/F1 operational summary plus an upgrade card.
- F3 advanced dashboard uses `advanced_financials` and is available only to
  Premium Plus. Premium sees an upgrade card and keeps F2.
- F4 operational payout lifecycle uses the existing authorities: Stripe webhook
  marks payment, `confirm_session_service` records realization,
  `refresh_session_transfer_eligibility` applies the safety period,
  `create_weekly_payout_batch` reserves eligible payments and
  `process-payout-batch` creates Connect Transfers with `source_transaction`.
- Realized, contracted and estimated values must remain visually separated.
- Potential agenda revenue is an estimate, not guaranteed revenue, and never
  affects ledger, payouts or balances.
- Benchmark must be anonymized and suppressed below 20 therapists or 100
  sessions aggregated.
- Insight TES financial copy must be generated from deterministic rules and
  returned evidence, not static celebration or generative AI.
- The main average-ticket UI is net average ticket; gross average ticket is a
  detail.
- Test-mode temporal overrides are allowed only for internal operations with
  `TES_FINANCE_TEST_CONTROLS_ENABLED=true` and Stripe test mode; never expose
  them to browser flows or production.

## Figma

Reference file: `Z42SR0Pi0m307SmcAkDqHb`.

Frames:

- Resumo: `14242:1347`;
- Recebimentos: `14340:6279`;
- Repasses: `14246:1347`;
- Conta de recebimento: `14340:6282`, visual reference only.

Respect hierarchy, spacing and density, but do not copy unsupported product
features or bank-form fields.

## QA

Run focused tests for `src/features/therapist-finance`, Connect Deno tests and
pgTAP finance tests. For full delivery, run the standard project validation:
format, lint, typecheck, unit tests, Deno, build, Supabase reset/lint/test db.

## Assets da plataforma

- O cabeçalho usa `therapistFinanceHero` com fade à esquerda; o asset é
  decorativo e não altera valores, abas, read models ou a operação Stripe.
- Consulte `docs/design-system/platform-assets.md`.
