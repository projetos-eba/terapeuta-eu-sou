---
name: message-center
description: Manter a Central de Suporte TES do paciente e do terapeuta, preservando histórico de mensagens entre participantes somente para leitura.
---

# Central de Suporte TES

Este path mantém o nome histórico da skill; a decisão vigente é a
[ADR-021](../../docs/architecture/adr/ADR-021-support-only-session-communications.md).

## Fontes

- `AGENTS.md`, `docs/product/sitemap.md`, `docs/product/routes-map.md`,
  `docs/product/page-inventory.md` e
  `docs/support/support-and-messaging-contracts.md`.
- Imagens de referência fornecidas em 2026-09-15 têm prioridade visual para
  composição e densidade `Balanced`; Figma `13366:7083` é histórico
  complementar e não autoriza restabelecer conversas.

## Rotas e canais

- Paciente: `/app/suporte` e `/app/suporte/:ticketId`.
- Terapeuta: `/terapeuta/suporte` e `/terapeuta/suporte/:ticketId`.
- URLs anteriores em `/mensagens` e aliases Free/Premium/Premium Plus
  redirecionam permanentemente.
- Tickets autenticados permitem conversa plain text somente com a equipe TES,
  com protocolo, respostas, anexos privados e estados próprios.
- WhatsApp TES é canal operacional apenas na preparação/entrada e durante a
  videochamada; não substitui os tickets.
- A sugestão estruturada de terapia fica em
  `/terapeuta/servicos/solicitar-terapia`.

## Segurança e dados

- `conversations` e `messages` permanecem como histórico somente leitura.
  Não renderizar lista, contador, template, composer ou ação paciente ↔
  terapeuta na central ou em shells.
- `POST /api/messages/preview-template` e
  `POST /api/messages/send-template` retornam `410`. RPCs e escrita direta
  de participante autenticado não devem ser reabertas.
- Tickets usam `support_tickets` e `support_ticket_messages`, nunca
  `messages`; nota interna não pertence ao DTO do solicitante.
- `source=message_center` é um valor técnico legado ainda aceito pela
  constraint de tickets; a interface diz Suporte.
- Zero resultados não ativa demo. A demonstração, quando necessária, exige
  `NODE_ENV=development` e `TES_SUPPORT_DEMO_ENABLED=true` no servidor;
  nunca substituir falha de produção por dados aparentes.
- O badge do shell representa chamados não resolvidos, não mensagens de
  participantes.

## UI e QA

- Reutilizar `MessageCenterPage`, `SupportTicketSection`,
  `NewSupportTicketDialog`, `TESDialog` e tokens TES.
- Hero, chamados e avisos TES são as seções ativas; o mobile conserva a ordem
  de prioridade e não cria uma sidebar local.
- Validar ausência de qualquer mensagem participante, criação, lista, detalhe,
  anexos, protocolo, respostas da equipe, avisos lidos/não lidos, redirects e
  acessibilidade de modais.
- Rodar typecheck, lint, build e Vitest. pgTAP e reset de banco são necessários
  para release; migration não testada no PostgreSQL não equivale a aprovação.
