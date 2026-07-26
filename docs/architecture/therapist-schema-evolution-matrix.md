# Matriz de evolução do schema do terapeuta

Atualizado em 2026-07-26.

Status: Fase Agenda 2 implementada e validada.

| Estrutura atual                         | Responsabilidade                                    | Consumidores                                       | RLS       | Decisão                                                |
| --------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | --------- | ------------------------------------------------------ |
| `therapist_services`                    | Oferta publicada pelo terapeuta                     | perfil, reserva, terapeuta                         | existente | reutilizar                                             |
| `availability_rules`                    | Faixas semanais                                     | perfil e futuro slot engine                        | existente | adaptar somente quando o motor autoritativo for criado |
| `availability_exceptions`               | Overrides e indisponibilidade                       | perfil e futuro slot engine                        | existente | reutilizar                                             |
| `therapist_service_booking_settings`    | buffers, antecedência e horizonte                   | preview e futuro slot engine                       | existente | reutilizar                                             |
| `bookings`                              | reserva operacional e snapshots do serviço          | paciente, terapeuta, admin                         | existente | reutilizar; snapshots e conflito A2 implementados      |
| `booking_events`                        | histórico operacional com ator, origem e request ID | serviços de domínio                                | existente | reutilizar; auditoria A2 implementada                  |
| `booking_reschedule_requests`           | propostas versionadas de reagendamento              | dashboard e sessões                                | existente | reutilizar; expiração e resolução A2 implementadas     |
| `booking_session_summaries`             | resumo compartilhável                               | paciente e terapeuta                               | existente | reutilizar                                             |
| `payments`                              | representação financeira legada                     | código legado                                      | existente | manter apenas como projeção temporária                 |
| `bookings.payment_status`               | atalho legado                                       | telas antigas                                      | existente | projeção temporária                                    |
| `booking_payment_receipts`              | recibo legado                                       | paciente                                           | existente | adaptar como projeção                                  |
| `session_payments`                      | pagamento transacional da sessão                    | Stripe e financeiro                                | existente | fonte canônica                                         |
| `session_service_confirmations`         | realização do serviço                               | financeiro e sessão                                | existente | reutilizar                                             |
| `session_cancellation_decisions`        | política financeira de cancelamento                 | financeiro                                         | existente | reutilizar                                             |
| `financial_ledger_entries`              | ledger                                              | operação financeira                                | restrita  | reutilizar                                             |
| `payout_batches` / `payout_batch_items` | lote e itens de repasse                             | operação financeira                                | restrita  | reutilizar                                             |
| `zoom_meetings` / `zoom_meeting_jobs`   | estado local da sala e outbox                       | backend Zoom e participantes por projeções seguras | existente | reutilizar; integrado às transições A2                 |
| `conversations` / `messages`            | comunicação                                         | paciente e terapeuta                               | existente | reutilizar                                             |
| `reviews` / `review_replies`            | avaliação e resposta                                | público e terapeuta                                | existente | reutilizar                                             |
| `notifications`                         | avisos operacionais                                 | shells autenticados                                | existente | reutilizar                                             |
| `booking_holds`                         | concorrência temporária de slot                     | Edge Functions e participantes em leitura          | existente | fonte canônica de hold A2                              |

## Riscos de compatibilidade

- Projeções financeiras legadas permanecem somente para compatibilidade; o F0
  sincroniza a fonte canônica `session_payments`.
- O preview TypeScript não é timezone-safe nem compõe slots de forma
  autoritativa; A5 permanece necessária.
- Holds e bookings estão protegidos no Postgres, mas só devem ser orquestrados
  por Edge Functions autenticadas.
- Zoom possui persistência e outbox, mas o go-live depende dos gates
  operacionais em `docs/zoom/production-readiness.md`.
- Remover aliases sem telemetria pode quebrar bookmarks.

## Regra de evolução

Antes de criar tabela, enum, policy ou índice, procurar estrutura equivalente
nesta matriz e nas migrations. Toda mudança futura exige migration versionada,
RLS e teste SQL correspondente.
