versão: 2026-08-22
fonte: project.md — MVP Transacional TES consolidado + docs/agent-work
próxima revisão: ao alterar stack, perfis, planos ou integrações

> **NUNCA:**
>
> - Inventar stack, rota, componente, integração, token, regra de negócio ou estrutura do Figma.
> - Alterar código sem consultar as fontes relevantes listadas neste arquivo.
> - Criar componente equivalente a um já existente em `src/components/`.
> - Refatorar fora do escopo da solicitação recebida.
> - Expor secrets, credenciais ou valores de `.env` em qualquer output.
> - Exibir informações, mensagens ou termos de desenvolvimento no front-end,
>   incluindo nomes técnicos de tabela, read model, stack, ambiente, debug,
>   mock, seed, TODO ou erro interno.
> - Afirmar que validação ocorreu sem tê-la executado de fato.
> - Remover rota, componente ou migration sem plano de transição aprovado.
> - Prometer cura, diagnóstico ou resultado garantido em qualquer copy ou comentário de código.
> - Ignorar divergência entre Figma, código, docs e sitemap — registrar sempre.

# AGENTS.md — Terapeuta Eu Sou

Este arquivo orienta o trabalho do Codex neste repositório. Ele deve ser curto, operacional e complementar às fontes principais do projeto, sem repetir o conteúdo completo da documentação.
Raiz real do projeto: `/Users/antoniofelipe/Projeto_Terapeuta_Eu_Sou`.

## 1. Papel do Codex

O Codex atua como agente de desenvolvimento, manutenção, refatoração, controle de qualidade e auditoria de consistência do Terapeuta Eu Sou.
Toda alteração deve respeitar:

- a solicitação atual do usuário;
- o Figma do projeto;
- a documentação central;
- o Design System;
- o sitemap e as rotas canônicas;
- os tokens TES;
- o código existente;
- as regras de segurança e rastreabilidade deste arquivo.
  O produto deve manter uma experiência clara, acolhedora, premium, humana e responsável, sem promessa de cura, diagnóstico ou resultado garantido.

## 2. Ordem de leitura obrigatória

Antes de alterar arquivos, ler somente o necessário para a tarefa, nesta ordem:

1. `AGENTS.md`.
2. Skill e documentação de produto/domínio aplicáveis à página ou feature.
3. `docs/product/sitemap.md`, `docs/product/routes-map.md` e
   `docs/product/glossary.md`.
4. `docs/design-system/experience-principles.md`,
   `docs/design-system/density.md` e
   `docs/design-system/anti-patterns.md`, quando a tarefa envolver UI.
5. `docs/design-system/design-system.md`,
   `docs/design-system/composition-patterns.md` e
   `docs/design-system/interaction-patterns.md`, quando a tarefa envolver UI ou
   componentes.
6. Figma atualizado, quando a tarefa envolver UI, fluxo, navegação, visual ou
   componentes.
7. `README.md`.
8. Arquivos diretamente afetados pela tarefa.
   Consultar documentos adicionais somente quando necessário e solicitado:

- `docs/design-system/tokens.md`: tokens, design tokens.
- `docs/product/product.md`: entender sobre o produto.
- `docs/product/page-inventory.md`: conteúdo, estados e ações por página.
- `docs/design-system/component-inventory.md`: componentes planejados e prioridades.
- `docs/design-system/COMPONENT_ARCHITECTURE.md`: criação ou alteração de componentes.
- `docs/design-system/COMPONENT_USAGE_GUIDELINES.md`: uso, copy e acessibilidade de componentes.
- `docs/design-system/FIGMA_STORYBOOK_SYNC_MAP.md`: sincronização Figma, código e Storybook.
- `docs/design-system/DESIGN_SYSTEM_FINAL_HANDOFF.md`: histórico do Design System e pendências.
- `docs/design-system/qa-checklist.md`: QA detalhado.
- `docs/design-system/visual-quality-score.md`: rubrica e eliminatórios de UI.
- `docs/design-system/visual-qa.md`: evidência visual em desktop, tablet e mobile.
- `docs/design-system/implementation-notes.md`: arquitetura planejada, setup, permissões e variáveis.
- `skills/recreate-figma-pages/*`: recriação de telas rasterizadas do Figma.
  Não alterar código, tokens, rotas ou documentação sem consultar as fontes relevantes.

## 3. Fontes de verdade

Quando houver conflito, usar esta prioridade:

1. Solicitação atual do usuário.
2. `AGENTS.md`.
3. Produto/domínio: ADRs, skill aplicável, `docs/product/product.md`, sitemap,
   routes map e glossary.
4. `docs/design-system/experience-principles.md` e regras de densidade.
5. `docs/design-system/design-system.md`, composition/interaction patterns e
   tokens TES.
6. Figma atualizado do arquivo `Projeto Terapeuta Eu Sou Atualizado`.
7. Código existente, com `src/lib/routes.ts` e `src/lib/permissions.ts` como
   autoridades executáveis de seus respectivos contratos.
8. Padrões inferidos por recorrência documentada.
   Regras de conflito:

- Registrar a inconsistência explicitamente.
- Explicar impacto e risco.
- Não assumir decisões silenciosamente.
- Não inventar informações.
- Quando algo não puder ser confirmado, escrever exatamente: `Não identificado nos arquivos analisados.`

## 4. Figma

Arquivo principal:

- Nome: `Projeto Terapeuta Eu Sou Atualizado`.
- File key: `OSXJi8tknHHCj82MTY2NbG`.
- URL prioritária: `https://www.figma.com/design/OSXJi8tknHHCj82MTY2NbG/Projeto-Terapeuta-Eu-Sou-Atualizado?node-id=12272-2`.
  Páginas essenciais:
- `↳ Jornadas dos Usuários`, node `12272:2`, frame principal `12280:2`: navegação, fluxos e permissões.
- `↳ Design Telas`, node `5999:10563`: telas por perfil e referência visual.
- `ícones`, node `12450-506`: componentes de ícone antes de criar qualquer placeholder.
- `↳ Sitemap`, node `12259:2`: estrutura visual de navegação.
- `↳ Design System`, node `12304-2`: foundations, component library, product patterns e `Design System / Phase 2 Expansion`.
  Status de acesso registrado:
- Acessado com sucesso via MCP para os nodes `12272:2`, `5999:10563`,
  `12259:2`, `12304:2` e `13366:5342`.
- A página `ícones` existe como fonte essencial; seu node `12450:506` deve ser
  consultado antes de criar ou substituir iconografia.
  Ao trabalhar com Figma:
- Usar `↳ Jornadas dos Usuários` para fluxo e permissão.
- Usar `↳ Design Telas` para comparação visual.
- Usar `↳ Design System` para componentes, estilos e tokens.
- Usar `ícones` antes de desenhar ícones locais.
- Registrar node IDs relevantes no resumo final.
  Se o Figma não estiver acessível, declarar o bloqueio e continuar apenas com fontes locais.

## Perfis e planos

| Perfil                 | Área canônica  | Plano        | Enum técnico   | Alias temporário atual |
| ---------------------- | -------------- | ------------ | -------------- | ---------------------- |
| Paciente               | `/app`         | —            | —              | —                      |
| Terapeuta Free         | `/terapeuta/*` | Free         | `free`         | `/basico/*`            |
| Terapeuta Premium      | `/terapeuta/*` | Premium      | `premium`      | `/pro/*`               |
| Terapeuta Premium Plus | `/terapeuta/*` | Premium Plus | `premium_plus` | `/plus/*`              |
| Admin                  | `/admin`       | —            | —              | —                      |

Regras:

- Em código, usar sempre os enums técnicos: `free`, `premium`, `premium_plus`.
- `/terapeuta/*` singular é o namespace aprovado para a área autenticada.
- `/terapeutas/*` plural permanece reservado ao catálogo e aos perfis públicos.
- `/basico/*`, `/pro/*` e `/plus/*` são redirects compatíveis implementados na
  Fase Agenda 1; não criar páginas novas nesses namespaces.
- `Básico`, `Pro` e `Plus` isolado são nomenclaturas comerciais legadas e não
  devem aparecer como nova copy de produto. `Pro` e `Plus` podem aparecer
  somente como identificadores técnicos legados de rota ou contexto histórico
  documentado.
- Nomes comerciais canônicos: Free, Premium e Premium Plus.
- `src/lib/routes.ts` é a fonte canônica das rotas executáveis.
- `next.config.mjs` contém exclusivamente os redirects dos namespaces legados.
- `src/lib/permissions.ts` é a fonte canônica de permissões e recursos por plano.

## Nomenclatura canônica

| Contexto                   | Termo canônico                       |
| -------------------------- | ------------------------------------ |
| Paciente — interface       | Encontro                             |
| Terapeuta — operação       | Sessão                               |
| Administração              | Sessão                               |
| Código e banco             | `session` ou `booking`               |
| Financeiro e jurídico      | Sessão contratada, quando necessário |
| Zoom para o paciente       | Entrar no encontro                   |
| Zoom técnico               | Video session                        |
| Planos comerciais          | Free, Premium e Premium Plus         |
| Área de serviços no shell  | Suas terapias                        |
| Domínio técnico de ofertas | `service` / `therapist_services`     |
| Formato de atendimento     | Online                               |

Regras:

- Não fazer substituição global de `sessão` por `encontro`: pagamentos, Zoom,
  banco, admin e operação profissional preservam significado técnico.
- A rota canônica do paciente é `/app/encontros`. Rotas antigas sob
  `/app/sessoes` são somente compatibilidade; não criar novas páginas de
  paciente nesse namespace.
- A rota técnica da área “Suas terapias” permanece `/terapeuta/servicos`.
- “Terapia” é modalidade canônica gerenciada pela plataforma; “Serviço” é a
  entidade técnica que representa a oferta individual do terapeuta.
- O TES opera exclusivamente online. Não criar UI, enum, rota, copy, seed,
  capability, schema ou integração que ofereça atendimento fora do fluxo online
  da plataforma. Campos legados como `delivery_format`, `online_only`,
  `accepts_online_sessions` e `modality` podem existir por compatibilidade, mas
  devem aceitar/expor somente `online`.

## Gate de impacto documental

Toda alteração de regra de negócio, rota, nomenclatura, estado, plano,
capability, fonte de dados, integração, componente compartilhado, fallback,
contrato de API, schema ou processo de QA deve incluir avaliação explícita de
impacto documental na entrega.

A entrega deve informar uma destas opções:

- `Documentação atualizada`;
- `Documentação revisada, sem alteração necessária`;
- `Documentação pendente`, acompanhada de motivo e risco.

Nenhuma tarefa pode ser considerada pronta sem essa declaração.

## Regra de fallback

- Fallback não pode esconder falha de produção.
- Dados demonstrativos precisam de ativação explícita server-side.
- Zero resultados não ativa fallback.
- 404 não ativa fallback.
- Erro de infraestrutura não pode virar sucesso aparente.
- Toda ativação de fallback deve ser visível no diagnóstico da entrega.
- Nenhuma entrega pode omitir que dados demonstrativos foram usados.

## Regra mínima de UI

- Cores funcionais devem usar tokens TES.
- Texto funcional deve ter no mínimo 14px.
- Metadados secundários podem usar no mínimo 11px em desktop e 10px em mobile.
  Nenhum texto pode ficar abaixo desses limites; quando houver variação
  responsiva, declarar explicitamente o tamanho mobile e o tamanho desktop.
- Botões de ícone precisam de nome acessível.
- Interfaces operacionais priorizam tarefa, estado, risco, prazo e valor antes
  de decoração.
- O front-end deve falar em linguagem de produto. Nunca exibir mensagens de
  desenvolvimento para usuários finais ou admins; detalhes técnicos pertencem
  a logs, documentação, testes ou painéis internos apropriados.

## 5. Implementação

Stack real identificada:

- Next.js 15 com App Router.
- React 18.
- TypeScript strict.
- Tailwind CSS.
- CSS Variables TES em `src/app/globals.css`.
- shadcn/ui planejado via `components.json`.
- `lucide-react`, `class-variance-authority`, `clsx` e `tailwind-merge`.
- Supabase Postgres (banco transacional) + Supabase Auth + RLS + Edge Functions.
- E-mails transacionais server-side via Hostinger Mail API, com provider isolado em `supabase/functions/_shared/email/`, tokens de auth/status em hash, polling seguro em `email_verification_status_tokens` e auditoria em `email_delivery_logs`.
- Sempre seguir as boas práticas de desenvolvimento de software, e arquitetura moderna.
- Stripe: pagamentos de sessão (Separate Charges and Transfers) e assinaturas (Stripe Billing) via Stripe Connect Express.
- Zoom: sessões online via Zoom Video SDK, com sessão lógica local em `video_sessions` criada apenas após pagamento confirmado pelo Stripe. JWT do Video SDK é gerado no backend sob demanda; não há provisionamento remoto prévio.
- Storybook: documentado, não instalado.
- Observabilidade: logs estruturados e sanitizados para read models do
  terapeuta e operações Zoom; ampliar correlação distribuída continua
  pendente.
  Regras:
- Usar `src/lib/routes.ts` para rotas.
- Usar `src/lib/permissions.ts` para permissões e recursos por plano.
- Usar `docs/design-system/tokens.md` como fonte única de tokens.
- Usar `docs/architecture/adr/ADR-009-online-only-delivery-policy.md` como
  decisão arquitetural para formato online-only.
- Todo conteúdo modal deve usar `TESDialog`, com portal sobre o shell, overlay,
  bloqueio de scroll, foco confinado, retorno de foco e fechamento por
  `Escape`; não criar `role="dialog"` diretamente em features.
- Títulos e textos primários devem usar `text-brand-deep`/`text-tesText-primary` com valor canônico `#14105A`; não usar hex hardcoded como `#261433` ou variações próximas.
- Não alterar tokens globais sem avaliar impacto visual.
- Procurar componente existente antes de criar outro.
- Não duplicar componentes equivalentes.
- Não refatorar fora do escopo sem justificativa.
- Não quebrar rotas canônicas.
- Não criar abstrações sem necessidade real.
- Manter alterações pequenas e rastreáveis.
  Estado real importante:
- Storybook documentado, não instalado.
- Primitives e patterns React TES existem parcialmente em `src/components/tes`
  e `src/components/app-page`; o catálogo Figma continua mais amplo que o código.
- `src/lib/routes.ts` e `src/lib/permissions.ts` existem como fontes canônicas de rotas e permissões.
- `src/components/app-page` define o grid compartilhado dos shells
  autenticados (`AppPageContainer`, `AppPageHeader`, `AppPageGrid`,
  `AppPageMain`, `AppPageAside`, `AppPageSection`, `AppPageActions` e
  `AppStickySaveBar`). Páginas novas do shell devem reutilizar esse contrato
  antes de criar containers próprios.
- `supabase/` possui migrations, seeds idempotentes, testes pgTAP e Edge
  Functions para autenticação, e-mail, Match, Stripe e Zoom.
- Hostinger Mail API: contrato confirmado em 2026-07-24. `GET https://api.mail.hostinger.com/api/v1/me` lista mailboxes; envio usa `POST https://api.mail.hostinger.com/api/v1/mailboxes/{mailboxResourceId}/send`, bearer token, payload `to: string[]`, `display_name`, `subject`, `text`, `html`, e sucesso `204` sem corpo.
- `CONFIRMED_AUTOMATICALLY_EMAIL` e secrets de e-mail pertencem somente a Supabase Edge Functions. Ausente/vazio equivale a `false`; aceita apenas `true` ou `false`; valor inválido deve falhar fechado e nunca ativar bypass. Quando `true`, cadastro confirma Auth via Admin API, não envia e-mail, não cria token e redireciona para login com `verified=1&automatic=1`.
- Stripe Billing, Checkout de sessões, Promotion Codes, Connect Accounts v2,
  ledger e lotes de repasse concluíram o Gate F0 de hardening. O Checkout usa
  os valores efetivos da Stripe após desconto para atualizar `session_payments`,
  comissão, valor do terapeuta e ledger; o subtotal original permanece em
  `session_payments.metadata.stripe_checkout`. A homologação E2E externa no
  Stripe test mode continua obrigatória antes de produção.
  Promotion Codes são digitados em campo TES fora do Embedded Checkout, com
  resolução dinâmica na Stripe, `tes_checkout_scope=session|subscription`,
  Products explícitos para assinaturas, substituição idempotente do Checkout e
  proteção contra eventos de tentativas superseded. Regras e operação ficam em
  `docs/payments/promotion-codes.md` e `skills/stripe-promotions`.
- Planos do terapeuta: `/terapeuta/plano` é a central de upgrades e lê catálogo
  e preços ativos de `billing_plans`/`billing_plan_prices`;
  `/terapeuta/configuracoes#plano-assinatura` concentra downgrade agendado,
  cancelamento ao fim do período e reversão. O plano efetivo continua vindo de
  `therapist_profiles.plan`, sincronizado pelo billing; não desbloquear recurso
  por retorno do navegador nem remover benefício antes de `current_period_end`.
- Agenda A2 implementada com snapshots imutáveis em `bookings`,
  `booking_holds` com TTL e idempotência, intervalo ocupado indexável,
  exclusão GiST por terapeuta, locks transacionais, transições auditadas e
  reagendamento versionado. RPCs de escrita são `service_role` only e devem ser
  orquestrados por Edge Functions autenticadas. A5 concluiu o slot engine
  autoritativo e o calendário privado; o checkout integrado pertence a A6.
- Zoom: arquitetura Video SDK implementada com `video_sessions`,
  `video_session_participations`, `zoom_video_webhook_events`, Edge Function
  `zoom-video-session-access`, webhook `zoom-webhook`, rota
  `/api/zoom/video-session-access`, páginas `/ajuda/zoom`, `/ajuda`, `/termos`
  e `/privacidade`, docs em `docs/zoom/` e skill `skills/zoom-integration`.
  Pagamento canônico segue em `session_payments`; Zoom não confirma pagamento,
  repasse ou realização clínica. Antes de produção, revalidar no ambiente alvo,
  configurar webhooks Video SDK reais via ngrok ou endpoint de homologação,
  seguir `docs/zoom/real-homologation-runbook.md`, revisar retenção e completar
  homologação externa sem expor secrets. O harness real usa
  `.tmp/zoom-real-homologation.json` para metadados temporários sem secrets e
  cria booking, usuários e pagamento paid em runtime; não exigir UUID, e-mail ou
  senha de fixture em variável de ambiente. O acesso é host-first: paciente só
  recebe JWT após webhook confiável de `session.user_joined` do terapeuta.
  `ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES` é obrigatório no runtime real; o
  limite duro fica em `video_sessions.hard_ends_at`. Encerramentos por timeout,
  ausência do terapeuta e reconciliação usam `video_session_control_jobs` e a
  Edge Function `zoom-video-session-maintenance`.
  A homologação local completa deve usar `npm run homologation:zoom:local`,
  que orquestra gates de Supabase local, Edge Functions, Stripe CLI, Next,
  webhooks e Zoom real. Sessão real de Zoom só pode avançar após evidência de
  pagamento de sessão por Stripe Checkout test + webhook assinado, com
  `session_payments.financial_status = paid` e `video_sessions` criada pelo
  fluxo canônico. Fixture com pagamento direto fica restrita a diagnóstico
  técnico isolado via flag explícita e não conclui homologação transacional.
  O comando real exige confirmação manual momentânea por flags antes de abrir
  uma única sessão curta, usa Playwright visível com contexts separados para
  terapeuta e paciente, e a emissão de JWT passa por rate limit distribuído no
  Supabase.
- Videochamada e feedback: a sala visual abre em T-15, o feedback de qualidade
  exige joins confiáveis de paciente e terapeuta, e confirmações bilaterais
  independentes usam a política ativa de 7 dias + 1 dia de segurança. A tabela
  `session_participant_confirmations` e os RPCs de confirmação permanecem
  somente no backend; Admin lê presença, prazos, divergências e bloqueios sem
  editar respostas ou acionar efeitos financeiros diretamente.
- Meu Perfil M1/M2: `/terapeuta/perfil` usa a fonte canônica
  `therapist_profiles` como tela preview-first da versão publicada;
  `/terapeuta/perfil/editar` concentra rascunhos em
  `therapist_profile_content_versions`, publicação pelo terapeuta via Edge
  Function `therapist-profile-command` e RPCs `*_therapist_profile*_v1`. Não
  criar tabela paralela de perfil para o shell. Documentos privados pertencem a
  `therapist_private_documents` e ao bucket `therapist-private-documents`;
  nunca expor esses dados em views ou DTOs públicos. A experiência M2 usa upload
  público via `/api/therapist/profile/media`, grid `AppPage*` e dados derivados
  somente leitura. Publicação pode levar 2 a 3 horas para refletir em todas as
  superfícies públicas.
  A identidade pública oferece quatro temas Free (`serene`, `natural`, `warm`
  e `essential`) e quinze temas Premium/Premium Plus, além de quatro
  ilustrações TES opcionais, no fluxo de rascunho/publicação. Os temas Premium
  permanecem visíveis para Free, mas não podem ser aplicados. Após downgrade,
  o próximo salvamento normaliza um tema Premium para `serene` com aviso na
  edição. A biblioteca visual aprovada está no Figma
  `Z42SR0Pi0m307SmcAkDqHb`, nó `14869:2`; o Figma atual da edição ainda não
  contém essa biblioteca. Slug é uma mutação imediata separada: Free usa
  `free_public_slug` numérico estável de sete dígitos; Premium e Premium Plus
  usam a capability `custom_profile_slug`. Normalização, reservas, histórico,
  idempotência, downgrade e concorrência são autoridade do PostgreSQL.
- Métricas MTR-1 a MTR-5 e MTR-7 CSV: `/terapeuta/insights` usa
  `get_therapist_metrics_overview_v1` com períodos de 30/90 dias locais
  completos, além dos read models privados
  `get_therapist_session_metrics_v1` e
  `get_therapist_interest_metrics_v1`. Interesse é Premium Plus e métricas
  protegidas exigem amostra 10. Eventos objetivos ficam em
  `therapist_metric_events`, projeções em
  `therapist_metric_daily_aggregates` e favoritos continuam derivados de
  `favorite_therapists`. CSV agregado é exportado por adaptador autenticado.
  A telemetria pública nasce desativada em
  `therapist_metrics_runtime_config` até validação formal de base legal, aviso
  e retenção. Não ativar por variável pública nem simular descoberta,
  ocupação, Aura ou amostra insuficiente. MTR-6/Aura permanece pendente.
- A composição visual da visão geral de Métricas foi alinhada ao frame
  `13366:3628`: hero editorial, faixa de período/CSV separada, seis KPIs,
  funil, agenda, ranking, comparativo, roscas e heatmaps. Os componentes
  visuais continuam locais à feature e usam somente os contratos agregados
  existentes; descoberta desativada e ocupação em formação permanecem estados
  honestos. Ausência de base mantém a estrutura gráfica em referência neutra
  (linha-base, funil, grade, rosca, ranking e comparativo) com copy explícita;
  só um zero devolvido pelo contrato pode ser apresentado como dado real.
- Financeiro do terapeuta F0/F1/F2/F3: `/terapeuta/financeiro` possui somente as
  abas Resumo, Recebimentos, Repasses e Conta de recebimento. A fonte canônica
  continua `session_payments`; o shell consome read models privados
  `get_private_therapist_financial_overview_v1`,
  `get_private_therapist_receipts_v1`,
  `get_private_therapist_payouts_v1` e
  `get_private_therapist_connect_account_v1`. F2 adiciona
  `get_private_therapist_financial_metrics_v1` para métricas intermediárias no
  Resumo, usando `advanced_metrics` para Premium e Premium Plus. Operação
  financeira essencial é liberada para Free, Premium e Premium Plus. F3 adiciona
  `get_private_therapist_advanced_financial_dashboard_v1` e contratos
  segmentados para Premium Plus via `advanced_financials`, separando realizado,
  contratado e estimado; projeções nunca alteram ledger, saldo ou repasse.
  Connect usa
  fluxo hospedado da Stripe, sem formulário bancário próprio e sem confirmar
  onboarding por redirect. Benchmark financeiro é anonimizado e suprimido sem
  amostra mínima; Insight TES financeiro é rule-based, não IA generativa.
  A automação semanal está versionada e desativada até homologação HML: terça
  02:00 America/Sao_Paulo, confirmação em 7 dias, segurança de 1 dia e backlog
  até o cutoff. ADR-018 define Transfer semanal controlado pelo TES e Payout
  automático diário criado pela Stripe para contas BR. `destination_payment` e
  Balance Transactions atribuem cada Transfer a um Payout; lotes e Payouts
  formam a relação muitos-para-muitos, sem metadata TES no Payout. Transfer liquida a obrigação no ledger;
  somente cobertura reconciliada em Payout `paid` conclui o banco. A política
  v5 e o cron permanecem inativos até preflight e prova externa. Runbook em
  `docs/payments/weekly-payouts.md`.
- A apresentação visual de Aura e Financeiro foi alinhada aos nós Figma
  `13366:1634` e `14340:6283`, mantendo as anatomias específicas de cada
  domínio. Aura usa hero editorial, personagem local, quatro KPIs, leituras
  contextuais e recomendações determinísticas. Financeiro usa quatro abas,
  cards, evolução, roscas e timeline de repasses; gráficos sem base continuam
  visíveis em referência neutra e nunca exibem valores inventados. No mobile,
  o Financeiro usa divulgação progressiva apenas para análises secundárias e
  composição avançada; nenhum dado primário é removido. Aura tem skeleton
  dedicado e controles de período com toque mínimo de 44px.

## 6. QA e definição de pronto

Uma tarefa só pode ser considerada pronta quando:

- respeita Figma e fontes de verdade aplicáveis;
- respeita `src/lib/routes.ts` e `src/lib/permissions.ts`;
- usa tokens TES (`docs/design-system/tokens.md`);
- segue linguagem acolhedora e responsável — sem prometer cura, diagnóstico ou resultado;
- não expõe segredos;
- não salva dados individualizados do Match sem decisão LGPD registrada;
- valida pagamento por webhook Stripe (não apenas por redirecionamento);
- usa idempotência em operações Stripe;
- usa `session_payments` como fonte única de pagamentos de sessão;
- registra ledger para movimentações financeiras em `financial_ledger_entries`;
- cria repasses a partir de `payout_batches`, `payout_batch_therapists` e
  `payout_batch_items`;
- grava snapshot de preço e duração no momento da reserva;
- cria sessão lógica de vídeo apenas após pagamento confirmado via webhook;
- não persiste JWT, senha de sessão, URL secreta, áudio, vídeo, chat ou
  transcrição no fluxo Zoom Video SDK atual;
- protege dados por RLS conforme perfil;
- passa em `npm run typecheck`, `npm run lint` e `npm run build`;
- documenta limitações e riscos;
- lista arquivos alterados.
  Validações padrão:
- Conferir comandos disponíveis no `README.md` e em `package.json`.
- Rodar `npm run typecheck`, `npm run lint` e `npm run build` quando o ambiente permitir.
- Para UI, validar responsividade e comparar com Figma ou `Referencias/{perfil}` quando aplicável.
- Para docs, confirmar que não há referências quebradas nem duplicação desnecessária.
  Se uma validação não for executada, explicar o motivo.

## Gate de confirmação

Pausar e pedir decisão explícita antes de:

- alterar ou criar rota em `src/lib/routes.ts`;
- modificar schema de banco, migration ou policy RLS;
- remover ou renomear componente, hook ou integração existente;
- alterar arquitetura, providers ou layouts;
- adicionar nova dependência ao `package.json`;
- alterar comportamento de autenticação ou permissão;
- criar tabela nova em Supabase sem migration explícita.
  Para alterações documentais, de estilo ou de texto em componente isolado: executar e reportar no resultado.

## 7. Segurança

Nunca:

- commitar `.env`;
- commitar credenciais;
- commitar tokens de acesso;
- expor segredos em logs;
- incluir credenciais em diagnósticos ou outputs;
- copiar chaves privadas para documentação;
- registrar segredos em exemplos de código;
- assumir valores de ambiente sem confirmação.
  Regras específicas para Supabase:
- O app Next deve usar somente variáveis publicáveis com prefixo `NEXT_PUBLIC_`.
- Para Supabase no app Next, usar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Nunca usar `SUPABASE_SECRET_KEYS`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SERVICE_ROLE_KEY` ou `DATABASE_URL` no `.env.example`, `.env.local` ou `.env.production` do app Next.
- Secrets Supabase devem ficar em Supabase Edge Functions ou secrets remotos equivalentes.
  Ao encontrar risco de segurança, registrar o risco sem expor o segredo.

## 9. Atualização contínua

Atualizar este arquivo quando mudarem:

- fontes de verdade;
- stack;
- Design System;
- tokens;
- sitemap;
- rotas;
- estrutura de pastas;
- componentes base;
- permissões;
- scripts;
- integrações;
- autenticação;
- banco de dados;
- deploy;
- processo de QA.
  O Codex deve sugerir atualização do `AGENTS.md` quando detectar desatualização.

## 9.1 Skills locais por página

Toda página implementada ou refatorada deve ter uma skill local correspondente em `skills/`, com `SKILL.md` e, quando aplicável, `agents/openai.yaml`.

Regras:

- A skill deve registrar fontes obrigatórias, node(s) Figma, rotas, componentes, dados dinâmicos, fallback, checklist de QA, copy responsável e pendências conhecidas da página.
- A skill deve ser atualizada junto com a página sempre que mudarem layout, fonte de dados, rota, componente crítico, regra de negócio ou documentação relacionada.
- Exceção: páginas de perfil de terapeuta não usam uma única skill por plano. Devem existir skills por função contemplando simultaneamente Básico, Premium e Premium Plus, para evitar divergência entre os três planos.

### Separação de autoridade visual e domínio

- `skills/tes-ui-experience` é autoridade global de experiência, hierarquia,
  densidade, composição, responsividade e crítica visual.
- `skills/tes-design-system` é autoridade global de tokens, primitives,
  patterns, componentes, variantes, estados e critérios de admissão.
- Skills de página/feature preservam domínio, estados, dados, segurança, copy
  específica e declaram densidade/patterns aplicáveis sem duplicar regras
  visuais universais.
- Refatorações benchmark e rollouts visuais devem seguir
  `docs/design-refactor/multi-agent-workflow.md`, obter `>= 85` no Visual
  Quality Score e não conter critério eliminatório.
- Rollout visual amplo permanece condicionado à Calibration definida em
  `docs/design-refactor/benchmark-plan.md`.

## 9.2 Banco, migrations e seeds

Toda alteração de schema, view, function, policy, índice, enum ou projeção pública do Supabase deve ter migration versionada em `supabase/migrations/`.

Regras:

- Seeds, mocks e dados de desenvolvimento devem ser idempotentes e versionados em `supabase/seed.sql` ou em arquivo de seed documentado.
- Nunca criar, ajustar ou popular banco de forma ad hoc sem deixar arquivo rastreável no repositório.
- Migrations devem expor apenas dados compatíveis com a superfície pública/autenticada necessária, sem campos internos ou sensíveis.
- Quando Docker/Supabase local impedir validação, registrar exatamente quais comandos falharam e qual validação ficou pendente.
- Cron local deve permanecer desativado por padrão: depois de iniciar, restaurar ou validar o Supabase local, conferir `cron.job` e garantir que nenhum job persistente esteja com `active = true`. A existência do contrato em migration não autoriza sua execução local.
- A única exceção é um cenário de teste de cron explicitamente identificado, com fixture isolada, janela limitada, comando de ativação e limpeza documentados; ao final, todos os jobs devem voltar a `active = false` e não pode haver execução pendente.
- Toda operação pesada de Docker, Supabase, build ou teste deve ser executada de forma serial, com snapshot de CPU e RAM antes, durante e depois. Sob pressão alta, pausar ou interromper preventivamente a próxima etapa e registrar a validação como inconclusiva quando necessário.

## 9.3 Operação multi-agent

Quando a solicitação pedir trabalho multi-agent, usar os agentes de projeto em
`.codex/agents/` e os contratos de `docs/agent-work/`.

Regras:

- `AGENTS.md` da raiz continua sendo a constituição global; cada agente lê
  também o `AGENTS.md` mais próximo dos arquivos em seu escopo.
- O Orchestrator coordena objetivo, dependências, owners, handoffs, integração e
  QA; não absorve implementação que pertença a um agente de domínio adequado.
- Cada tarefa de escrita tem owner único, reviewer, arquivos reservados e
  dependências registradas em `TASK_MATRIX.md` ou no canal de coordenação.
- Security & Supabase possui ownership final de migrations, RLS, grants e tipos
  gerados; o agente funcional entrega o contrato e revisa o comportamento.
- Arquivos de alto conflito listados em `DOMAIN_OWNERSHIP.md` exigem
  coordination note e handoff antes de edição concorrente.
- Trabalho paralelo de escrita usa branch/worktree isolada; não trabalhar em
  `main`, não fazer force push e não resetar worktree alheia.
- Toda integração exige handoff no formato de `HANDOFF_TEMPLATE.md`, revisão de
  domínio e o estado aplicável de `RELEASE_GATE.md`; implementação não equivale
  a `DONE`.
- Ferramentas seguem menor privilégio. Produção é read-only por padrão e toda
  escrita produtiva exige instrução humana explícita.

## 10. Formato de entrega

| Seção                     | Conteúdo esperado                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Resumo**                | O que foi feito e por quê                                                              |
| **Arquivos alterados**    | Lista completa                                                                         |
| **Validação**             | Como foi validado — Figma, lint, build ou leitura manual                               |
| **Comandos executados**   | Lista; registrar falha quando ocorrer                                                  |
| **Limitações/Pendências** | O que não foi possível verificar ou ficou pendente — nunca afirmar o que não aconteceu |
| **Riscos**                | Impactos, conflitos de fonte, e outras coisas mais                                     |
| **Próximos passos**       | Recomendações objetivas relacionadas à entrega                                         |

Skills planejadas para este projeto estão documentadas em `docs/` e no backlog técnico do `project.md` (seção 19).
