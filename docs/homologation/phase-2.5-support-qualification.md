# Fase 2.5 — QA e Qualificação do Suporte

Data: 2026-08-21  
Ambiente: HML (`Terapeuta-Eu-Sou-Homolog`)  
Status: PARTIAL — fluxo requisitante concluído; thread administrativa incompleta

## Deploy de migrations

Preflight remoto confirmou exatamente duas migrations pendentes. Foram aplicadas em HML, sem seeds, roles, Vault ou produção:

1. `20260821210644_harden_structured_participant_messaging.sql`;
2. `20260821213315_therapist_support_ticket_threads.sql`.

A listagem remota posterior confirmou ambas registradas. O projeto de produção não é o projeto vinculado e não recebeu qualquer alteração.

## Escopo e segurança operacional

Esta qualificação foi executada somente em HML. Nenhuma migration foi aplicada
em produção e nenhum e-mail, pagamento ou sessão Zoom foi disparado. As
credenciais QA foram usadas apenas em processos efêmeros do navegador e não
foram gravadas em arquivos, screenshots compartilhados ou logs versionados.

## Smoke autenticado — PARTIAL

- BrowserContexts independentes para paciente, terapeuta e Admin: **PASS**
  (`tests/e2e/hml-multi-context-auth.spec.ts`, 1/1).
- Terapeuta em `/terapeuta/mensagens`: **PASS**. A Central expõe `Suporte TES`
  e a primeira execução observou o empty state.
- Novo chamado com categoria controlada, assunto e descrição plain text:
  **PASS**.
- Detalhe do chamado e protocolo: **PASS**.
- Admin abre o detalhe e envia resposta pública: **PASS**.
- Terapeuta recarrega o detalhe, visualiza a resposta da equipe e responde:
  **PASS**.
- Admin recarrega o detalhe e visualiza a nova resposta do terapeuta: **FAIL**.
  A página atual possui resumo, painel de resposta e auditoria, mas não renderiza
  `support_ticket_messages`; portanto não apresenta a thread ao Admin.

O cenário deixou tickets QA rastreáveis em HML por design; não foram removidos
para não perder a evidência da qualificação.

## Lifecycle no backend — PARTIAL

O smoke verificou via `GET /api/support/tickets/[ticketId]`, autenticado como o
solicitante, os seguintes estados persistidos e contagens de mensagens:

| Etapa                     | Estado              | Mensagens públicas |
| ------------------------- | ------------------- | ------------------ |
| Criação do terapeuta      | `open`              | 1                  |
| Resposta pública do Admin | `waiting_requester` | 2                  |
| Resposta do terapeuta     | `waiting_support`   | 3                  |

`resolved` e reabertura não foram qualificados nesta rodada: a evidência final
exigida — Admin visualizar a resposta do terapeuta — falhou antes de iniciar
uma transição adicional. Não marcar esses estados como aprovados.

## Isolamento e conteúdo — PARCIALMENTE COBERTO

- As mensagens da thread vistas pelo terapeuta foram públicas e renderizadas
  como texto, sem HTML.
- A RLS/isolamento, a invisibilidade de notas internas e o bloqueio de insert
  direto em `messages` continuam cobertos pelos pgTAP locais da Fase 1/2.
- A prova HML de terapeuta B contra ticket A e da invisibilidade de uma nota
  interna requer uma segunda persona terapeuta QA e uma nota interna criada por
  um endpoint/ação administrativa. Esses insumos não foram disponibilizados
  nesta execução.
- A rota HML `/api/messages/send-template` rejeitou uma tentativa autenticada
  de incluir `body` com `422`, antes de chegar à persistência:
  **`PARTICIPANT FREE TEXT BYPASS = BLOCKED` para o contrato HTTP**.
  A prova HML complementar de `INSERT` REST direto em `messages` requer uma
  conversa de fixture autorizada e token de banco efêmero; ela permanece
  pendente e não é substituída por este teste de rota.

## Responsividade e evidências

O Playwright registrou contexto acessível da falha no job de qualificação; não
foram publicadas capturas porque conteriam identidade QA. O smoke desktop
concluiu o fluxo do terapeuta até a resposta. As validações reais de tablet,
mobile, teclado, scroll longo e composer continuam pendentes até que a thread
Admin seja exibida e o cenário bidirecional possa encerrar.

## Gatilho de retomada

1. Na Fase 3, fazer o detalhe Admin consumir e exibir exclusivamente a thread
   autorizada de `support_ticket_messages`, distinguindo resposta pública de
   nota interna.
2. Reexecutar o E2E multi-context até a última asserção, incluindo
   `resolved`/reabertura no backend.
3. Disponibilizar uma segunda conta terapeuta QA para a prova HML de
   isolamento e executar a prova de nota interna sem serializá-la ao
   solicitante.
4. Executar os viewports desktop, tablet e mobile e registrar apenas capturas
   sanitizadas.

## Resultado da Fase 2.5

**PHASE 2.5 — PARTIAL**

HML possui schema compatível e a conversa funciona no sentido terapeuta →
Admin → terapeuta. A qualificação não pode aprovar o gate completo enquanto o
Admin não conseguir ver a mensagem subsequente do terapeuta na mesma thread.

Nenhum e-mail real, operação financeira, Zoom ou alteração de produção foi executada.
