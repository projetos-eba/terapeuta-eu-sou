# Repasses semanais — Transfer semanal + Payout automático

Status: implementado localmente, desativado e pronto para homologação externa
em Stripe Test Mode. Produção permanece bloqueada até o preflight HML e a
ativação explícita da política/cron.

## Decisão para contas brasileiras

O Stripe Sandbox confirmou em 2026-08-25 que a conta conectada BR analisada não
aceita `schedule.interval=manual`, `schedule.interval=weekly` nem Payout ad hoc.
O contrato aprovado em ADR-018 é:

1. o TES cria Transfers somente no lote semanal de terça-feira;
2. o saldo entra na conta conectada e segue o cronograma Stripe `daily`;
3. a Stripe cria o Payout automático, sem metadata TES;
4. o TES importa o Payout por webhook e lista suas Balance Transactions;
5. uma tabela de alocação relaciona Transfers, grupos/lotes e Payouts;
6. somente cobertura reconciliada em Payout `paid` conclui o banco.

`daily` é frequência automática, não uma chamada disparada pelo Transfer nem
promessa de crédito bancário no mesmo dia. O saldo precisa ficar disponível e
a Stripe aplica seus cutoffs e prazos bancários.

## Contrato financeiro

- `Transfer`: plataforma → saldo Stripe conectado. Gera uma única baixa
  `transfer` no ledger.
- `Payout`: saldo conectado → conta externa. Não gera outra baixa no ledger.
- `stripe_payout_transfer_allocations`: atribuição por Balance Transaction;
  cada Transfer pertence a exatamente um Payout, enquanto lotes/grupos e
  Payouts formam a relação muitos-para-muitos derivada.
- O caso usual é vários Transfers/lotes em um Payout. Um grupo também pode ser
  dividido entre vários Payouts quando as disponibilidades ocorrem em dias
  diferentes.
- Metadata de Payout não é autoridade. A associação usa conta conectada,
  `payout.id`, `automatic=true`, ambiente, moeda e Balance Transactions.
- Metadata TES permanece nos Transfers, pois eles são criados pelo TES.

Sessões com desconto integral são pagamentos lógicos válidos. Comissão e valor
do terapeuta ficam em zero; não entram em lote, Transfer ou Payout e não abrem
ocorrência.

## Política e scheduler

- Política inativa: `tes-payments-v5-weekly-transfer-daily-automatic-payout`.
- Confirmação bilateral preservada; ausências são concluídas automaticamente
  após 7 dias.
- Segurança: um dia completo após `service_confirmed_at`.
- Início: terça, 02:00 inclusive a 04:00 exclusivo, em
  `America/Sao_Paulo`.
- Cutoff fixo: terça às 02:00 locais.
- Todo backlog elegível até o cutoff é incluído.
- O scheduler encerra quando os Transfers estão resolvidos. O lote financeiro
  permanece `processing` até a cobertura bancária.
- SQL desativado: `supabase/schedules/weekly-payout-scheduler.sql`.

## Prontidão Connect

Antes do Transfer, revalidar:

- terapeuta aprovado e ownership da conta íntegro;
- capability v2 `stripe_transfers.status=active`;
- conta operacional sem requisitos impeditivos;
- Balance Settings `payments.payouts.status=enabled`;
- `payments.payouts.schedule.interval=daily`;
- pagamento, Charge e Balance Transaction da cobrança reconciliados;
- BRL, valor positivo, sem disputa, refund pendente ou bloqueio.

`stripe-connect-payout-schedule` permanece uma operação interna separada. O
modo `dry_run` apenas audita. `apply` configura `daily`, exige token interno e
`TES_CONNECT_PAYOUT_SCHEDULE_CHANGES_ENABLED=true`; o scheduler nunca corrige
cronograma durante o lote.

## Transfer e reconciliação

Cada Transfer persiste antes da chamada Stripe:

- chave `tes:{mode}:transfer:{itemId}:v1`;
- fingerprint estável;
- `source_transaction`;
- `stripe_transfer_id`;
- `destination_payment` da conta conectada;
- Balance Transaction conectada e `available_on`, quando expandidas.

Timeout ambíguo vira `reconciliation_required` e reutiliza a mesma chave. O
ledger é idempotente e contém uma única entrada por Transfer.

Para Payout automático:

1. validar assinatura e escopo do webhook Connect;
2. recuperar o Payout no contexto da conta conectada;
3. exigir ambiente esperado, BRL, valor positivo e `automatic=true`;
4. persistir o objeto sem metadata TES;
5. aguardar `reconciliation_status=completed`;
6. paginar `balance_transactions?payout={payoutId}`;
7. enviar ao RPC somente campos allowlisted;
8. casar `source` com `destination_payment` ou o ID da Balance Transaction;
9. falhar fechado se houver valor ou movimentação sem associação;
10. concluir cada lote somente após todos os Transfers terem cobertura em
    Payouts reconciliados e `paid`.

Eventos duplicados e reconciliações repetidas não duplicam alocações, ledger,
e-mails ou notificações. `paid → failed` é aceito, reabre o estado financeiro,
gera incidente e comunicação corretiva.

## Eventos obrigatórios

Snapshot Connect, escopo `@accounts`:

- `account.updated`;
- `account.external_account.updated`;
- `balance_settings.updated`;
- `payout.created`;
- `payout.updated`;
- `payout.paid`;
- `payout.failed`;
- `payout.canceled`.

Accounts v2 thin permanece separado para os 11 eventos de conta definidos em
`scripts/payments/stripe-webhook-events.mjs`. Billing/plataforma usa destino
snapshot próprio. Nunca compartilhar signing secret entre destinos.

## Alertas e read models

- `therapist_payout_completed`: apenas quando o Payout está `paid`, a
  reconciliação Stripe está `completed` e todas as transações foram alocadas.
- `therapist_payout_failed_after_paid`: falha posterior a uma confirmação já
  comunicada.
- `payout_operational_alert_admin`: uma vez por incidente e administrador.
- Read model v2 separa Transfer, aguardando Payout automático, cobertura
  parcial, pagamento bancário e atenção/reconciliação.

Payloads não carregam conta bancária, payload Stripe bruto, segredo ou conteúdo
clínico. Ausência de admin elegível reprova preflight.

## Homologação e ativação

1. Aplicar migrations e tipos; manter a política v5 inativa.
2. Implantar as Edge Functions afetadas.
3. Confirmar Balance Settings diário e Payouts habilitados em todas as contas.
4. Confirmar os três destinos webhook de Test Mode e seus signing secrets.
5. Executar Transfer real pequeno com `source_transaction` no Sandbox.
6. Aguardar Payout automático padrão e `reconciliation_status=completed`.
7. Provar associação, `payout.paid`, duplicidade, fora de ordem, falha e
   movimentação sem correspondência.
8. Validar ledger, read models, outbox, notificações e incidentes.
9. Executar preflight sem bloqueios.
10. Ativar política e cron somente por operação aprovada e auditada.

O Test Mode pode comprovar API, eventos e reconciliação, mas não garante prazo
ou liquidação bancária real. Produção exige evidência separada.

## Evidência local

- Fixtures: `supabase/seeds/local-weekly-payout-fixtures.sql` e
  `supabase/tests/fixtures/weekly-payout-local.inc`.
- pgTAP: `084_weekly_transfer_payout_orchestration.sql` e
  `086_daily_automatic_payout_reconciliation.sql`.
- Deno: `automatic-payouts.test.ts`, `finance-lifecycle.test.ts`,
  `connect.test.ts` e contratos de e-mail.
- Harness: `npm run payments:payouts:local`.
- Verificação dos destinos: `npm run payments:webhooks:verify:test`.
- Configuração idempotente dos três destinos remotos canônicos no Sandbox:
  `npm run payments:webhooks:configure:test`.
- Auditoria read-only das contas Connect TES:
  `npm run payments:connect:payout-readiness:test`.

Auditoria Stripe Test Mode de 2026-08-25: os três destinos remotos ficaram
habilitados sem duplicidade, nas matrizes 25/8/11. Das 15 contas Accounts v2
identificadas por metadata TES, 10 tinham Payout habilitado e cronograma diário;
5 tinham cronograma diário, mas `payments.payouts.status=disabled`. Essas contas
permanecem bloqueadas até a Stripe liberar Payout após onboarding, requisitos e
conta externa. O TES não força esse status. A ativação deve considerar apenas
contas que também pertençam ao banco do ambiente alvo e reprovar qualquer conta
ativa que esteja entre as bloqueadas.

Rollback: desativar o cron, preservar eventos/alocações para reconciliação e
nunca trocar chaves idempotentes de Transfers em resposta desconhecida.
