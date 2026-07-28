# Fechamento A8/A10 - Paciente, reagendamento e cancelamento

Data: 2026-07-27

Status: implementado localmente.

## Decisao de escopo

A9 foi pulado neste ciclo por solicitacao explicita. O acesso Zoom continua no
gate existente (`zoom-video-session-access`) e nao recebeu novas regras de
presenca, capacidade, Marketplace ou cron remoto neste marco.

## Escopo A8

A8 conecta a experiencia da pessoa paciente aos mesmos dados transacionais da
agenda:

- `/app/encontros` passa a considerar `session_payments.financial_status` para
  estado de pagamento pendente;
- `/app/encontros` mostra reagendamento pendente a partir de
  `booking_reschedule_requests`;
- `/app/encontros/:bookingId` carrega versao operacional do booking e a
  proposta de reagendamento mais recente;
- o detalhe do paciente exibe ações reais de cancelamento e reagendamento em
  `TESDialog`, preservando o restante da experiencia de recibo, ajuda e Zoom.

## Escopo A10

A10 reutiliza as primitivas existentes em vez de criar novas autoridades:

- `request-session-cancellation` continua sendo a unica Edge Function de
  cancelamento operacional/financeiro de sessao;
- `session-reschedule` autentica paciente ou terapeuta, valida participacao no
  booking e consulta `get_service_available_slots_v1` antes de criar a
  proposta;
- a proposta usa `request_booking_reschedule_v1` com versao esperada,
  idempotencia e expiracao de 48 horas;
- aceite, recusa e retirada da proposta usam `resolve_booking_reschedule_v1`;
- o detalhe do terapeuta tambem usa os mesmos comandos para cancelar, propor,
  aceitar, recusar ou retirar uma proposta pendente.

## Autoridades preservadas

| Informacao               | Autoridade preservada                               |
| ------------------------ | --------------------------------------------------- |
| Slot para reagendamento  | `get_service_available_slots_v1`                    |
| Booking/versionamento    | `bookings.version` e RPCs A2                        |
| Proposta                 | `booking_reschedule_requests`                       |
| Cancelamento             | `request-session-cancellation`                      |
| Politica de reembolso    | `calculate_session_cancellation_policy`             |
| Pagamento                | `session_payments.financial_status`                 |
| Confirmacao financeira   | webhook Stripe                                      |
| Zoom                     | `zoom-video-session-access` e sessoes locais atuais |

## Rotas e funcoes

- `POST /api/session/cancel`;
- `POST /api/session/reschedule`;
- `supabase/functions/session-reschedule`;
- `supabase/functions/request-session-cancellation` permanece reutilizada.

As rotas Next apenas selecionam o cookie autenticado do ator (`patient` ou
`therapist`) e encaminham o comando para Supabase Edge Functions. Elas nao
acessam service role, Stripe secret ou ledger.

## Limites conhecidos

- A10 implementa proposta simples de novo horario; contraproposta encadeada e
  negociacao multi-etapas continuam fora deste ciclo.
- A expiracao existe no contrato A2 e na proposta criada com 48 horas, mas nao
  foi adicionada uma rotina nova de manutencao neste marco.
- Disputas operacionais e bloqueio urgente continuam usando os estados e
  politicas existentes; nao houve nova tabela, migration ou policy.
- A9 permanece pendente conforme decisao de escopo.

## Validacao

Coberturas adicionadas:

- Deno para `session-reschedule`;
- Vitest para estados de pagamento e reagendamento na lista do paciente.

Comandos esperados:

- `npm run test:deno`;
- `npx vitest run src/features/patient-encounters/patient-encounters.mappers.test.ts`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run test`;
- `npm run build`.
