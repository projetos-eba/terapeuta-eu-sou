# Relatório — Fase 2: Suporte do Terapeuta

Data: 2026-08-21  
Status: implementação e validação local

## Estado inicial

`support_tickets` já tinha protocolo, idempotência por solicitante e contexto opcional de booking, mas a API/UI ainda resolvia texto por template e não existia thread. `messages` já estava endurecida pela Fase 1 e não foi reutilizada.

## Arquitetura implementada

- Migration `20260821213315_therapist_support_ticket_threads.sql` cria `support_ticket_messages`, índices, RLS e RPCs server-authoritative.
- A abertura migrou para categoria fechada, assunto e descrição plain text; requester, papel e contexto autorizado são resolvidos no banco.
- A descrição inicial é materializada como primeira mensagem pública. Tickets históricos sem mensagens expõem a descrição legada como primeira mensagem conceitual, sem backfill destrutivo.
- Respostas públicas do solicitante usam chave idempotente; Admin responde por endpoint mínimo e continua usando o command auditado existente para resolver/reabrir.

## Rotas e componentes

- `/terapeuta/mensagens`: seção separada **Suporte TES**, listagem, empty state e diálogo de novo chamado.
- `/terapeuta/mensagens/suporte/:ticketId`: protocolo, status, thread pública e composer plain text.
- `/api/support/tickets` e `/api/support/tickets/:ticketId`: listagem, criação, detalhe e resposta do terapeuta.
- `/api/admin/support/tickets/:ticketId/reply`: resposta pública com `admin.support.manage`.

## RLS e lifecycle

- Solicitante só lê ticket próprio e mensagens `requester`; nota `internal` não entra na policy nem no DTO/API do solicitante.
- INSERT/UPDATE/DELETE diretos em tickets e thread foram revogados para `authenticated`; RPCs derivam identidade com `auth.uid()`.
- Estados: `open`, `in_progress`, `waiting_requester`, `waiting_support`, `resolved`. Resposta do solicitante muda para `waiting_support` e limpa resolução; command Admin resolve/reabre com auditoria existente.
- Limites locais: 12 tickets por hora e 12 mensagens por 10 minutos por solicitante.

## Compatibilidade e eventos

- A migration é aditiva; não altera tickets ou mensagens legadas.
- As notificações de criação/atualização de ticket existentes permanecem. E-mail é notificação futura; o ticket autenticado é a fonte canônica.
- As migrations Fase 1/2 foram aplicadas em HML em 2026-08-21, sem produção.
  A qualificação autenticada comprovou abertura, resposta Admin, visualização
  pelo terapeuta e nova resposta do terapeuta. Ela permanece **PARTIAL**:
  o detalhe Admin ainda não apresenta `support_ticket_messages`, portanto não
  prova que Admin vê a resposta subsequente do solicitante. Ver
  `docs/homologation/phase-2.5-support-qualification.md`.

## Validação executada

- `npx supabase db reset`: migration aplicada somente no banco local.
- pgTAP focal de mensagens estruturadas + suporte: 36 testes passaram.
- pgTAP/RLS completo: 70 arquivos, 1.520 testes passaram.
- Vitest focal: 5 arquivos, 16 testes passaram.
- `npm run typecheck`, `npm run lint` e `npm run build`: passaram.
- `supabase db lint`: executado; somente avisos legados fora do domínio de suporte.
- HML: BrowserContexts de paciente, terapeuta e Admin passaram; o E2E de
  suporte atingiu `open → waiting_requester → waiting_support` no backend, mas
  falhou na asserção visual da thread Admin. A rota HML de mensagens
  participantes rejeitou `body` arbitrário com `422` antes de persistir.

## Próxima fase

A Fase 3 pode construir a Inbox administrativa, notas internas e operação de atribuição/prioridade sobre este contrato, sem abrir um caminho de texto livre entre participantes.
