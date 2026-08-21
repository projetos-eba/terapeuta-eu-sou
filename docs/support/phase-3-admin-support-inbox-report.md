# Relatório — Fase 3: Admin Support Inbox

Data: 2026-08-21
Status: implementação local — qualificação HML pendente

## Decisão de UX

Foi escolhido **lista operacional + detalhe dedicado**, e não split view. O
Admin já possui rota de detalhe com thread pública, nota interna e histórico;
manter a lista em `/admin/suporte` preserva a leitura no tablet/mobile e evita
duplicar a conversa em uma segunda superfície.

## Implementado

- `admin_get_support_inbox_v1(jsonb)`: leitura Admin-only paginada, sem N+1,
  com filtros por status, prioridade, categoria, persona e atribuição; busca
  autorizada e ordenação de trabalho pendente.
- `support_tickets.assigned_admin_id`, índices para fila/atribuição e RPCs
  Admin-only de metadado e mutação de triagem.
- Ações allowlisted: atribuir a si, remover atribuição, prioridade baixa/
  normal/alta/urgente, iniciar atendimento, resolver e reabrir.
- Todas as mutações de Inbox produzem `admin_audit_events`. O command legado
  de resolver/reabrir é compatível, mas encaminhado à mesma state machine.
- `/admin/suporte` deixou de usar a central genérica: apresenta Inbox com
  busca, filtros persistidos em query string, paginação, empty state distinto
  para filtro e destaque moderado de `waiting_support`.
- O detalhe preserva o painel de conversa já entregue na Fase 2 e move a
  thread acima do contexto. A coluna lateral passa a reunir triagem,
  responsável, prioridade, contato Admin-only e, quando existe, resumo seguro
  da sessão relacionada.

## Segurança

- As RPCs de Inbox e management exigem perfil Admin; o browser não informa
  ator, responsável, requester ou visibilidade.
- `assigned_admin_id`, e-mail e contexto de booking são servidos somente na
  fronteira administrativa. Requesters seguem recebendo apenas tickets próprios
  e thread `requester`.
- Nota interna permanece isolada por RLS e DTO; não há mudança em suas policies
  de requester.
- `messages` não foi alterada. O gate de texto livre entre participante deve
  ser repetido na qualificação HML.

## Dados e compatibilidade

Migration: `20260821233000_admin_support_inbox_operations.sql`.

É aditiva: não remove tickets, não faz backfill destrutivo e não altera a
thread de suporte. `waiting_on` não foi criado por ser derivável de `status`.
Tickets legados seguem com a descrição conceitual oferecida pela Fase 2.

## Validações locais registradas

- `npm run typecheck`, `npm run lint` e `npm run build`: PASS.
- Vitest focal: 23 testes PASS (query de Inbox, estados de UI, rota de gestão,
  detalhe Admin e command legado).
- pgTAP focal: 59 testes PASS em `068`, `069` e `070`; cobre participant
  messaging, thread, grants, isolamento, atribuição, prioridade, lifecycle e
  auditoria.
- `npx supabase db reset`: PASS, incluindo a migration Fase 3.
- `npx supabase db lint`: sem finding novo da Fase 3; permanecem avisos legados
  fora do domínio de suporte.
- A suíte pgTAP integral chegou a 49 arquivos verdes e depois falhou em testes
  preexistentes a partir de `050_admin_professional_publish.sql`: a extensão
  pgTAP deixa de estar disponível para arquivos seguintes. O focal da Fase 3 e
  a regressão de participant messaging passam em execução isolada.

## Qualificação HML necessária

Aplicar coordenadamente a migration Fase 3 após conferir Fases 1/2 e a
complementação `20260821224500`. Em BrowserContexts independentes: terapeuta
deixa ticket em `waiting_support`; Admin localiza pela Inbox, filtra, atribui a
si, prioriza, cria nota interna e responde; terapeuta confirma resposta sem ver
nota; Admin confirma retorno a `waiting_support` e resolve. Repetir desktop,
tablet, mobile e o bypass de texto livre participante.

## Documentação

Documentação atualizada. A rota canônica permanece `/admin/suporte`; não houve
nova rota pública nem alteração de Stripe, Zoom ou e-mail.
