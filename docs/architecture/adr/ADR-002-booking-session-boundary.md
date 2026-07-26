# ADR-002 - Limite entre booking e sessão

Data: 2026-07-25

Status: aceito.

## Contexto

Reserva, pagamento, realização e presença evoluem em ritmos diferentes.
Concentrar todos esses eventos em `bookings.status` produz transições ambíguas
e dificulta reconciliação.

## Decisão

- Booking representa a reserva operacional de horário.
- `BookingStatus` continua sendo o enum canônico da reserva.
- Pagamento de sessão usa `session_payments.financial_status`; `PaymentStatus`
  permanece somente em contratos legados de compatibilidade.
- Realização usa `FulfillmentStatus`.
- Presença usa `AttendanceStatus`.
- Reagendamento e cancelamento usam contratos próprios.
- O DTO compartilhado combina os estados sem fundi-los.

## Alternativas

- Um único status: rejeitado por misturar ciclos independentes.
- Uma tabela nova para cada tela: rejeitada por criar fontes concorrentes.

## Consequências

- UI pode derivar um rótulo composto sem alterar o estado transacional.
- Agenda e Sessões usam `SessionPresentation`, derivado de reserva, pagamento,
  realização, presença, reagendamento, cancelamento, Zoom e janela temporal.
- Paciente e terapeuta veem o mesmo booking, horário e serviço.
- Novos estados exigem alteração no contrato canônico e avaliação do schema.

## Privacidade

O contrato-base não inclui notas privadas, conteúdo clínico, respostas do
Match, documentos ou URL de host.
