# Matriz de evolução do schema do terapeuta

Atualizado em 2026-07-27.

Status: A2, read models, A3, A4 e A5 implementados.

| Estrutura atual                          | Responsabilidade                                    | Consumidores                                       | RLS       | Decisão                                                 |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | --------- | ------------------------------------------------------- |
| `therapist_services`                     | Oferta publicada pelo terapeuta                     | perfil, reserva, terapeuta                         | existente | reutilizar                                              |
| `availability_rules`                     | Faixas semanais                                     | perfil e slot engine A5                            | existente | fonte canônica das janelas semanais                     |
| `availability_exceptions`                | Overrides e ocorrências materializadas de bloqueio  | Agenda, perfil e slot engine A5                    | existente | fonte canônica dos intervalos A4                        |
| `availability_exception_series`          | Intenção e timezone da recorrência                  | Agenda/Bloqueios                                   | existente | definição A4; ocorrências ficam em exceptions           |
| `availability_exception_booking_impacts` | Relação entre bloqueio e booking preservado         | Agenda/Bloqueios e Sessões                         | existente | exige resolução explícita                               |
| `availability_exception_events`          | Auditoria e idempotência de bloqueios               | operação e suporte                                 | existente | sem conteúdo clínico ou payload externo                 |
| `therapist_service_booking_settings`     | buffers, antecedência e horizonte                   | preview e slot engine A5                           | existente | fonte canônica A3/A5                                    |
| `therapist_schedule_settings`            | timezone canônico e versão otimista da agenda       | Horários e slot engine A5                          | existente | fonte canônica A3                                       |
| `therapist_schedule_events`              | auditoria sanitizada de alterações de horários      | operação e suporte                                 | existente | somente eventos, sem conteúdo clínico                   |
| `bookings`                               | reserva operacional e snapshots do serviço          | paciente, terapeuta, admin                         | existente | reutilizar; snapshots e conflito A2 implementados       |
| `booking_events`                         | histórico operacional com ator, origem e request ID | serviços de domínio                                | existente | reutilizar; auditoria A2 implementada                   |
| `booking_reschedule_requests`            | propostas versionadas de reagendamento              | dashboard e sessões                                | existente | reutilizar; expiração e resolução A2 implementadas      |
| `booking_session_summaries`              | resumo compartilhável                               | paciente e terapeuta                               | existente | reutilizar                                              |
| `payments`                               | representação financeira legada                     | código legado                                      | existente | manter apenas como projeção temporária                  |
| `bookings.payment_status`                | atalho legado                                       | telas antigas                                      | existente | projeção temporária                                     |
| `booking_payment_receipts`               | recibo legado                                       | paciente                                           | existente | adaptar como projeção                                   |
| `session_payments`                       | pagamento transacional da sessão                    | Stripe e financeiro                                | existente | fonte canônica                                          |
| `session_service_confirmations`          | realização do serviço                               | financeiro e sessão                                | existente | reutilizar                                              |
| `session_cancellation_decisions`         | política financeira de cancelamento                 | financeiro                                         | existente | reutilizar                                              |
| `financial_ledger_entries`               | ledger                                              | operação financeira                                | restrita  | reutilizar                                              |
| `payout_batches` / `payout_batch_items`  | lote e itens de repasse                             | operação financeira                                | restrita  | reutilizar                                              |
| `video_sessions` / `video_sessions`      | estado local da sala e outbox                       | backend Zoom e participantes por projeções seguras | existente | reutilizar; integrado às transições A2                  |
| `conversations` / `messages`             | comunicação                                         | paciente e terapeuta                               | existente | reutilizar                                              |
| `reviews` / `review_replies`             | avaliação e resposta                                | público e terapeuta                                | existente | reutilizar                                              |
| `notifications`                          | avisos operacionais                                 | shells autenticados                                | existente | reutilizar                                              |
| `booking_holds`                          | concorrência temporária de slot                     | Edge Functions e participantes em leitura          | existente | fonte canônica de hold A2                               |
| `therapist_session_read_model_v1`        | composição privada de Agenda e Sessões              | terapeuta                                          | invoker   | fonte de leitura versionada                             |
| `get_therapist_sessions_v1`              | lista filtrável e paginada por cursor               | `/terapeuta/sessoes`                               | invoker   | identidade derivada de `auth.uid()`                     |
| `get_therapist_session_detail_v1`        | detalhe privado e estado Zoom previsto              | detalhe da sessão                                  | invoker   | não retorna credenciais de host                         |
| `get_therapist_agenda_v1`                | reservas, holds e disponibilidade por intervalo     | `/terapeuta/agenda`                                | invoker   | intervalo semiaberto `[start, end)`                     |
| `get_therapist_shell_counters_v1`        | contadores pequenos independentes de plano          | shell                                              | invoker   | substitui carga do dashboard no layout                  |
| `get_therapist_schedule_v1`              | regras e configurações versionadas                  | `/terapeuta/agenda?aba=horarios`                   | invoker   | identidade derivada de `auth.uid()`                     |
| `save_therapist_schedule_v1`             | substituição atômica e idempotente dos horários     | Edge Function de Horários                          | restrita  | somente `service_role`; ator validado na Edge           |
| `get_therapist_blocks_v1`                | bloqueios, recorrência e impactos por período       | `/terapeuta/agenda?aba=bloqueios`                  | invoker   | identidade derivada de `auth.uid()`                     |
| comandos `therapist_block_*_v1`          | criação, remoção e resolução idempotentes           | Edge Function de Bloqueios                         | restrita  | somente `service_role`; booking não é alterado          |
| `therapies.calendar_color_key`           | chave semântica de cor no calendário                | Agenda e futuras telas de terapia                  | existente | frontend mapeia a chave; banco não persiste CSS         |
| `get_service_available_slots_v1`         | slots públicos autoritativos por serviço            | reserva pública e A6                               | público   | não revela participantes nem causa da indisponibilidade |
| `session-booking-checkout`               | orquestração A6 slot -> hold -> booking -> Checkout | reserva pública autenticada                        | Edge      | não confirma pagamento nem calcula finanças             |
| `get_therapist_calendar_v1`              | calendário privado dia, semana e mês                | `/terapeuta/agenda?aba=calendario`                 | invoker   | identidade derivada de `auth.uid()`                     |
| `validate_booking_hold_schedule_v1`      | valida o hold contra a agenda configurada           | trigger de `booking_holds`                         | interna   | não executável diretamente pelo browser                 |

## Riscos de compatibilidade

- Projeções financeiras legadas permanecem somente para compatibilidade; o F0
  sincroniza a fonte canônica `session_payments`.
- O preview TypeScript legado não é autoritativo; novos consumidores devem usar
  `get_service_available_slots_v1`.
- `therapist_profiles.metadata.timezone` é somente projeção de compatibilidade;
  a autoridade A3 é `therapist_schedule_settings.timezone`.
- Holds e bookings estão protegidos no Postgres, mas só devem ser orquestrados
  por Edge Functions autenticadas.
- Presença ainda não tem autoridade própria; os read models distinguem
  `booking_compatibility` de `unavailable`.
- Modalidade é derivada do serviço atual até existir snapshot no booking.
- Zoom possui persistência e outbox, mas o go-live depende dos gates
  operacionais em `docs/zoom/production-readiness.md`.
- Remover aliases sem telemetria pode quebrar bookmarks.

## Regra de evolução

Antes de criar tabela, enum, policy ou índice, procurar estrutura equivalente
nesta matriz e nas migrations. Toda mudança futura exige migration versionada,
RLS e teste SQL correspondente.
