---
name: therapist-agenda-sessions
description: Implementar e manter Agenda, disponibilidade, bookings e Sessões do terapeuta usando rotas, contratos e fontes transacionais compartilhadas.
---

# Agenda e Sessões do terapeuta

## Fontes obrigatórias

1. `AGENTS.md`.
2. Figma da página específica, quando disponível.
3. `docs/architecture/adr/ADR-001-therapist-canonical-routes.md`.
4. `docs/architecture/adr/ADR-002-booking-session-boundary.md`.
5. `docs/architecture/adr/ADR-003-session-payments-source-of-truth.md`.
6. `docs/architecture/adr/ADR-004-meeting-security.md`.
7. `docs/architecture/adr/ADR-005-availability-authority.md`.
8. `docs/architecture/therapist-domain-vocabulary.md`.
9. `docs/architecture/therapist-schema-evolution-matrix.md`.
10. `src/lib/routes.ts` e `src/domain/tes`.

## Rotas

- Agenda: `/terapeuta/agenda`.
- Sessões: `/terapeuta/sessoes`.
- Detalhe: `/terapeuta/sessoes/:bookingId`.
- Aliases `/basico/*`, `/pro/*` e `/plus/*` são somente redirects.

## Contratos

- Reserva: `BookingStatus`.
- Pagamento: `PaymentStatus` e `session_payments`.
- Realização: `FulfillmentStatus`.
- Presença: `AttendanceStatus`.
- Reagendamento: `RescheduleStatus`.
- Erros: `TesDomainError` e `DomainErrorCode`.

Não criar enums equivalentes dentro de features.

## Disponibilidade

- O preview TypeScript não confirma reserva.
- Booking do terapeuta bloqueia todos os serviços no mesmo intervalo.
- Aplicar buffers e validar intervalos.
- O Postgres protege holds e bookings; a composição autoritativa de slots
  continua pertencendo ao futuro endpoint A5.
- `booking_holds` usa TTL, idempotência, snapshots e advisory lock por
  terapeuta.
- `occupied_during` e constraints GiST impedem conflito entre serviços.

## Comandos transacionais A2

- `reserve_booking_hold_v1`: cria hold somente via backend confiável.
- `consume_booking_hold_v1`: converte hold em um booking `draft`.
- `transition_booking_status_v1`: aplica transição operacional e auditoria.
- `request_booking_reschedule_v1`: cria proposta versionada.
- `resolve_booking_reschedule_v1`: aplica resolução e sincroniza o outbox Zoom.
- `session_payments` continua sendo a única fonte financeira.
- O checkout de sessão deve usar o snapshot do booking, nunca o preço atual do
  serviço.
- RPCs de escrita são `service_role` only e devem ser chamados por Edge
  Functions que autenticam e autorizam o usuário.

## Privacidade e segurança

- Não expor notas privadas, Match, dados médicos ou URL de host.
- Paciente e terapeuta leem o mesmo booking por DTOs permitidos.
- Pagamento é confirmado apenas por webhook.
- Zoom só é criado depois do pagamento confirmado.
- Zoom deve ser provisionado por `zoom_meeting_jobs`; clique do frontend nunca cria reunião.
- Terapeuta recebe `role=1` e ZAK somente por backend, quando responsável pela booking.
- Toda consulta autenticada usa RLS.

## QA

- Testar conflito entre serviços, buffers, exceções e período vazio.
- Testar transições permitidas e proibidas.
- Testar paciente e terapeuta com o mesmo horário e serviço.
- Testar RLS entre terapeutas.
- Rodar `npx supabase db reset`, `npx supabase db lint --schema public` e
  `npx supabase test db`.
- Rodar typecheck, lint, Vitest e build.
