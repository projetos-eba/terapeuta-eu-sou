# Financeiro do terapeuta — F0/F1

Data: 2026-07-28

## Escopo aprovado

A rota canônica é `/terapeuta/financeiro`, com abas via query string:

- `/terapeuta/financeiro`;
- `/terapeuta/financeiro?tab=recebimentos`;
- `/terapeuta/financeiro?tab=repasses`;
- `/terapeuta/financeiro?tab=conta`.

Os aliases técnicos `receipts`, `payouts` e `account` são aceitos apenas como
compatibilidade de entrada.

A experiência tem quatro abas: Resumo, Recebimentos, Repasses e Conta de
recebimento. Não há aba dedicada de histórico; listas paginadas e filtros por
período cobrem consulta de registros anteriores.

Fora do escopo da F0/F1:

- projeções financeiras avançadas;
- potencial financeiro da agenda;
- oportunidade do mês;
- retenção;
- benchmark da plataforma;
- ranking estratégico de terapias;
- recomendações TES;
- IA financeira;
- CRM;
- insights Premium Plus;
- formulário bancário próprio.

Atualização F2: a aba Resumo ganhou métricas intermediárias para Premium e
Premium Plus. Free permanece com o resumo operacional da F0/F1.

Atualização F3: Premium Plus ganhou o dashboard financeiro avançado no Resumo,
com previsão, potencial da agenda, oportunidades, retenção avançada, evolução
com projeção, ranking detalhado e benchmark anonimizado. Premium mantém F2.

Atualização F4: a homologação operacional passou a cobrir a cadeia completa:
conta Connect, pagamento de sessão confirmado por webhook, comprovante,
confirmação de realização, período de segurança controlado em test mode,
elegibilidade, criação de lote, Transfer Connect com `source_transaction`,
conclusão do repasse, dashboard atualizado e conciliação.

## Fontes de verdade

| Tema                      | Fonte                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| Pagamento de sessão       | `session_payments`                                                |
| Política financeira       | `financial_policy_versions`                                       |
| Reembolsos                | `session_refunds`                                                 |
| Disputas                  | `session_disputes`                                                |
| Confirmação de realização | `session_service_confirmations`                                   |
| Lotes de repasse          | `payout_batches`, `payout_batch_therapists`, `payout_batch_items` |
| Transfers Stripe          | `stripe_transfers`, `stripe_transfer_reversals`                   |
| Ledger                    | `financial_ledger_entries`                                        |
| Conta Connect             | `therapist_connect_accounts`                                      |
| Webhooks                  | `stripe_webhook_events`                                           |

`bookings.payment_status` pode existir como projeção de compatibilidade, mas
não autoriza saldo, pagamento, repasse ou acesso financeiro.

## Glossário financeiro

| Termo                   | Definição                                                        | Fonte/cálculo                                                         |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Valor bruto             | Total pago pelo cliente por sessões dentro do período.           | Soma de `session_payments.gross_amount_cents`.                        |
| Comissão TES            | Parcela da plataforma registrada no snapshot financeiro.         | Soma de `session_payments.platform_gross_commission_cents`.           |
| Reembolso               | Valor devolvido ao cliente.                                      | Soma de `session_refunds.amount_cents` com status `succeeded`.        |
| Valor líquido           | Valor bruto menos Comissão TES e reembolsos do cliente.          | Read model privado em centavos.                                       |
| Aguardando confirmação  | Sessão paga ainda sem confirmação operacional para repasse.      | `session_payments.transfer_status = waiting_confirmation`.            |
| Período de segurança    | Janela após confirmação antes de elegibilidade.                  | `session_payments.transfer_status = waiting_safety_period`.           |
| Disponível para repasse | Valor elegível para entrar em lote.                              | `session_payments.transfer_status = eligible`.                        |
| Em processamento        | Valor em lote ou transferência pendente.                         | `batched` ou `transfer_pending`.                                      |
| Transferido             | Transfer concluído na Stripe.                                    | `stripe_transfers.status = transferred`.                              |
| Bloqueado               | Valor bloqueado por disputa, revisão, conta ou regra financeira. | `session_payments.transfer_status = blocked`.                         |
| Disputado               | Pagamento com disputa aberta ou registrada.                      | `session_payments.financial_status = disputed` ou `session_disputes`. |

## Contratos privados

Todos os contratos derivam o terapeuta de `auth.uid()` e exigem role
`therapist`. O navegador não envia `therapist_profile_id` como autoridade.

### `get_private_therapist_financial_overview_v1`

Retorna totais em centavos, período normalizado, timezone e `generatedAt`.
Campos: `grossPaidCents`, `tesCommissionCents`,
`refundedToCustomersCents`, `therapistNetCents`,
`waitingConfirmationCents`, `waitingSafetyPeriodCents`,
`eligibleForPayoutCents`, `payoutProcessingCents`, `transferredCents`,
`blockedCents`, `disputedCents`.

### `get_private_therapist_receipts_v1`

Retorna lista paginada de recebimentos com filtros server-side por período,
status, terapia e busca permitida. O método de pagamento e a origem da cobrança
são campos separados.

### `get_private_therapist_payouts_v1`

Retorna lotes/repasses paginados por período e status, com bruto, comissão,
reembolso, líquido, data prevista, data concluída, sessão contada e motivo de
bloqueio ou falha quando houver. Na F4 também retorna status de conciliação,
`stripeTransferId` e `stripeSourceChargeId` quando o Transfer já foi criado.
Essas referências são operacionais e não substituem saldo, ledger ou webhook.

### `get_private_therapist_connect_account_v1`

Retorna estado Connect mascarado: existência da conta, status de onboarding,
capabilities, requisitos e última sincronização. Não retorna formulário
bancário nem dados bancários completos.

### `get_private_therapist_financial_metrics_v1`

Retorna métricas intermediárias da aba Resumo para Premium e Premium Plus:
receita bruta/líquida, ticket médio bruto/líquido, sessões pagas, sessões
realizadas, taxa de retorno simples, cancelamentos, reagendamentos, faturamento
por terapia e evolução financeira realizada versus período anterior.

Definições oficiais:

- receita líquida: soma de `gross_amount_cents` menos
  `platform_gross_commission_cents` e reembolsos `succeeded`;
- ticket médio principal na UI: líquido, isto é
  `therapistNetCents / paidSessionCount`;
- ticket médio bruto: `grossPaidCents / paidSessionCount`, exibido como detalhe;
- sessões pagas: `paid`, `partially_refunded`, `refunded` e `disputed`;
- sessões realizadas: booking `completed` ou confirmação canônica em
  `session_payments.service_status`/`service_confirmed_at`;
- retorno simples: nova sessão paga em até 90 dias depois da primeira sessão
  concluída no período, com mínimo de 10 pacientes elegíveis e janela completa;
- cancelamento: `cancelledSessions / eligibleScheduledSessions`;
- reagendamento: `appliedRescheduleRequests / eligibleScheduledSessions`;
- evolução: buckets semanais do período atual com valor líquido do período
  anterior equivalente;
- terapia: agrupada por `therapist_services.therapy_id`, com fallback textual
  para `bookings.service_title_snapshot` quando necessário.

Comparações retornam estado discriminado: `available`, `no_previous_data`,
`division_by_zero` ou `insufficient_data`. Crescimento infinito não é exibido.

### Contratos F3 Premium Plus

Todos exigem `advanced_financials` via plano `premium_plus`:

- `get_private_therapist_advanced_financial_dashboard_v1`;
- `get_private_therapist_financial_forecast_v1`;
- `get_private_therapist_agenda_revenue_potential_v1`;
- `get_private_therapist_financial_opportunities_v1`;
- `get_private_therapist_retention_analytics_v1`;
- `get_private_therapist_financial_benchmark_v1`.

Metodologias versionadas:

- `tes-financial-forecast-v1`;
- `tes-agenda-potential-v1`;
- `tes-financial-opportunities-v1`;
- `tes-retention-v1`;
- `tes-financial-benchmark-v1`.

Previsão do mês separa:

1. realizado líquido;
2. receita contratada futura;
3. potencial estimado da agenda.

Esses valores nunca são somados como receita garantida. O potencial estimado não
cria ledger, não altera saldo e não entra em repasse.

O benchmark só aparece com no mínimo 20 terapeutas elegíveis e 100 sessões
agregadas. Caso contrário, retorna `insufficient_sample`, sem IDs ou valores de
outros terapeutas.

### Contratos F4 operacionais

`record_session_payment_stripe_reconciliation_v1` registra evidências de
Charge, Balance Transaction, método de pagamento e comprovante após a
confirmação do pagamento pelo webhook Stripe. Ele não altera o status financeiro
sozinho e é executável somente por `service_role`.

`evaluate-transfer-eligibility` e `create-weekly-payout-batch` preservam o token
operacional interno. Para sandbox, aceitam `nowOverride` e
`cutoffAtOverride` somente quando a flag server-side
`TES_FINANCE_TEST_CONTROLS_ENABLED=true` estiver ativa em Stripe test mode.
Esses controles existem para validar o período de segurança sem reduzir a
política real.

## Matriz Figma → dado real

| Elemento implementado     | Definição                                                                        | Fonte                                                                                                 | Estado sem dados                              | Capability             |
| ------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------- |
| Total líquido no período  | Resultado operacional do período.                                                | `get_private_therapist_financial_overview_v1`                                                         | R$ 0,00 com data de atualização.              | `operation_essentials` |
| A receber                 | Confirmação, segurança e processamento.                                          | `session_payments.transfer_status` agregado                                                           | R$ 0,00.                                      | `operation_essentials` |
| Disponível para repasse   | Valor elegível para lote.                                                        | `session_payments.transfer_status = eligible`                                                         | R$ 0,00.                                      | `operation_essentials` |
| Em processamento          | Valor em lote ou transferência pendente.                                         | `batched`/`transfer_pending`                                                                          | R$ 0,00.                                      | `operation_essentials` |
| Transferido no período    | Transfers concluídos.                                                            | `stripe_transfers`                                                                                    | R$ 0,00.                                      | `operation_essentials` |
| Bloqueado                 | Valores bloqueados.                                                              | `session_payments.transfer_status = blocked`                                                          | Oculto quando zero.                           | `operation_essentials` |
| Reembolsado               | Valores devolvidos ao cliente.                                                   | `session_refunds.status = succeeded`                                                                  | Oculto quando zero.                           | `operation_essentials` |
| Disputado                 | Pagamentos em disputa.                                                           | `session_disputes` e `session_payments`                                                               | Oculto quando zero.                           | `operation_essentials` |
| Tabela de recebimentos    | Pagamentos por sessão.                                                           | `get_private_therapist_receipts_v1`                                                                   | Estado vazio honesto.                         | `operation_essentials` |
| Tabela de repasses        | Lotes e transfers.                                                               | `get_private_therapist_payouts_v1`                                                                    | Estado vazio honesto.                         | `operation_essentials` |
| Conciliação de repasse    | Transfer Connect conciliado com a Charge de origem.                              | `stripe_transfers.stripe_transfer_id` + `stripe_transfers.stripe_source_charge_id`                    | Aguardando conciliação.                       | `operation_essentials` |
| Conta de recebimento      | Estado Connect hospedado.                                                        | `get_private_therapist_connect_account_v1` + Edge Functions Connect                                   | CTA para conectar.                            | `operation_essentials` |
| Receita líquida           | Valor líquido do terapeuta no período.                                           | `get_private_therapist_financial_metrics_v1`                                                          | R$ 0,00 ou estado insuficiente.               | `advanced_metrics`     |
| Ticket médio              | Ticket médio líquido principal.                                                  | `get_private_therapist_financial_metrics_v1`                                                          | “Sem base”.                                   | `advanced_metrics`     |
| Sessões realizadas        | Sessões concluídas/confirmadas.                                                  | `bookings` + `session_payments.service_status`                                                        | 0.                                            | `advanced_metrics`     |
| Taxa de retorno           | Retorno simples em janela de 90 dias.                                            | `get_private_therapist_financial_metrics_v1`                                                          | “Sem base”/dados insuficientes.               | `advanced_metrics`     |
| Cancelamentos             | Cancelamentos sobre agendamentos elegíveis.                                      | `bookings`                                                                                            | 0 ou taxa indisponível.                       | `advanced_metrics`     |
| Reagendamentos            | Reagendamentos aplicados no período.                                             | `booking_reschedule_requests.status = applied`                                                        | 0 ou taxa indisponível.                       | `advanced_metrics`     |
| Terapias que mais faturam | Faturamento agrupado por terapia.                                                | `session_payments` + `therapist_services` + `therapies`                                               | Estado vazio honesto.                         | `advanced_metrics`     |
| Evolução financeira       | Realizado versus período anterior.                                               | `session_payments`                                                                                    | Série vazia honesta.                          | `advanced_metrics`     |
| Receita contratada no mês | Realizado líquido + sessões futuras pagas e válidas.                             | `get_private_therapist_advanced_financial_dashboard_v1`                                               | R$ 0,00 ou estado indisponível.               | `advanced_financials`  |
| Potencial da agenda       | Estimativa por disponibilidade real, bloqueios, reservas pagas, duração e preço. | `availability_rules`, `availability_exceptions`, `bookings`, `therapist_services`, `session_payments` | Estado insuficiente/indisponível.             | `advanced_financials`  |
| Oportunidade do mês       | Ação determinística com evidências e confiança.                                  | `get_private_therapist_financial_opportunities_v1`                                                    | Item explícito de sem oportunidade confiável. | `advanced_financials`  |
| Insight TES financeiro    | Explicação rule-based vinculada a evidências.                                    | Oportunidades F3                                                                                      | Estado sem insight suficiente.                | `advanced_financials`  |
| Retenção avançada         | Coortes com janela incompleta censurada e retorno pago em até 90 dias.           | `bookings`, `session_payments`                                                                        | `insufficient_data`.                          | `advanced_financials`  |
| Benchmark anonimizado     | Comparação agregada com supressão estatística.                                   | Agregados de `session_payments`                                                                       | `insufficient_sample`.                        | `advanced_financials`  |
| Evolução com projeção     | Realizado, contratado, estimado e período anterior em séries separadas.          | `session_payments` + potencial F3                                                                     | Série vazia honesta.                          | `advanced_financials`  |

## Divergências conscientes do Figma

- A aba visual de histórico não foi implementada; o produto aprovou consulta de
  registros antigos nas listas paginadas.
- Elementos de inteligência financeira, oportunidade, potencial, retenção e
  ranking não entram na F0/F1.
- A tela visual de dados bancários não vira formulário local; Stripe Connect
  hospedado é obrigatório.
- Origem de cobrança não é método de pagamento. Link ou Checkout aparecem como
  origem, enquanto método usa dados reais quando persistidos.
- A composição visual não mostra taxa Stripe como desconto do terapeuta.
- Na F2, projeção, potencial, oportunidade e benchmark ficaram fora do escopo.
  Na F3, esses blocos foram implementados somente para Premium Plus, com
  `advanced_financials`.
- O termo visual “Agenda vazia” do Figma foi renomeado para “Potencial
  disponível da agenda”, com tooltip/descrição deixando claro que não é receita
  garantida.

## Stripe Connect

Fluxo aprovado:

1. terapeuta autenticado aciona CTA;
2. backend resolve perfil pela sessão;
3. Edge Function reutiliza ou cria conta Connect;
4. Edge Function cria Account Link;
5. frontend redireciona para a URL retornada;
6. `refresh_url` gera novo link;
7. `return_url` não conclui onboarding;
8. terapeuta sincroniza estado;
9. UI renderiza dados sincronizados;
10. conta ativa habilita Login Link.

O TES não persiste Account Link, não envia link por e-mail, não aceita account
ID do navegador e não armazena dados bancários completos.

## F4 — roteiro sandbox operacional

1. Confirmar que `STRIPE_SECRET_KEY` está em test mode e que webhooks assinados
   estão configurados.
2. Ativar `TES_FINANCE_TEST_CONTROLS_ENABLED=true` somente no ambiente de
   homologação.
3. Conectar ou sincronizar a conta Connect do terapeuta até
   `stripe_transfers_status = active`.
4. Criar reserva e iniciar pagamento por `stripe-create-session-payment`.
5. Processar `checkout.session.completed`/`payment_intent.succeeded` pelo
   webhook Stripe.
6. Confirmar que `session_payments.financial_status = paid`,
   `stripe_charge_id` e comprovante foram gravados.
7. Confirmar a realização por `confirm-session-by-therapist` ou pelo mecanismo
   automático aplicável.
8. Chamar `evaluate-transfer-eligibility` sem override para observar
   `waiting_safety_period`.
9. Chamar `evaluate-transfer-eligibility` com `nowOverride` futuro no sandbox
   para observar `eligible`.
10. Criar lote por `create-weekly-payout-batch` com `cutoffAtOverride` futuro.
11. Processar lote por `process-payout-batch`, que cria
    `stripe.transfers.create` com `source_transaction = stripe_charge_id`.
12. Confirmar `stripe_transfers`, ledger de transferência, read model de
    repasses e dashboard.
13. Rodar `reconcile-stripe-transfers` para recuperar Charge/Transfer pendente
    quando necessário.
14. Desativar `TES_FINANCE_TEST_CONTROLS_ENABLED` ao encerrar o sandbox.

## QA

Validações obrigatórias da fase:

- unidade: parsers/mappers, composição visual, quatro abas e Connect sem
  formulário local;
- Deno: contrato Connect v2 e requisitos;
- pgTAP: grants, isolamento entre terapeutas, centavos, comissão, reembolso,
  disputa, paginação, Connect mascarado;
- Supabase reset/lint/test db;
- typecheck, lint, test e build;
- roteiro Stripe sandbox quando secrets de test mode estiverem presentes.
- F2: pgTAP de métricas, Vitest de mapper/UI e validação de capability Free,
  Premium e Premium Plus.
- F3: pgTAP de capability Premium Plus, supressão de benchmark, ausência de
  IDs privados, ausência de escrita no ledger, metodologias versionadas e
  separação entre realizado, contratado e estimado.
- F4: pgTAP de lifecycle operacional com comprovante, confirmação de sessão,
  segurança controlada, elegibilidade, lote, Transfer com `source_transaction`,
  conciliação e read models privados atualizados.
