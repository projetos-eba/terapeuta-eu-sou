---
name: therapist-support-ticket
description: Manter o ticket e a thread de suporte do terapeuta sem misturar texto livre com mensagens a pacientes.
---

# Ticket de Suporte do Terapeuta

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/support/support-and-messaging-contracts.md`.
3. `docs/architecture/adr/ADR-016-support-vs-participant-messaging.md`.
4. `docs/product/routes-map.md` e `docs/product/integration-map.md`.

## Rotas e contratos

- Central: `/terapeuta/mensagens`.
- Detalhe: `/terapeuta/mensagens/suporte/:ticketId`.
- APIs: `POST|GET /api/support/tickets`, `GET|POST /api/support/tickets/:ticketId`.
- Admin mínimo: `GET /api/admin/support/tickets/:ticketId/thread`,
  `POST /api/admin/support/tickets/:ticketId/reply` e
  `POST /api/admin/support/tickets/:ticketId/notes`.

## Dados e segurança

- `support_tickets` guarda protocolo, requester derivado, status e contexto autorizado.
- `support_ticket_messages` é a thread plain text. `visibility=requester` é legível pelo solicitante; `visibility=internal` é exclusivamente TES/Admin.
- Nunca usar `messages`, `conversations` ou o endpoint participante para suporte. Nunca adicionar texto livre ao fluxo paciente ↔ terapeuta.
- `requestId` é obrigatório para criação e resposta, protegendo contra retry.
- Renderizar `body` como texto; não usar HTML, Markdown privilegiado ou `dangerouslySetInnerHTML`.
- A thread Admin usa exclusivamente a RPC administrativa
  `admin_get_support_ticket_thread_v1`; somente ela pode incluir
  `visibility=internal`. A API e o DTO do solicitante não podem usar essa RPC.

## QA

- Validar vazio, loading, erro, sucesso e estado resolvido.
- Validar que ticket alheio e nota interna não chegam ao DTO do terapeuta.
- Validar que o Admin vê uma resposta subsequente do terapeuta e que uma nota
  interna criada pelo Admin não aparece após o reload do detalhe do terapeuta.
- Validar desktop, tablet e mobile sem overflow do textarea.
- Rodar testes API/Vitest, pgTAP de suporte e o teste de bypass de participante.
