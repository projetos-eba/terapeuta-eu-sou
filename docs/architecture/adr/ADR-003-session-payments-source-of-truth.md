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
- O Gate F0 implementou backfill e transformou as tabelas legadas em projeções
  sincronizadas da fonte canônica.
- `therapist_session_read_model_v1` e as RPCs de Agenda/Sessões leem
  `session_payments` diretamente.
- Divergência em `bookings.payment_status` não autoriza Zoom nem altera o
  estado financeiro apresentado.
