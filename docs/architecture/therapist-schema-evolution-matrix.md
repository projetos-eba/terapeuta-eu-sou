# Matriz de evolução do schema do terapeuta

Atualizado em 2026-07-25.

Status: decisão da Fase Agenda 1; nenhuma migration foi criada nesta fase.

| Estrutura atual | Responsabilidade | Consumidores | RLS | Decisão |
|---|---|---|---|---|
| `therapist_services` | Oferta publicada pelo terapeuta | perfil, reserva, terapeuta | existente | reutilizar |
| `availability_rules` | Faixas semanais | perfil e futuro slot engine | existente | adaptar somente quando o motor autoritativo for criado |
| `availability_exceptions` | Overrides e indisponibilidade | perfil e futuro slot engine | existente | reutilizar |
| `therapist_service_booking_settings` | buffers, antecedência e horizonte | preview e futuro slot engine | existente | reutilizar |
| `bookings` | reserva operacional | paciente, terapeuta, admin | existente | reutilizar; snapshots futuros por migration |
| `booking_events` | histórico operacional | serviços de domínio | existente | reutilizar |
| `booking_reschedule_requests` | propostas de reagendamento | dashboard e sessões | existente | reutilizar |
| `booking_session_summaries` | resumo compartilhável | paciente e terapeuta | existente | reutilizar |
| `payments` | representação financeira legada | código legado | existente | manter apenas como projeção temporária |
| `bookings.payment_status` | atalho legado | telas antigas | existente | projeção temporária |
| `booking_payment_receipts` | recibo legado | paciente | existente | adaptar como projeção |
| `session_payments` | pagamento transacional da sessão | Stripe e financeiro | existente | fonte canônica |
| `session_service_confirmations` | realização do serviço | financeiro e sessão | existente | reutilizar |
| `session_cancellation_decisions` | política financeira de cancelamento | financeiro | existente | reutilizar |
| `financial_ledger_entries` | ledger | operação financeira | restrita | reutilizar |
| `payout_batches` / `payout_batch_items` | lote e itens de repasse | operação financeira | restrita | reutilizar |
| `booking_meetings` | dados de reunião | não identificado nos arquivos analisados | não identificado | criar somente na fase Zoom |
| `conversations` / `messages` | comunicação | paciente e terapeuta | existente | reutilizar |
| `reviews` / `review_replies` | avaliação e resposta | público e terapeuta | existente | reutilizar |
| `notifications` | avisos operacionais | shells autenticados | existente | reutilizar |
| `booking_holds` | concorrência temporária de slot | ainda inexistente | não aplicável | criar na Fase A2 com migration |

## Riscos de compatibilidade

- Projeções financeiras legadas podem divergir antes do backfill F0.
- O preview TypeScript não é timezone-safe nem transacional.
- Reunião online ainda não possui contrato persistido confirmado.
- Remover aliases sem telemetria pode quebrar bookmarks.

## Regra de evolução

Antes de criar tabela, enum, policy ou índice, procurar estrutura equivalente
nesta matriz e nas migrations. Toda mudança futura exige migration versionada,
RLS e teste SQL correspondente.
