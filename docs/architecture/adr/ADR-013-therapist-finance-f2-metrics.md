# ADR-013 — Financeiro do terapeuta F2: métricas intermediárias

Data: 2026-07-29

## Status

Aceita para implementação local.

## Contexto

A F0/F1 do financeiro entregou a operação essencial do terapeuta: Resumo,
Recebimentos, Repasses e Conta de recebimento, usando `session_payments` como
fonte financeira canônica e Stripe Connect hospedado.

A F2 evolui somente a aba Resumo com métricas intermediárias úteis para Premium
e Premium Plus. O Figma `14242:1347` orienta hierarquia visual, mas contém
elementos fora do escopo desta fase, como histórico dedicado, projeções,
oportunidades, benchmark, comparação com a plataforma e recomendações TES.

## Decisão

Criar o read model privado
`get_private_therapist_financial_metrics_v1(date,date,text)`.

O contrato:

- deriva o terapeuta de `auth.uid()`;
- exige plano Premium ou Premium Plus;
- retorna centavos inteiros;
- calcula agregações server-side;
- usa o mesmo período e timezone em todas as métricas;
- não usa `bookings.payment_status` como autoridade financeira;
- não altera Stripe Connect, Stripe Billing, comissão, cancelamento, reembolso,
  disputa ou repasse.

Free mantém o resumo operacional da F0/F1. Premium e Premium Plus recebem as
métricas F2 por `advanced_metrics`. `advanced_financials` permanece reservado
para fases futuras de inteligência financeira avançada.

## Definições

| Métrica                    | Definição oficial                                                                                                                                           | Fonte                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Receita líquida no período | Soma do valor líquido devido ao terapeuta para pagamentos confirmados no período, depois da comissão TES e de reembolsos ao cliente com status `succeeded`. | `session_payments` + `session_refunds`                  |
| Ticket médio bruto         | `grossPaidCents / paidSessionCount`.                                                                                                                        | `session_payments`                                      |
| Ticket médio líquido       | `therapistNetCents / paidSessionCount`.                                                                                                                     | read model                                              |
| Sessões pagas              | Quantidade de pagamentos em `paid`, `partially_refunded`, `refunded` ou `disputed` dentro do período.                                                       | `session_payments`                                      |
| Sessões realizadas         | Bookings concluídos ou pagamentos com confirmação canônica de realização.                                                                                   | `bookings` + `session_payments.service_status`          |
| Taxa de retorno simples    | Percentual de pacientes elegíveis que tiveram nova sessão paga em até 90 dias depois da primeira sessão concluída no período.                               | `bookings` + `session_payments`                         |
| Taxa de cancelamento       | `cancelledSessions / eligibleScheduledSessions`.                                                                                                            | `bookings`                                              |
| Taxa de reagendamento      | `rescheduledSessions / eligibleScheduledSessions`.                                                                                                          | `booking_reschedule_requests` + `bookings`              |
| Evolução financeira        | Série semanal com realizado no período atual e líquido do período anterior equivalente.                                                                     | `session_payments`                                      |
| Faturamento por terapia    | Agrupamento por terapia canônica vinculada ao serviço, com sessões pagas, bruto, líquido e ticket médio.                                                    | `session_payments` + `therapist_services` + `therapies` |

O ticket médio principal na UI é o líquido, porque conversa diretamente com o
valor que pertence ao terapeuta. O ticket bruto aparece como detalhe textual.

## Períodos e Comparação

Os períodos aceitos pela rota continuam `30`, `90` e `month`.

- `30`: últimos 30 dias locais, incluindo hoje;
- `90`: últimos 90 dias locais, incluindo hoje;
- `month`: do primeiro dia do mês local até hoje.

O período anterior é sempre equivalente em quantidade de dias e termina no dia
anterior ao início do período atual. Quando não houver base anterior, o contrato
retorna `comparisonStatus = "no_previous_data"`. Quando o período anterior for
zero, retorna `division_by_zero` e não calcula crescimento infinito. Quando o
período atual não tiver base, retorna `insufficient_data`.

`period.isPartial = true` somente quando o fim do período é o dia atual no
timezone do terapeuta.

## Denominadores

`eligibleScheduledSessions` inclui sessões com status `confirmed`,
`completed`, `cancelled_by_patient`, `cancelled_by_therapist`,
`no_show_patient`, `no_show_therapist` e `refunded`.

Cancelamentos contam `cancelled_by_patient`, `cancelled_by_therapist` e
`refunded`.

Reagendamentos contam apenas `booking_reschedule_requests.status = applied`
com `applied_at` dentro do período.

Retorno simples usa janela de 90 dias e mínimo de 10 pacientes elegíveis. Um
paciente só entra no denominador quando a janela de 90 dias após a primeira
sessão concluída já está completa; caso contrário, a métrica fica
`insufficient_data`.

## Estados Financeiros

Pagamentos com disputa aberta permanecem no conjunto financeiro contado, mas o
estado de disputa continua visível nos read models operacionais da F0/F1.

Pagamento pago sem sessão realizada entra em sessões pagas e receita, mas não
infla sessões realizadas.

Reembolso parcial ou total reduz a receita líquida quando existe registro
canônico em `session_refunds.status = succeeded`.

## Faturamento Por Terapia

O agrupamento usa `session_payments.service_id -> therapist_services.therapy_id`
e o nome canônico atual da terapia. Quando a terapia não estiver disponível, o
read model usa `bookings.service_title_snapshot` como fallback textual seguro.

Risco aceito: o schema atual ainda não possui um snapshot imutável explícito de
`therapy_id` e `therapy_name` em `session_payments`. Para histórico financeiro
perfeito se o vínculo do serviço mudar no futuro, uma fase posterior deve
adicionar snapshot de terapia no momento do booking/pagamento.

## Fora do Escopo Preservado

Não implementar nesta fase:

- potencial financeiro da agenda;
- oportunidade do mês;
- receita potencial não convertida;
- benchmark ou média da plataforma;
- comparação com outros terapeutas;
- recomendações automáticas TES;
- retenção avançada por coorte;
- ranking estratégico completo;
- simulações de preço;
- IA generativa;
- campanhas automáticas;
- aba Histórico;
- alterações no Stripe Billing ou Stripe Connect.

## Consequências

- A aba Resumo ganha valor analítico sem criar nova fonte financeira.
- Free continua com operação financeira essencial.
- Premium e Premium Plus compartilham as métricas intermediárias.
- A UI precisa comunicar estados de dados insuficientes, período parcial,
  ausência de período anterior e denominador zero.
- O frontend apenas formata DTOs; não calcula saldos nem agregados
  autoritativos.

## Referências

- `docs/payments/therapist-finance-f0-f1.md`;
- `docs/payments/architecture.md`;
- `supabase/migrations/20260729090000_therapist_finance_f2_metrics.sql`;
- `supabase/tests/017_therapist_finance_f2_metrics.sql`;
- Figma `Z42SR0Pi0m307SmcAkDqHb`, frame `14242:1347`.
