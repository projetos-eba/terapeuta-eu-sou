# Fase 4 — Mensagens Estruturadas V2

Data: 2026-08-21  
Status: implementação local concluída; QA HML depende de publicação coordenada.

## Escopo e inventário

Foram revisados os contratos de suporte/mensagens, ADR-016, relatórios das
Fases 1–3, `message-center.templates.ts`, queries da Central, a rota
`/api/messages/send-template`, a RPC V1, as tabelas `conversations`, `messages`
e `message_templates`, além dos testes Vitest e pgTAP existentes.

O domínio de suporte não foi alterado. A infraestrutura de participante continua
sem escrita REST autenticada e sem texto livre.

## Implementação

- Migration aditiva `20260822010000_structured_participant_messages_v2.sql`.
- Catálogo com 13 templates reais (5 paciente → terapeuta e 8 terapeuta →
  paciente), categorias, descrição de uso, contexto de booking e ações
  allowlisted.
- `message_templates.parameter_schema` aceita somente opções fechadas; o
  exemplo de atraso usa três janelas pré-definidas.
- `messages.metadata` persiste somente metadata resolvida pela RPC.
- RPCs `preview_structured_participant_message_v2` e
  `send_structured_participant_message_v2`; V1 permanece como wrapper.
- Preview e envio validam identidade, direção, conversa, booking, parâmetros e
  CTA no servidor. O banco monta a rota canônica para o papel do destinatário.
- A Central passou a seguir `Escolher mensagem → Revisar mensagem → Enviar`,
  com corpo imutável, destinatário, contexto e CTA. Nenhum textarea participa
  do fluxo de participante.
- A listagem mostra a mensagem final, contexto da sessão e CTA sanitizado.

## Contratos HTTP

`POST /api/messages/preview-template` e `POST /api/messages/send-template`
aceitam somente `actorRole`, `conversationId`, `bookingId` opcional,
`templateKey` e objeto de parâmetros string. Campos desconhecidos e conteúdo
(`body`, `message`, `description`, `html`, URL) falham com `422` antes de
consultar o Supabase.

## Segurança

- `auth.uid()` é a única identidade usada pela RPC.
- Direção do template é derivada do participante da conversa.
- Booking precisa relacionar exatamente paciente, terapeuta e conversa.
- Parâmetros e CTAs são allowlists do banco; o browser não envia corpo nem URL.
- Inserção/update direto por `authenticated` em `messages` continua revogado.
- Preview não persiste; envio grava texto/template/metadata resolvidos.
- `support_ticket_messages` não foi reutilizada e o domínio de suporte não foi
  alterado.

## Validação executada

- `npx supabase db reset` — PASS; migration aplicada localmente.
- `npx supabase test db --local supabase/tests/068_structured_participant_messaging_contract.sql supabase/tests/071_structured_participant_messages_v2.sql` — PASS, 38/38.
- `npx vitest run src/app/api/messages src/features/message-center` — PASS, 13/13.
- `npm run test` — PASS, 579/579.
- `npm run typecheck` — PASS.
- `npx eslint src/app/api/messages src/features/message-center` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `npx supabase db lint` — PASS com warnings preexistentes fora da migration V2.

Foi preparado `tests/e2e/hml-structured-messaging-v2.spec.ts` com dois
BrowserContexts independentes, cobertura bilateral, responsividade e o gate de
bypass. A suíte fica condicionada às variáveis QA HML e não foi executada porque
esta implementação ainda não foi publicada em HML.

QA HML/E2E bilateral e screenshots ainda exigem deploy coordenado da migration
e do runtime; nenhuma migration foi aplicada remotamente nesta etapa.

## Compatibilidade e pendências reais

- Registros legados sem `template_id` permanecem legíveis.
- A V1 continua compatível e delega para a V2; os seis templates originais
  também podem ser enviados em conversas legadas sem booking, enquanto CTAs só
  aparecem quando existe contexto de sessão autorizado.
- Não há editor/Admin de templates nesta fase.
- HML e E2E paciente ↔ terapeuta precisam ser executados após publicação
  autorizada; produção não foi alterada.

> Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES,
> o TES controla o acesso — não a conversa.
