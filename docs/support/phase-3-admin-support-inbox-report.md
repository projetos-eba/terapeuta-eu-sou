# Relatório — Fase 3: Admin Support Inbox

Data: 2026-08-21
Status: PASS — qualificação HML concluída

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

## Qualificação HML — PASS

O preflight remoto confirmou que HML já possui, em sequência, as migrations
`20260821210644`, `20260821213315`, `20260821224500` e
`20260821233000`. O runtime de homologação e o banco ficaram compatíveis; não
houve qualquer ação em produção.

O Playwright executou BrowserContexts independentes para terapeuta e Admin no
Chromium de HML. O cenário criou um ticket QA, confirmou `open` no backend e
validou a operação abaixo:

1. Admin encontra o ticket pela Inbox filtrada por status e busca, atribui a
   si, muda a prioridade para alta e inicia o atendimento (`in_progress`).
2. A resposta pública leva o ticket a `waiting_requester`; a resposta do
   terapeuta o devolve a `waiting_support`.
3. A Inbox filtrada por `waiting_support` e prioridade encontra o ticket;
   Admin cria uma nota interna e responde publicamente.
4. O terapeuta vê a resposta, mas não recebe a nota interna nem no DTO nem na
   tela. Admin resolve (`resolved`) e o terapeuta reabre explicitamente com
   nova resposta, retornando a `waiting_support`.

O cenário também conferiu a central e o detalhe em 1440px, 768px e 390px. Em
mobile, o composer recebeu foco, permaneceu acessível após scroll e não houve
overflow horizontal. Capturas persistentes com identidade QA não foram
publicadas; a evidência sanitizada é o resultado dos cenários Playwright e suas
traces efêmeras locais.

O gate de regressão de mensagens participantes enviou, de forma autenticada,
`body`, `message`, `description` e `html` para
`/api/messages/send-template`; os quatro payloads receberam `422` antes de
qualquer persistência:

**PARTICIPANT FREE TEXT BYPASS = BLOCKED**

Comandos HML executados:

- cenário multi-persona da Inbox: 1 PASS;
- regressão de conteúdo livre e responsividade: 2 PASS.

O projeto `msedge` do Playwright não foi executável nesta máquina porque o
navegador não está instalado. A qualificação foi realizada no Chromium, sem
mascarar essa limitação de tooling.

## Documentação

Documentação atualizada. A rota canônica permanece `/admin/suporte`; não houve
nova rota pública nem alteração de Stripe, Zoom ou e-mail.
