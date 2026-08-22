# Wave 5 — Qualificação final e preparação de release

Data: 2026-08-22
Branch: `dev-antonio`
Produção: não alterada
Status: **LOCAL PASS — HML pendente de promoção coordenada**

## Escopo

Esta wave fecha a revisão das Waves 1–4. Não adiciona um novo canal de
comunicação nem muda o domínio de Stripe, Zoom ou booking. O objetivo foi
qualificar operação, segurança, compatibilidade, conteúdo de interface e a
sequência local de migrations antes da promoção para HML.

## Revisão de código e segurança

- `messages` continua aceitando somente templates resolvidos no servidor.
- `body`, `message`, `description` e `html` continuam rejeitados em
  `/api/messages/send-template`.
- `support_ticket_messages` permanece separado de `messages`.
- Notas internas permanecem fora das queries e DTOs do requester.
- APIs administrativas continuam exigindo sessão Admin e permissões
  `admin.support.read`/`admin.support.manage`.
- Autoria, requester e identidade privada são derivados da sessão ou de RPCs
  protegidas; não são escolhidos livremente pelo browser.
- A identidade privada do terapeuta permanece isolada por RLS e não entra em
  projeções públicas.
- Vídeos públicos continuam limitados a YouTube/Vimeo allowlisted ou mídia
  carregada pelo fluxo aprovado.
- Idempotência de tickets, respostas, operações administrativas e mensagens
  estruturadas permanece coberta pelos contratos existentes.

Resultado: **PARTICIPANT FREE TEXT BYPASS = BLOCKED** no contrato local.

## Revisão de linguagem

Foram removidos três vazamentos de linguagem técnica no frontend:

- catálogo público não menciona mais `migration/view` ou o ambiente;
- financeiro não exibe mais a versão técnica de metodologia (`tes-...`);
- erro do Match Admin usa “Código de atendimento” em vez de “Request ID”.

Os identificadores continuam disponíveis apenas em logs, testes e referências
operacionais apropriadas. Fallbacks explicitamente demonstrativos continuam
identificados quando ativos, conforme a regra de honestidade do produto.

## Compatibilidade e migrations

`npx supabase db reset` aplicou integralmente a sequência local até:

- `20260821210644_harden_structured_participant_messaging.sql`;
- `20260821213315_therapist_support_ticket_threads.sql`;
- `20260821224500_admin_support_thread_read.sql`;
- `20260821233000_admin_support_inbox_operations.sql`;
- `20260822010000_structured_participant_messages_v2.sql`;
- `20260822014500_unlimited_therapist_services.sql`;
- `20260822020000_limit_therapist_service_description.sql`;
- `20260822153000_wave2_match_themes_and_metrics_periods.sql`;
- `20260822170000_wave4_profile_moderation.sql`.

Não houve alteração destrutiva nem aplicação remota nesta execução.

## Validação executada

- `npm run typecheck` — PASS.
- `npm run lint` — PASS; políticas visual e online-only sem violações.
- `npm run test` — PASS: 151 arquivos, 593 testes.
- `npm run test:deno` — PASS: 161 testes.
- `npx supabase db reset` — PASS.
- `npx supabase test db` — PASS: 74 arquivos, 1.604 testes.
- `npx supabase db lint` — processo PASS, com erros/avisos históricos da
  extensão pgTAP e warnings legados de funções fora deste domínio; nenhuma
  ocorrência nova da migration da Wave 4 foi identificada.
- `npm run build` — PASS: 111 páginas geradas.
- `npx prettier --check` nos arquivos corrigidos — PASS.
- `git diff --check` — PASS.

## HML e PR

A qualificação HML anterior de Mensagens/Suporte continua registrada em
`docs/support/phase-5-operations-qa-report.md`. Esta execução ainda não pode
repetir o cenário remoto incluindo a Wave 4: as variáveis QA HML não estão
disponíveis nesta sessão e o host GitHub não respondeu por DNS. Portanto, não
é correto declarar HML PASS para a migration de moderação ainda não promovida.

O próximo passo seguro é publicar a branch `dev-antonio`, abrir PR para
`homolog`, aplicar migrations e runtime juntos no HML e executar:

1. smoke de configurações, identidade privada e publicação moderada;
2. BrowserContexts independentes de terapeuta, paciente e Admin;
3. regressão de suporte e mensagens estruturadas;
4. inspeção responsiva e de acessibilidade;
5. confirmação pós-migration do histórico remoto.

## Pendências reais

- promoção coordenada para HML e smoke remoto da Wave 4;
- abertura/atualização efetiva do PR depende de conectividade GitHub;
- auditoria automatizada axe e teclado virtual real continuam fora do tooling
  local disponível;
- `supabase db lint` continua reportando problemas históricos da extensão
  pgTAP, sem relação causal identificada com esta wave.

## Impacto documental

Documentação atualizada: este relatório e os textos técnicos corrigidos no
frontend. O relatório histórico de Fase 5 permanece como evidência da
qualificação HML anterior de Mensagens/Suporte; esta nota é a autoridade para
o fechamento local da Wave 5 e para a promoção da Wave 4.

> Entre terapeuta e paciente, o TES controla a linguagem. Entre usuário e TES,
> o TES controla o acesso — não a conversa.
