# Repasses semanais — Transfer semanal + Payout automático

Status: política v8 e schedulers ativados em HML e produção em 2026-08-28,
após preflight Connect, prova de Transfer idempotente em Stripe Test, readiness
Stripe Live e verificação remota dos crons, Vault, Edge Functions e webhooks.

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

- Política financeira ativa: `tes-payments-v9-settlement-only`, que preserva a
  comissão de 15% da v8, a confirmação bilateral e o lote de terça às 02:00 da
  v7. Snapshots anteriores seguem a política de origem para auditoria; a
  elegibilidade operacional não aplica mais a espera fixa.
- Paciente ausente é confirmado no vencimento de 7 dias; terapeuta ausente,
  no vencimento de 30 dias. Sem nenhuma resposta manual, a segunda confirmação
  ocorre no dia 30.
- `service_confirmed_at` é o instante da segunda confirmação válida.
- Não existe espera fixa adicional após `service_confirmed_at`.
- Liquidação: após a confirmação, a Balance Transaction da Charge deve estar
  `available`, com `available_on` vencido e conferência Stripe recente. Enquanto
  isso, o pagamento fica em `waiting_settlement` e não entra em lote.
- O job horário `tes-session-confirmation-hourly-v1` está registrado, auditado
  e ativo em HML e produção. Ele é idempotente, recupera atrasos com o
  vencimento contratual e não depende da telemetria Zoom.
- O job `tes-financial-reconciliation-hourly-v1` chama
  `reconcile-stripe-transfers` no minuto 17 de cada hora. Ele possui lease único
  e auditoria em `financial_reconciliation_runs`, recupera Charges ausentes,
  atualiza liquidação/elegibilidade e também reconcilia Transfers e Payouts. O
  minuto 17 não coincide com a confirmação automática (:07) nem com os ticks
  semanais (:00/:15/:30/:45).
- Relato `not_performed`, cancelamento, reembolso, disputa, contestação ou
  bloqueio administrativo impede confirmação automática e inclusão no lote.
- Avaliações públicas do terapeuta não confirmam sessão nem alteram repasse.
- Início: terça, 02:00 inclusive a 04:00 exclusivo, em
  `America/Sao_Paulo`.
- Cutoff fixo: terça às 02:00 locais.
- Todo backlog com liquidação Stripe confirmada até o cutoff é incluído.
- O scheduler semanal repete a reconciliação antes de adquirir o lote e cada
  Transfer consulta novamente a Charge/Balance Transaction. Se a Stripe mudar
  de `pending` para `available` depois da leitura do cutoff, o pagamento fica
  elegível para a terça seguinte; ele não é anexado a um lote já fechado.
- Execução sem itens elegíveis é auditada como no-op e não cria lote vazio.
- O scheduler encerra quando os Transfers estão resolvidos. O lote financeiro
  permanece `processing` até a cobertura bancária.
- Ativação operacional versionada:
  `supabase/schedules/weekly-payout-scheduler.sql`. O job
  `tes-weekly-payout-scheduler-v2` está ativo em HML e produção a cada 15
  minutos; fora da janela financeira responde sem adquirir lote.

## Prontidão Connect

O próximo lote é uma previsão operacional do Transfer TES, não uma promessa de
crédito bancário. O TES agrupa valores elegíveis às terças-feiras às 02:00
(`America/Sao_Paulo`); o Payout automático diário da Stripe disponibiliza o
saldo conforme o calendário e os requisitos da conta conectada.

### Remediação controlada de lote

Qualquer divergência deve começar por evidência somente leitura: política ativa,
scheduler, conta Connect corrente, itens do lote, ledger, Transfers, Balance
Transactions e alocações de Payout. Lotes globais ou de outro terapeuta não
podem alimentar previsões privadas e não devem ser apagados, cancelados ou
recriados. A reconciliação com a Stripe deve classificar o estado operacional
antes de qualquer correção. A reavaliação automática é idempotente e limitada a
bloqueios `connect_not_ready`; reembolso, disputa, contestação e relato de não
realização permanecem bloqueados. Alterações em HML ou Stripe exigem aprovação
específica e registro auditável.

Antes do Transfer, revalidar somente as contas Connect correntes do projeto
Supabase alvo:

- terapeuta aprovado e ownership da conta íntegro;
- capability v2 `stripe_transfers.status=active`;
- conta operacional sem requisitos impeditivos;
- Balance Settings `payments.payouts.status=enabled`;
- `payments.payouts.schedule.interval=daily`;
- pagamento, Charge e Balance Transaction da cobrança reconciliados;
- Balance Transaction `available`, `available_on <= cutoff` e snapshot
  verificado nas duas horas anteriores ao cutoff;
- BRL, valor positivo, sem disputa, refund pendente ou bloqueio.

`stripe-connect-payout-schedule` permanece uma operação interna separada e
consulta somente contas `is_current=true`. O modo `dry_run` não altera a Stripe,
mas atualiza o snapshot local e grava auditoria no Supabase. `apply` configura
`daily`, exige token interno e
`TES_CONNECT_PAYOUT_SCHEDULE_CHANGES_ENABLED=true`; o scheduler nunca corrige
cronograma durante o lote.

Conta corrente restrita pode ser isolada sem bloquear as demais somente quando
o estado remoto e o snapshot local coincidem e não existe histórico financeiro
positivo para o terapeuta. Divergência de ownership, snapshot desatualizado ou
qualquer histórico financeiro positivo falha fechado. Contas históricas nunca
participam do preflight nem da atualização de snapshots correntes.

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
5. remover da atribuição o débito agregado de tipo/categoria `payout` e usar
   somente as transações componentes;
6. aguardar `reconciliation_status=completed`;
6. paginar `balance_transactions?payout={payoutId}`;
7. enviar ao RPC somente campos allowlisted;
8. casar `source` com `destination_payment` ou o ID da Balance Transaction;
9. falhar fechado se houver valor ou movimentação sem associação;
11. concluir cada lote somente após todos os Transfers terem cobertura integral
    em Payouts reconciliados e `paid`.

Eventos duplicados e reconciliações repetidas não duplicam alocações, ledger,
e-mails ou notificações. `paid → failed` é aceito, reabre o estado financeiro,
gera incidente e comunicação corretiva.

## Encerramento de conta de recebimento

O evento `v2.core.account.closed` retira a conta da seleção de novos lotes,
mantendo-a como referência histórica de Transfers e Payouts. Itens somente
reservados, sem qualquer registro de Transfer, voltam com auditoria para
`eligible` e aguardam a nova conta corrente pronta. Itens que já possuem
Transfer permanecem vinculados à conta original e exigem reconciliação; nunca
são retentados contra uma conta nova.

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

1. Aplicar migrations e tipos pelo fluxo versionado de PR; manter o scheduler
   semanal inativo até concluir a prova externa.
2. Implantar as Edge Functions afetadas.
3. Confirmar Accounts v2 e Balance Settings nas contas correntes: capability de
   Transfer ativa, Payout habilitado e agenda diária. Conta restrita sem
   histórico financeiro positivo deve aparecer explicitamente como isolada.
4. Confirmar os três destinos webhook de Test Mode e seus signing secrets. Se
   o destino thin Accounts v2 estiver no escopo errado, substituir somente após
   o deploy da migration e das Edge Functions; a substituição atualiza o secret
   remoto antes de habilitar o novo destino e desabilita o legado depois.
5. Executar Transfer real pequeno com `source_transaction` no Sandbox.
6. Aguardar Payout automático padrão e `reconciliation_status=completed`.
7. Provar associação, `payout.paid`, duplicidade, fora de ordem, falha e
   movimentação sem correspondência.
8. Validar ledger, read models, outbox, notificações e incidentes.
9. Executar preflight sem bloqueios.
10. Ativar política e cron somente por operação aprovada e auditada.

O Test Mode pode comprovar API, eventos e reconciliação, mas não garante prazo
ou liquidação bancária real. Produção exige evidência separada.

### Registro de liberação de 2026-08-28

- HML: 13 contas Connect correntes auditadas; 12 prontas e 1 isolada sem
  histórico financeiro positivo; nenhum bloqueio ou snapshot divergente.
- HML: Transfer Test único de R$ 102,00 comprovado com
  `source_transaction`, destination payment, Balance Transaction, uma baixa
  no ledger e replay idempotente sem nova Transfer.
- O saldo Test permanece sujeito ao `available_on` calculado pela Stripe. A
  ausência de Payout antes dessa disponibilidade não bloqueia a ativação do
  código nem comprova prazo bancário real.
- Produção: Stripe Live, três preços pagos, proteções contra controles de teste
  e Edge Functions financeiras aprovados. Não havia conta Connect corrente no
  momento da ativação, portanto não existia destinatário elegível para lote.
- Cron: a primeira chamada de HML e produção em 2026-08-28 10:00 BRT concluiu
  com HTTP 200, token do Vault aceito e `outside_start_window`, sem criar lote
  ou movimentação financeira.
- Webhooks HML e Live: exatamente três destinos habilitados em cada modo, nas
  matrizes 25/8/11. Plataforma snapshot usa `@self`, Connect snapshot usa
  `@accounts` e Connect thin Accounts v2 usa `@self`. O destino thin Live
  legado em `@accounts` foi substituído e somente
  `STRIPE_CONNECT_V2_WEBHOOK_SECRET` foi rotacionado; o arquivo local e o
  secret remoto foram validados por digest sem exposição do valor.

### Controle temporal HML

O avanço temporal controlado existe somente para Stripe Test e exige
`TES_FINANCE_TEST_CONTROLS_ENABLED=true`. O valor normal, local e remoto, é
`false`. Toda janela remota deve usar `try/finally`, restaurar `false` e confirmar
depois que um override volta a responder `finance_test_control_not_allowed`.

O fluxo rastreável de HML é:

1. `npm run payments:finance:prepare:hml -- --booking-id=<uuid> --dry-run`;
2. preparar apenas o fixture dedicado com
   `--confirm-controlled-hml-time-advance`;
3. `npm run payments:finance:transfer:hml -- --booking-id=<uuid> --stage=verify-closed`;
4. abrir a flag temporária e executar `--stage=prepare-batch`;
5. exigir exatamente um elegível, um item, um terapeuta e valor abaixo do teto
   do harness;
6. abrir nova janela temporária e executar `--stage=transfer`;
7. repetir com `--stage=verify-idempotency` e exigir zero novas Transfers;
8. `npm run payments:finance:payout:observe:hml -- --booking-id=<uuid>` até a
   Stripe criar o Payout automático e a alocação local convergir.

O `nowOverride` de `process-payout-batch` chega ao worker somente depois da
validação central que exige Test Mode e a flag explícita. O scheduler usa a
mesma validação. O harness nunca cria Payout manual: saldo `pending` e
`available_on` futuro mantêm o gate externo em espera.

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
