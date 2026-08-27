---
name: therapist-support-ticket
description: Manter tickets e threads de suporte de pacientes e terapeutas sem misturar texto livre com mensagens entre participantes.
---

# Tickets de Suporte do Solicitante

## Fontes obrigatórias

1. `AGENTS.md`.
2. `docs/support/support-and-messaging-contracts.md`.
3. `docs/architecture/adr/ADR-016-support-vs-participant-messaging.md`.
4. `docs/product/routes-map.md` e `docs/product/integration-map.md`.

## Rotas e contratos

- Central: `/terapeuta/mensagens`.
- Detalhe: `/terapeuta/mensagens/suporte/:ticketId`.
- Central do paciente: `/app/mensagens`.
- Detalhe do paciente: `/app/mensagens/suporte/:ticketId`.
- APIs: `POST|GET /api/support/tickets`, `GET|POST /api/support/tickets/:ticketId`.
- Admin mínimo: `GET /api/admin/support/tickets/:ticketId/thread`,
  `POST /api/admin/support/tickets/:ticketId/reply` e
  `POST /api/admin/support/tickets/:ticketId/notes`.

## Dados e segurança

- `support_tickets.protocol` é persistido e imutável no formato `#` + nove dígitos + letra da categoria; nunca derivar um protocolo do UUID na UI.
- `support_ticket_messages` é a thread plain text. `visibility=requester` é legível pelo solicitante; `visibility=internal` é exclusivamente TES/Admin.
- Nunca usar `messages`, `conversations` ou o endpoint participante para suporte. Nunca adicionar texto livre ao fluxo paciente ↔ terapeuta.
- `requestId` é obrigatório para criação e resposta, protegendo contra retry.
- A identidade é derivada do cookie autenticado e validada como `patient` ou
  `therapist`; nunca confiar em `actorRole` enviado pelo navegador.
- Renderizar `body` como texto; não usar HTML, Markdown privilegiado ou `dangerouslySetInnerHTML`.
- A thread Admin usa exclusivamente a RPC administrativa
  `admin_get_support_ticket_thread_v1`; somente ela pode incluir
  `visibility=internal`. A API e o DTO do solicitante não podem usar essa RPC.
- O detalhe e a lista usam SSE mediado pelo servidor. Em queda, usar polling temporário com reconexão progressiva, retomar SSE quando disponível e atualizar ao voltar para a aba visível.
- Badges do solicitante precisam dizer quem age: “Recebemos seu chamado”, “Em atendimento pelo TES”, “Aguardando resposta do TES”, “Aguardando sua resposta” ou “Resolvido”.

## QA

- Validar vazio, loading, erro, sucesso e estado resolvido.
- Validar que ticket alheio e nota interna não chegam ao DTO do terapeuta.
- Validar que o Admin vê uma resposta subsequente do terapeuta e que uma nota
  interna criada pelo Admin não aparece após o reload do detalhe do terapeuta.
- Validar desktop, tablet e mobile sem overflow do textarea.
- Validar que o paciente consegue criar o chamado e abrir a thread pública.
- Validar protocolo persistido, estado após resposta do TES/solicitante e atualização entre duas sessões autenticadas.
- Rodar testes API/Vitest, pgTAP de suporte e o teste de bypass de participante.
