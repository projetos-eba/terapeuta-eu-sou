# ADR-017 — Orquestração semanal de Transfer + Payout

Status: superado pela ADR-018; preservado como registro da alternativa manual bloqueada.

## Contexto

O lote anterior encerrava a obrigação quando a Stripe aceitava um Transfer. Isso confundia saldo da conta conectada com pagamento bancário, deixava timeout ambíguo sem intenção local prévia e permitia retries sem orçamento persistente.

## Decisão

- Persistir Transfer e Payout como máquinas de estado separadas.
- Reservar e registrar intenção em RPC transacional antes da chamada externa.
- Usar idempotency key e fingerprint estáveis por item/grupo.
- Criar um Payout manual agregado por terapeuta/lote, atuando no contexto da conta conectada.
- Usar Balance Settings como autoridade de `payouts_enabled` e cronograma manual.
- Concluir o banco somente por Payout autoritativo `paid`.
- Manter uma única baixa no ledger, vinculada ao Transfer.
- Tratar resposta desconhecida como reconciliação, nunca como retry com nova chave.
- Manter scheduler e cron desativados até preflight e homologação externos.

## Consequências

A conclusão bancária passa a ser auditável e eventos fora de ordem não duplicam dinheiro. Há mais estados operacionais e dependência de webhooks Connect completos. Um `payout.failed` pode suceder `payout.paid`, exigindo correção ao terapeuta e alerta administrativo.

## Evidência que bloqueia a decisão

Em 2026-08-25, no Stripe Sandbox, uma conta Express brasileira com
`stripe_transfers=active` e Payouts habilitados recusou de forma autoritativa:

- `schedule.interval=manual`;
- `schedule.interval=weekly`;
- criação de Payout pela API mantendo o cronograma diário.

A Stripe informou que esses planos de repasse não estão disponíveis para a
conta no país BR. O TES confirmou o comportamento com Balance Settings, Payouts
API e fixture oficial da Stripe CLI. O lote local falhou fechado antes do
Transfer, sem ledger ou Payout.

## Decisão pendente

Não ativar a política v4 nem o cron. É necessária uma nova decisão financeira:

1. manter Transfer semanal às terças e aceitar Payout automático diário da
   Stripe, redesenhando a associação entre lote e Payout automático; ou
2. obter da Stripe confirmação formal e habilitação de um cronograma controlável
   para contas brasileiras antes de preservar o desenho atual.

Usar Payout automático exige nova ADR porque o objeto pode agregar saldo anterior
e não carrega a metadata do lote criada pelo TES.

Runbook: `docs/payments/weekly-payouts.md`.
