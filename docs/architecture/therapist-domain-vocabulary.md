# Vocabulário do domínio do terapeuta

Atualizado em 2026-07-25.

| Termo | Definição | Fonte canônica |
|---|---|---|
| Plano | Nível comercial `free`, `premium` ou `premium_plus`. | `src/domain/tes/enums.ts` |
| Capability | Permissão funcional derivada do catálogo de planos. | `src/domain/tes/permissions.ts` |
| Booking | Reserva operacional de serviço e horário. | `BookingStatus` |
| Pagamento | Ciclo financeiro da cobrança da pessoa paciente. | `PaymentStatus` / `session_payments` |
| Realização | Evidência de execução do serviço reservado. | `FulfillmentStatus` |
| Presença | Comparecimento de paciente e terapeuta. | `AttendanceStatus` |
| Reagendamento | Proposta e resolução de nova faixa de horário. | `RescheduleStatus` |
| Cancelamento | Resultado da política financeira existente, separado do pagamento. | `CancellationStatus` |
| Slot disponível | Intervalo candidato, ainda não reservado. | `AvailableSlot` |
| Hold | Reserva temporária de slot com expiração. | `BookingHoldStatus` |
| Bloqueio | Exceção de agenda indisponível ou override disponível. | `ScheduleBlockType` |
| Sessão | Experiência de realização associada a um booking. | DTO compartilhado |
| Alias legado | `/basico/*`, `/pro/*` ou `/plus/*`. | redirects |
| Área autenticada | Namespace único `/terapeuta/*`. | `src/lib/routes.ts` |

## Regras

- Status visual não altera status transacional.
- `pending_confirmation` não existe em `BookingStatus`.
- Pagamento não confirma realização.
- Redirect não concede plano ou capability.
- Perfil público usa `/terapeutas/:slug`; operação usa `/terapeuta/*`.
- Feature pode criar view model, mas não outro enum equivalente.
