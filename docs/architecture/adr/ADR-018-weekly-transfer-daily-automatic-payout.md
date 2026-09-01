# ADR-018 — Transfer semanal e Payout automático diário

Status: aprovado e implementado; política operacional confirmada em HML e produção.

## Contexto

A ADR-017 separou Transfer e Payout, mas dependia de cronograma manual e de um
Payout criado pelo TES. O Stripe Sandbox recusou `manual`, `weekly` e Payout ad
hoc para a conta conectada brasileira homologada, mantendo somente o
cronograma automático `daily`.

## Decisão

- O TES cria Transfers às terças-feiras, com backlog até o cutoff de 02:00 em
  `America/Sao_Paulo`.
- A Stripe cria Payouts automáticos diários quando o saldo conectado fica
  disponível.
- `destination_payment` e a Balance Transaction conectada identificam a
  entrada de cada Transfer.
- `balance_transactions?payout=po_*` é a autoridade dos componentes do Payout
  automático quando `reconciliation_status=completed`.
- `stripe_payout_transfer_allocations` atribui cada Transfer a exatamente um
  Payout por Balance Transaction. Lotes/grupos e Payouts formam a relação
  muitos-para-muitos derivada: um Payout agrega Transfers de vários lotes e um
  lote pode ter Transfers distribuídos entre vários Payouts.
- Payout automático não exige nem recebe metadata TES.
- O scheduler termina após os Transfers; o lote financeiro termina somente
  após cobertura reconciliada em Payouts `paid`.
- O ledger continua com uma única baixa no Transfer.
- Valores sem correspondência falham fechado em ocorrência operacional.

## Consequências

O desenho respeita a disponibilidade BR observada e mantém confirmação
bancária auditável. Um Payout pode agregar mais de um lote e um lote pode ser
dividido entre Payouts. O cronograma diário não garante depósito no mesmo dia.

Como a plataforma responde por saldos negativos no modelo de cobranças
separadas e Transfers, Payout automático reduz o saldo disponível para absorver
reversões posteriores. A política 7+1 reduz, mas não elimina, o risco de disputa.

## Alternativas rejeitadas

- insistir em Payout manual sem habilitação Stripe: incompatível com a conta BR;
- tratar Transfer como chegada bancária: contabilmente incorreto;
- associar Payout por valor ou metadata: ambíguo e indisponível no automático;
- impor relação um-para-um lote/Payout: incompatível com disponibilidade e
  cutoffs diários.

## Gate de ativação

Política v5 e cron permanecem inativos até HML comprovar Transfer real em Test
Mode, Payout automático, Balance Transactions, webhooks completos, read models,
alertas, reconciliação e preflight sem bloqueios.

Runbook: `docs/payments/weekly-payouts.md`.
