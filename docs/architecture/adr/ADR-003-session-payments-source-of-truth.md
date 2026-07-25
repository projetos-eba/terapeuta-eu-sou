# ADR-003 - Fonte financeira de pagamentos de sessão

Data: 2026-07-25

Status: aceito; hardening de produção pertence ao Gate Financeiro F0.

## Contexto

O projeto contém representações legadas em `payments`,
`bookings.payment_status` e `booking_payment_receipts`. A fundação Stripe criou
`session_payments`, ledger e estruturas de repasse.

## Decisão

- `session_payments` é a única fonte transacional de pagamentos de sessão.
- `financial_ledger_entries` é o ledger append-only.
- `payout_batches` e `payout_batch_items` organizam repasses.
- Representações legadas são projeções temporárias, nunca autoridade.
- Webhook assinado confirma pagamento; redirect não confirma nada.
- Toda operação monetária usa centavos, idempotência e RLS.

## Alternativas

- Continuar usando `payments`: rejeitada por não cobrir o modelo financeiro.
- Criar nova tabela na Agenda: rejeitada por duplicar a fonte financeira.

## Consequências

- Agenda e Sessões consomem resumo financeiro, sem escrever estados Stripe.
- Backfill e retirada das projeções legadas pertencem ao Gate F0.
- A Fase Agenda 1 não cria migration financeira.
