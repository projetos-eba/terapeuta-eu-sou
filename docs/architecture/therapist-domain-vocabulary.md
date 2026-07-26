# Vocabulário do domínio do terapeuta

Atualizado em 2026-07-26.

| Termo               | Definição                                                                  | Fonte canônica                        |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| Plano               | Nível comercial `free`, `premium` ou `premium_plus`.                       | `src/domain/tes/enums.ts`             |
| Capability          | Permissão funcional derivada do catálogo de planos.                        | `src/domain/tes/permissions.ts`       |
| Booking             | Reserva operacional de serviço e horário.                                  | `BookingStatus`                       |
| Pagamento           | Ciclo financeiro da cobrança da pessoa paciente.                           | `PaymentStatus` / `session_payments`  |
| Realização          | Evidência de execução do serviço reservado.                                | `FulfillmentStatus`                   |
| Presença            | Comparecimento de paciente e terapeuta.                                    | `AttendanceStatus`                    |
| Reagendamento       | Proposta e resolução de nova faixa de horário.                             | `RescheduleStatus`                    |
| Cancelamento        | Resultado da política financeira existente, separado do pagamento.         | `CancellationStatus`                  |
| Slot disponível     | Intervalo candidato, ainda não reservado.                                  | `AvailableSlot`                       |
| Hold                | Reserva temporária de slot com expiração.                                  | `BookingHoldStatus`                   |
| Snapshot do booking | Título, duração, preço, moeda e buffers preservados no momento da reserva. | `bookings` / `BookingServiceSnapshot` |
| Intervalo ocupado   | Faixa da sessão acrescida dos buffers capturados.                          | `occupied_during`                     |
| Request ID          | Chave idempotente que correlaciona comando e auditoria.                    | RPCs A2 / `booking_events`            |
| Bloqueio            | Exceção de agenda indisponível ou override disponível.                     | `ScheduleBlockType`                   |
| Sessão              | Experiência de realização associada a um booking.                          | DTO compartilhado                     |
| Alias legado        | `/basico/*`, `/pro/*` ou `/plus/*`.                                        | redirects                             |
| Área autenticada    | Namespace único `/terapeuta/*`.                                            | `src/lib/routes.ts`                   |

## Regras

- Status visual não altera status transacional.
- `pending_confirmation` não existe em `BookingStatus`.
- Pagamento não confirma realização.
- Redirect não concede plano ou capability.
- Perfil público usa `/terapeutas/:slug`; operação usa `/terapeuta/*`.
- Feature pode criar view model, mas não outro enum equivalente.
- Preço ou duração atuais do serviço não alteram um booking já criado.
- Um conflito pertence ao terapeuta, não ao serviço.
- Hold não é booking, pagamento ou confirmação de sessão.
