# Relatório — Fase 2: Suporte do Terapeuta

Data: 2026-08-21  
Status: PASS — HML qualificada

## Estado inicial

`support_tickets` já tinha protocolo, idempotência por solicitante e contexto opcional de booking, mas a API/UI ainda resolvia texto por template e não existia thread. `messages` já estava endurecida pela Fase 1 e não foi reutilizada.

## Arquitetura implementada

- Migration `20260821213315_therapist_support_ticket_threads.sql` cria `support_ticket_messages`, índices, RLS e RPCs server-authoritative.
- A abertura migrou para categoria fechada, assunto e descrição plain text; requester, papel e contexto autorizado são resolvidos no banco.
- A descrição inicial é materializada como primeira mensagem pública. Tickets históricos sem mensagens expõem a descrição legada como primeira mensagem conceitual, sem backfill destrutivo.
- Respostas públicas do solicitante usam chave idempotente; Admin lê a thread
  por RPC Admin-only, responde, registra nota interna e continua usando o
  command auditado existente para resolver/reabrir.

## Rotas e componentes

- `/terapeuta/mensagens`: seção separada **Suporte TES**, listagem, empty state e diálogo de novo chamado.
- `/terapeuta/mensagens/suporte/:ticketId`: protocolo, status, thread pública e composer plain text.
- `/api/support/tickets` e `/api/support/tickets/:ticketId`: listagem, criação, detalhe e resposta do terapeuta.
- `/api/admin/support/tickets/:ticketId/thread`: thread completa para Admin
  autorizado, incluindo nota interna.
- `/api/admin/support/tickets/:ticketId/reply`: resposta pública com
  `admin.support.manage`.
- `/api/admin/support/tickets/:ticketId/notes`: nota interna com
  `admin.support.manage`.

## RLS e lifecycle

- Solicitante só lê ticket próprio e mensagens `requester`; nota `internal` não entra na policy nem no DTO/API do solicitante.
- INSERT/UPDATE/DELETE diretos em tickets e thread foram revogados para `authenticated`; RPCs derivam identidade com `auth.uid()`.
- Estados: `open`, `in_progress`, `waiting_requester`, `waiting_support`, `resolved`. Resposta do solicitante muda para `waiting_support` e limpa resolução; command Admin resolve/reabre com auditoria existente.
- Limites locais: 12 tickets por hora e 12 mensagens por 10 minutos por solicitante.

## Compatibilidade e eventos

- A migration é aditiva; não altera tickets ou mensagens legadas.
- As notificações de criação/atualização de ticket existentes permanecem. E-mail é notificação futura; o ticket autenticado é a fonte canônica.
- As migrations Fase 1/2 e a complementação `20260821224500` foram aplicadas
  em HML em 2026-08-21, sem produção. A qualificação autenticada comprovou
  abertura, resposta Admin, visualização bidirecional, nota interna isolada,
  resolução e reabertura. Ver
  `docs/homologation/phase-2.5-support-qualification.md`.

## Validação executada

- `npx supabase db reset`: migration aplicada somente no banco local.
- pgTAP focal de mensagens estruturadas + suporte: 36 testes passaram.
- pgTAP/RLS completo: 70 arquivos, 1.520 testes passaram.
- Vitest focal: 5 arquivos, 16 testes passaram.
- `npm run typecheck`, `npm run lint` e `npm run build`: passaram.
- `supabase db lint`: executado; somente avisos legados fora do domínio de suporte.
- HML: BrowserContexts de paciente, terapeuta e Admin passaram; o E2E de
  suporte atingiu `open → waiting_requester → waiting_support → resolved →
waiting_support` no backend. O Admin vê a resposta do terapeuta, e uma nota
  interna não aparece na API/tela do solicitante. A rota HML de mensagens
  participantes rejeitou `body` arbitrário com `422` antes de persistir.

## Próxima fase

A Fase 3 pode construir a Inbox administrativa, notas internas e operação de atribuição/prioridade sobre este contrato, sem abrir um caminho de texto livre entre participantes.
