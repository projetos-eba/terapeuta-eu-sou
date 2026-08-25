# Stripe Phase 3 Homologation

Last updated: 2026-08-10

## Scope

Phase 3 validates Stripe in two stages:

- **3A HML test mode**: real HML navigation, Stripe test mode Checkout, signed webhook replay, Supabase state convergence and idempotency checks.
- **3B LIVE readiness**: configuration-only validation for live mode. No live charge, payout, refund or onboarding completion is executed without a separate go/no-go.

Browser redirects never activate plans or bookings by themselves. The accepted source of truth remains Stripe server-side plus signed webhook/reconciliation and persisted Supabase state.

## Required Environment

Set these only in the process running the validation. Do not commit them.

- `PLAYWRIGHT_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PLATFORM_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET`
- `PAYMENTS_HML_PATIENT_EMAIL`
- `PAYMENTS_HML_PATIENT_PASSWORD`
- `PAYMENTS_HML_PUBLIC_THERAPIST_SLUG`
- `PAYMENTS_E2E_PASSWORD`

For HML, `SUPABASE_URL` must point to project ref `emzwqkmrryuqvqiohqnu` and `STRIPE_SECRET_KEY` must be test mode.
Do not rely on `supabase status` fallback for HML evidence; set `SUPABASE_URL`
or `NEXT_PUBLIC_SUPABASE_URL` explicitly for the target environment.

## HML Readiness

```bash
npm run payments:phase3:readiness:hml
```

This writes sanitized evidence under `test-results/stripe-phase3/` and checks:

- Supabase HML project ref.
- Stripe test mode.
- Billing catalog prices against Stripe.
- Platform and Connect webhook endpoints.
- Payment Edge Function reachability.
- Public therapist fixture with service and available slot.

## HML End-To-End

```bash
npm run payments:phase3:hml
```

The orchestrator runs:

- Patient session approved payment.
- Patient session declined payment.
- Patient session expired checkout.
- Patient session refund.
- Therapist Premium subscription approved.
- Therapist subscription lifecycle: upgrade, downgrade schedule, cancel at period end, reactivate, immediate cancel.
- Therapist Premium Plus subscription approved.
- Therapist subscription declined card.
- Therapist subscription canceled checkout.

Every webhook event posted by the scripts is a real Stripe test event replayed with a valid local signature, then replayed once more to prove idempotency.

## Session Payment Evidence

Run an individual scenario when diagnosing:

```bash
npm run payments:phase3:session:hml -- --scenario=approved
npm run payments:phase3:session:hml -- --scenario=declined
npm run payments:phase3:session:hml -- --scenario=expired
npm run payments:phase3:session:hml -- --scenario=refund
```

Expected convergence:

- `approved`: `session_payments.financial_status = paid`.
- `declined`: `session_payments.financial_status = failed`.
- `expired`: `session_payments.financial_status = canceled`.
- `refund`: `session_payments.financial_status = refunded` or `partially_refunded`.

## Cupom e Promotion Code

Os checkouts usam o campo promocional TES fora do iframe Stripe. O TES não
mantém tabela própria de cupons: a Edge Function resolve o Promotion Code na
Stripe, exige `tes_checkout_scope=session|subscription` e cria uma nova
Checkout Session com o desconto. Assinaturas exigem ainda Products explícitos
no Coupon. Depois de um pagamento confirmado, o webhook
usa `amount_subtotal`, `amount_total` e `total_details.amount_discount` da
Checkout Session. `session_payments.gross_amount_cents` passa a representar o
valor efetivamente cobrado; o subtotal original e o desconto ficam registrados
no `metadata.stripe_checkout`. Comissão e repasse são recalculados sobre o
valor efetivamente cobrado, usando a política financeira já vigente.

Crie os objetos somente no test mode, sem `--live`:

```bash
stripe coupons create --duration=once --percent-off=20 --name="TES HML 20%"
stripe promotion_codes create --promotion.type=coupon --promotion.coupon=coupon_COLE_O_ID_AQUI --code=TESHML20 --max-redemptions=10 -d "metadata[tes_checkout_scope]=session"
```

Confirme no retorno da Stripe que `livemode` é `false` e informe o código criado
ao harness:

```bash
PAYMENTS_HML_PROMOTION_CODE=TESHML20 \
npm run payments:phase3:session:promotion:hml
```

O cenário cria uma reserva real de teste, aplica o código no campo TES visível,
confirma que o campo nativo Stripe não aparece, remonta o Embedded Checkout,
confere desconto positivo e `amount_total < amount_subtotal`, conclui com cartão
de teste, reenvia `checkout.session.completed` e `payment_intent.succeeded` com
assinatura válida duas vezes, e consulta no banco booking, status pago, valor
original, valor cobrado, comissão, repasse e `metadata.stripe_checkout`.

Para a campanha gratuita, use um Coupon `percent_off=100` ou `amount_off`
exatamente igual ao subtotal. O Checkout não deve pedir cartão nem criar
PaymentIntent; a confirmação deve ocorrer somente após o webhook
`checkout.session.completed`, com `session_payments.gross_amount_cents = 0`,
comissão e valor do terapeuta iguais a zero, e booking confirmado. Nunca trate o
redirect como confirmação.

Para a mesma validação local, com Supabase/Edge Functions/Next locais e o
listener da Stripe CLI apontando para `127.0.0.1`, use:

```bash
PAYMENTS_LOCAL_PATIENT_EMAIL=cliente@example.test \
PAYMENTS_LOCAL_PATIENT_PASSWORD='senha-de-teste' \
PAYMENTS_HML_PROMOTION_CODE=TESLOCAL20 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
SUPABASE_URL=http://127.0.0.1:54321 \
npm run payments:e2e:session:promotion
```

Repita sem `PAYMENTS_HML_PROMOTION_CODE` para confirmar que o checkout sem
cupom mantém `amount_subtotal = amount_total` e o mesmo fluxo de pagamento.

Para regras completas de sessão, Premium, Premium Plus, três meses grátis,
ativação, rollback e eventos superseded, siga
`docs/payments/promotion-codes.md`.

## Boleto no Checkout

O Checkout de sessões já usa métodos de pagamento dinâmicos e todos os preços
do TES são BRL. Para habilitar Boleto, ative-o no Dashboard Stripe em modo de
teste; não adicione `payment_method_types` no código. O Checkout incorporado
apresentará o método quando a conta, moeda, localização e valor forem elegíveis.

No Dashboard Stripe, em modo de teste:

1. Abra **Settings → Payments → Payment methods**.
2. Ative **Boleto** para a conta da plataforma.
3. Confira a validade padrão do boleto. O padrão da Stripe é 3 dias; a conta
   pode definir outro prazo dentro do limite aceito pela Stripe.
4. Em **Workbench → Webhooks/Event destinations**, confirme que o destino
   `stripe-billing-webhook` contém os eventos abaixo:
   `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`,
   `payment_intent.requires_action`, `payment_intent.processing`,
   `payment_intent.succeeded` e `payment_intent.payment_failed`.

Para o teste automático em HML, use um paciente de teste novo ou cujo Customer
Stripe ainda não tenha sido criado, com um e-mail de teste compatível com o
cenário da Stripe:

```bash
PAYMENTS_HML_PATIENT_EMAIL=cliente+succeed_immediately@exemplo.com.br \
npm run payments:phase3:session:hml -- --scenario=boleto_approved

PAYMENTS_HML_PATIENT_EMAIL=cliente+expire_immediately@exemplo.com.br \
npm run payments:phase3:session:hml -- --scenario=boleto_expired
```

O teste abre o Checkout com navegador visível, seleciona Boleto, preenche os
dados exigidos pelo Checkout e verifica a cadeia de eventos assinados. A
evidência esperada é:

- `boleto_approved`: `checkout.session.completed` → processamento pendente →
  `payment_intent.succeeded`/`checkout.session.async_payment_succeeded` →
  `session_payments.financial_status = paid`.
- `boleto_expired`: `checkout.session.completed` → processamento pendente →
  `payment_intent.payment_failed`/`checkout.session.async_payment_failed` →
  `session_payments.financial_status = failed`.

No ambiente real, o boleto pode ser confirmado somente no próximo dia útil após
o pagamento. Nunca confirme a sessão pelo retorno visual do Checkout. Boleto
não suporta reembolso pelo Stripe; a política de cancelamento precisa prever um
procedimento operacional separado antes de liberar o método em produção.

## Subscription Evidence

Existing scripts remain the canonical subscription harness:

```bash
PLAYWRIGHT_BASE_URL=https://hml.terapeutaeusou.com.br \
PAYMENTS_E2E_PLAN=premium \
PAYMENTS_E2E_SCENARIO=approved \
PAYMENTS_E2E_KEEP_SUBSCRIPTION=true \
node scripts/payments/complete-subscription-checkout-local.mjs

PLAYWRIGHT_BASE_URL=https://hml.terapeutaeusou.com.br \
node scripts/payments/exercise-subscription-lifecycle-local.mjs
```

The accepted evidence is:

- Stripe subscription active only after real Checkout succeeds.
- `therapist_subscriptions` and `therapist_profiles.plan` converge after signed webhook/reconciliation.
- Duplicate webhook replay returns 2xx and does not duplicate local state.
- Declined/canceled flows keep the therapist on Free.

## Connect Readiness

Connect must be validated in HML before production:

- Therapist opens hosted Stripe onboarding.
- Redirect back does not mark the account ready by itself.
- `stripe-connect-sync-account` retrieves the account server-side.
- `get_private_therapist_connect_account_v1` displays the latest synchronized status.
- A status of `pending`, `requirements_due`, `restricted` or `in_review` is acceptable while Stripe is reviewing KYC.
- A status of `charges_enabled=true` and `payouts_enabled=true` is required before treating transfers as operationally ready.

## LIVE Smoke Controlado

```bash
npm run payments:phase3:readiness:live
```

This runs `scripts/payments/stripe-phase3-live-smoke.mjs --stage=readiness`
and verifies live-mode configuration only:

- Live Stripe key mode.
- Live Supabase URL is neither local nor HML.
- Live billing prices are active and livemode.
- Live webhook endpoints point to the intended Supabase Edge Functions.
- Required Edge Functions are reachable.
- Internal operation overrides are denied in live mode when
  `PAYMENTS_INTERNAL_OPERATIONS_TOKEN` is available.
- Live public fixture is present and its service price is within the smoke cap
  when `PAYMENTS_LIVE_PUBLIC_THERAPIST_SLUG` is configured.

Readiness never creates Checkout Sessions, charges, refunds, subscriptions,
batches or transfers.

### LIVE Money Gate

Any mutating LIVE stage requires both confirmations in the same process:

```bash
TES_LIVE_SMOKE_CONFIRM=LIVE_STRIPE_SMOKE_APPROVED \
PAYMENTS_LIVE_MAX_AMOUNT_CENTS=500 \
npm run payments:phase3:live:billing -- --confirm-live-money
```

The script aborts when:

- `STRIPE_SECRET_KEY` is not live mode.
- `SUPABASE_URL` points to local or HML.
- `PAYMENTS_LIVE_MAX_AMOUNT_CENTS` exceeds 500.
- `--confirm-live-money` is missing.
- `TES_LIVE_SMOKE_CONFIRM` is not exactly `LIVE_STRIPE_SMOKE_APPROVED`.
- The planned charge or transfer is above the cap.

Never put card number, CVC, cookies, Authorization headers, API keys, webhook
secrets, service role keys or internal operation tokens in logs, docs or
evidence files.

### Required LIVE Env Names

Set only the variables needed for the chosen stage:

- `PLAYWRIGHT_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `PAYMENTS_INTERNAL_OPERATIONS_TOKEN`
- `PAYMENTS_LIVE_MAX_AMOUNT_CENTS`
- `PAYMENTS_LIVE_THERAPIST_EMAIL`
- `PAYMENTS_LIVE_THERAPIST_PASSWORD`
- `PAYMENTS_LIVE_THERAPIST_PROFILE_ID`
- `PAYMENTS_LIVE_PATIENT_EMAIL`
- `PAYMENTS_LIVE_PATIENT_PASSWORD`
- `PAYMENTS_LIVE_PUBLIC_THERAPIST_SLUG`
- `PAYMENTS_LIVE_SESSION_PAYMENT_ID`
- `PAYMENTS_LIVE_CHECKOUT_SESSION_ID`

Optional billing smoke discount, server-side only:

- `PAYMENTS_LIVE_SMOKE_ENABLED=true`
- `PAYMENTS_LIVE_SMOKE_THERAPIST_PROFILE_ID`
- `PAYMENTS_LIVE_SMOKE_COUPON_ID`

The subscription Checkout Edge Function applies this coupon only when Stripe is
live mode, the flag is active, the authenticated therapist profile matches the
allowlist and the coupon ID is configured on the server. The browser cannot
choose a coupon.

### Billing LIVE

```bash
TES_LIVE_SMOKE_CONFIRM=LIVE_STRIPE_SMOKE_APPROVED \
PAYMENTS_LIVE_MAX_AMOUNT_CENTS=500 \
npm run payments:phase3:live:billing -- --confirm-live-money --plan=premium
```

The script logs in as the internal therapist, calls
`/api/therapist/subscription-checkout` with `checkoutUiMode=hosted`, opens
Stripe Checkout visibly and waits for the operator to pay manually. After the
redirect, it verifies:

- Stripe Checkout `payment_status=paid`.
- Local `therapist_subscriptions.status in (active, trialing)`.
- Local `therapist_subscriptions.plan_code` equals the selected plan.

Open the Billing Portal manually from the product UI after this evidence, then
cancel and run:

```bash
npm run payments:phase3:live:report
```

The final GO requires the Stripe Dashboard subscription/invoice and Supabase
subscription row to match.

### Session LIVE

```bash
TES_LIVE_SMOKE_CONFIRM=LIVE_STRIPE_SMOKE_APPROVED \
PAYMENTS_LIVE_MAX_AMOUNT_CENTS=500 \
npm run payments:phase3:live:session -- --confirm-live-money
```

The script uses the configured public therapist fixture, verifies the service
price is within the cap, logs in as the internal patient, opens embedded
Checkout visibly and waits for manual payment. It then verifies:

- Stripe Checkout `payment_status=paid`.
- Local `session_payments.financial_status=paid`.
- Gross and therapist amounts remain inside the smoke cap evidence.

### Connect LIVE

```bash
TES_LIVE_SMOKE_CONFIRM=LIVE_STRIPE_SMOKE_APPROVED \
PAYMENTS_LIVE_MAX_AMOUNT_CENTS=500 \
npm run payments:phase3:live:connect -- --confirm-live-money
```

Connect processing requires `PAYMENTS_LIVE_SESSION_PAYMENT_ID`. The script:

- Retrieves the connected account with Stripe Accounts v2.
- Requires
  `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status`
  to be `active`.
- Calls `evaluate-transfer-eligibility` without temporal override.
- Does not accelerate the safety window in production.
- Creates/processes a payout batch only if the resulting batch has one item and
  total therapist amount is within R$ 5,00.
- Uses the existing `process-payout-batch` function, which creates transfers
  with `source_transaction` and idempotency.

If the payment is still in the normal safety window, the stage exits as
`BLOCKED` and the evidence records `transfer_status` and `eligible_at`; do not
force eligibility in production.

### Sanitized Report

```bash
npm run payments:phase3:live:report
```

The report compares Supabase and Stripe for the configured IDs and writes JSON
under `test-results/stripe-phase3/`. Stripe object IDs are masked and no secret
or credential is written.

Do not run checkout, payment, refund, transfer or onboarding-completion tests in
LIVE until the release owner gives an explicit go/no-go.

## Completion Gate

Phase 3 is not complete while any of these remain open:

- A HML approved session payment does not become `paid`.
- Declined, expired or refunded session flows do not converge to the expected financial status.
- Premium or Premium Plus activation happens from redirect alone.
- Duplicate webhook replay is not idempotent.
- Connect status is inferred from redirect instead of synchronized server-side.
- HML uses a production Stripe key or Production Supabase.
- LIVE readiness points to HML/test resources or executes a live money movement.
