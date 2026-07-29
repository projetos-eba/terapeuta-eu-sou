# ADR-015 — Financeiro do terapeuta F4: lifecycle operacional de repasse

Data: 2026-07-29

## Status

Aceita para implementação local e homologação em Stripe test mode.

## Contexto

As fases F0/F1/F2/F3 fecharam a área financeira, os read models e o dashboard.
Faltava rastrear e validar a cadeia operacional completa: Connect pronto,
pagamento confirmado por webhook, realização da sessão, período de segurança,
elegibilidade, lote, Transfer Connect com `source_transaction`, conclusão do
repasse, comprovantes e conciliação.

## Decisão

Nenhuma nova autoridade financeira será criada. A F4 usa as fontes canônicas já
aprovadas:

- `session_payments` para pagamento, status financeiro e status de repasse;
- `session_service_confirmations` para realização;
- `payout_batches`, `payout_batch_therapists` e `payout_batch_items` para lote;
- `stripe_transfers` para Transfer Connect;
- `financial_ledger_entries` para evidência contábil;
- `booking_payment_receipts` como projeção de comprovante;
- `stripe_webhook_events` para idempotência de webhooks.

O webhook Stripe continua sendo a única confirmação de pagamento. Redirects de
Checkout ou Connect não alteram pagamento, onboarding ou repasse.

O processamento de repasse usa `stripe.transfers.create` com:

- `destination` da conta Connect pronta;
- `source_transaction = session_payments.stripe_charge_id`;
- idempotency key derivada do item de lote;
- metadados TES sem secrets.

Para homologação test mode, `evaluate-transfer-eligibility` e
`create-weekly-payout-batch` aceitam override temporal somente com
`TES_FINANCE_TEST_CONTROLS_ENABLED=true` e chave Stripe test. Em live mode, a
sobrescrita falha. Isso permite validar o período de segurança sem reduzir a
política financeira real.

## Consequências

- O dashboard de repasses passa a expor estado de conciliação do lote:
  `matched`, `pending`, `needs_reconciliation`, `failed` ou `reversed`.
- Recebimentos passam a receber comprovante real da Charge quando a Stripe
  retornar `receipt_url`.
- Taxa Stripe é registrada como evidência do custo TES no ledger, não como
  desconto do terapeuta.
- Valores estimados de F3 continuam fora de saldo, ledger e repasse.

## Segurança

- Overrides de tempo são protegidos por token operacional interno e flag
  server-side.
- O navegador não envia `therapist_profile_id`, `account_id`, `charge_id` ou
  `transfer_id` como autoridade.
- Account Link não é persistido.
- Secrets Stripe e token operacional não entram em logs, banco ou metadados.
- Read models privados continuam derivados de `auth.uid()`.

## Riscos

- Homologação externa depende de secrets Stripe test, endpoint público de
  webhook ou Stripe CLI e conta Connect test mode.
- Transfer Connect real pode retornar falhas temporárias; o lote permanece com
  item `failed`/`blocked` e deve ser reconciliado ou retentado por rotina
  operacional.
- Balance Transaction/receipt podem chegar parcialmente em eventos diferentes;
  a reconciliação existe para completar dados ausentes.

## Referências

- `docs/payments/architecture.md`;
- `docs/payments/therapist-finance-f0-f1.md`;
- `docs/payments/internal-operations-token.md`;
- `supabase/functions/process-payout-batch/index.ts`;
- `supabase/functions/stripe-billing-webhook/index.ts`;
- `supabase/tests/019_therapist_finance_f4_operational_lifecycle.sql`.
