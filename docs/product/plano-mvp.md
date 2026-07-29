# Plano MVP — Terapeuta Eu Sou

Atualizado em: 2026-07-25

Status: baseline histórico de execução, parcialmente superado pelo estado atual.

Escopo: MVP transacional com descoberta, Match determinístico, reserva, pagamento Stripe, sessão online, área do paciente, áreas de terapeuta por plano e Admin.

> Para decisões atuais de Stripe, rotas e Fase Agenda 1, prevalecem
> `docs/architecture/relatorio-25-07-2026.md`,
> `docs/payments/architecture.md` e `docs/product/integration-map.md`. Tabelas
> de “não identificado” e árvores `/basico`, `/pro` e `/plus` abaixo registram
> a auditoria de 2026-07-13, não o estado operacional de 2026-07-25.

## 1. Parecer executivo

O MVP é viável, mas a execução precisa seguir uma ordem rígida para evitar fontes paralelas de rotas, permissões, pagamentos e dados sensíveis.

Sequência executiva adotada:

```txt
Fase 0 Fundação visual e shell
-> Fase 1 Descoberta pública, catálogo e Match
-> Fase 2 Reserva, Stripe, ledger e Zoom
-> Fase 3 Área do paciente
-> Fase 4 Área terapeuta Básico
-> Fase 5 Áreas Premium e Premium Plus
-> Fase 6 Admin, repasses, matching avançado e operação
```

Decisão central deste plano: não iniciar funcionalidades transacionais reais antes de fechar as bases de RLS, pagamento por webhook, idempotência, snapshot de reserva, `session_payments`, ledger e Zoom pós-pagamento.

## 2. Fontes auditadas

Fontes locais lidas e usadas:

- `AGENTS.md`.
- `docs/architecture/project.md`.
- `docs/product/sitemap.md`.
- `docs/product/routes-map.md`.
- `docs/product/product.md`.
- `docs/product/mvp.md`.
- `docs/architecture/supabase-mvp-domain.md`.
- `README.md`.
- `src/lib/routes.ts`.
- `src/lib/permissions.ts`.
- `src/domain/tes/permissions.ts`.
- `supabase/migrations/20260708090000_initial_mvp_domain.sql`.
- `supabase/functions/match-therapies/index.ts`.
- `supabase/seed.sql`.
- `src/app/`.
- `src/components/`.
- `package.json`.

Figma acessado via MCP metadata em 2026-07-13:

| Página / node                             | Status                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `↳ Jornadas dos Usuários`, node `12272:2` | Acessado. Confirma fluxos Público, Paciente, Terapeuta e Admin.     |
| `↳ Design Telas`, node `5999:10563`       | Acessado. Confirma telas por perfil e divergências visuais legadas. |
| `↳ Sitemap`, node `12259:2`               | Acessado. Confirma estrutura visual de navegação.                   |
| `↳ Design System`, node `12304:2`         | Acessado. Confirma foundations, tokens e componentes planejados.    |
| `ícones`, node `12450:506`                | Acessado. Confirma biblioteca lucide/ícones no Figma.               |

Regra de conflito aplicada: quando Figma, docs e código divergem, este plano usa `AGENTS.md`, `src/lib/routes.ts`, `src/lib/permissions.ts`, `docs/product/sitemap.md` e `docs/product/routes-map.md` como fontes canônicas operacionais.

## 3. Definição do MVP

O MVP é uma plataforma transacional de descoberta, Match, agendamento e contratação de terapias online.

Para pacientes, o MVP permite:

- descobrir terapias adequadas ao momento atual;
- buscar terapeutas;
- acessar páginas de terapias;
- consultar disponibilidade;
- escolher profissional, serviço e horário;
- fazer cadastro ou login;
- preencher pré-checkout curto;
- pagar sessão;
- acompanhar sessões, favoritos, mensagens, pagamentos e configurações.

Para terapeutas, o MVP funciona como:

- canal de aquisição de pacientes;
- perfil público profissional;
- agenda;
- gestão de serviços;
- acompanhamento de pacientes e sessões;
- mensagens estruturadas;
- financeiro;
- métricas, insights e recomendações determinísticas conforme plano.

Para Admin, o MVP sustenta:

- curadoria de terapias;
- configuração do Match;
- verificação e moderação de profissionais;
- acompanhamento de sessões;
- pagamentos, repasses e assinaturas;
- suporte, segurança, integrações e relatórios.

## 4. Princípios obrigatórios

- O MVP é transacional: pagamento real deve ser confirmado por webhook Stripe.
- Não há IA real no MVP: Match, insights, métricas prescritivas e Aura/Assessor IA usam regras determinísticas.
- O catálogo de terapias é controlado pela plataforma.
- Terapeutas só publicam serviços vinculados a terapias aprovadas.
- Linguagem deve ser acolhedora e responsável.
- Não prometer cura, diagnóstico, tratamento ou resultado garantido.
- Não salvar dados individualizados do Match sem decisão LGPD registrada.
- Não expor segredos, chaves, payloads sensíveis ou start URL do Zoom.

## 5. Estado real do repositório

### 5.1 Stack confirmada

| Item                                                 | Status                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Next.js 15 App Router                                | Confirmado em `package.json`.                                                                      |
| React 18                                             | Confirmado em `package.json`.                                                                      |
| TypeScript                                           | Confirmado em `package.json`.                                                                      |
| Tailwind CSS                                         | Confirmado em `package.json`.                                                                      |
| `lucide-react`                                       | Confirmado em `package.json`.                                                                      |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Confirmado em `package.json`.                                                                      |
| shadcn/ui                                            | Planejado via `components.json`; implementação completa: Não identificado nos arquivos analisados. |
| Supabase local                                       | Estrutura confirmada em `supabase/`.                                                               |
| Supabase SDK frontend                                | Não identificado nos arquivos analisados.                                                          |
| Stripe SDK                                           | Confirmado em `package.json`; fundação Billing e Connect implementada.                             |
| Zoom SDK/API client                                  | `@zoom/videosdk`, JWT efêmero backend e cliente REST Video SDK implementados.                      |
| Storybook                                            | Documentado, não instalado.                                                                        |
| Observabilidade                                      | Não identificado nos arquivos analisados.                                                          |
| Test runner                                          | Vitest e Playwright confirmados em `package.json`.                                                 |

Scripts confirmados:

- `npm run dev`;
- `npm run build`;
- `npm run start`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run format`;
- `npm run format:check`.

Não há script `test` em `package.json`.

### 5.2 Páginas reais em `src/app`

| Rota          | Arquivo real                  | Status                                |
| ------------- | ----------------------------- | ------------------------------------- |
| `/`           | `src/app/page.tsx`            | Existe; shell/landing inicial.        |
| `/terapeutas` | `src/app/terapeutas/page.tsx` | Existe; usa dados mockados/hardcoded. |

Todas as demais rotas canônicas ainda não possuem `page.tsx` real identificado.

### 5.3 Componentes reais em `src/components`

| Arquivo                                 | Uso atual            |
| --------------------------------------- | -------------------- |
| `src/components/tes/public-header.tsx`  | Header público.      |
| `src/components/tes/public-footer.tsx`  | Footer público.      |
| `src/components/tes/therapist-card.tsx` | Card de terapeuta.   |
| `src/components/tes/filter-button.tsx`  | Botão/filtro visual. |
| `src/components/tes/journey-banner.tsx` | Banner de jornada.   |
| `src/components/tes/tes-button.tsx`     | Botão base.          |
| `src/components/tes/tes-card.tsx`       | Card base.           |
| `src/components/tes/tes-input.tsx`      | Input base.          |
| `src/components/tes/tes-badge.tsx`      | Badge base.          |
| `src/components/tes/index.ts`           | Barrel export.       |

Componentes planejados em `routes-map.md`, mas não identificados como React real nos arquivos analisados:

- `TherapyCard`;
- `MatchingQuestionCard`;
- `JourneyResultCard`;
- `BookingStepper`;
- `ReservationSummary`;
- `PaymentForm`;
- `AppSidebar`;
- `Topbar`;
- `SessionCard`;
- `PatientTable`;
- `SessionTable`;
- `FinanceKPI`;
- `AIRecommendationCard`;
- `AIAssessorPanel`;
- `AdminKPIGrid`;
- `DataTable`.

### 5.4 Supabase real

Migration existente:

- `supabase/migrations/20260708090000_initial_mvp_domain.sql`.

Seed existente:

- `supabase/seed.sql`.

Edge Function existente:

- `supabase/functions/match-therapies/index.ts`.

Não foram identificados arquivos de teste ou spec.

## 6. Rotas canônicas

Rotas técnicas devem seguir `src/lib/routes.ts`. Figma pode conter nomes legados; esses nomes não devem ser usados como rota nova sem decisão explícita.

### 6.1 Público

| Rota                      | Page real                     | Origem                                   | Fase |
| ------------------------- | ----------------------------- | ---------------------------------------- | ---- |
| `/`                       | Sim                           | `routes.ts`, sitemap, Figma              | 0    |
| `/como-funciona`          | Não                           | `routes.ts`, sitemap, Figma              | 0    |
| `/sua-jornada`            | Sim                           | `routes.ts`, sitemap, Figma `13273:2627` | 1    |
| `/sua-jornada/resultado`  | Sim                           | `routes.ts`, sitemap, Figma `13273:2627` | 1    |
| `/terapeutas`             | Sim, integrado a view pública | `routes.ts`, sitemap, Figma `13273:3587` | 1    |
| `/terapeutas/:slug`       | Sim                           | `routes.ts`, sitemap, Figma `13273:3393` | 1    |
| `/reserva`                | Não                           | `routes.ts`, sitemap, Figma              | 2    |
| `/reserva/sucesso`        | Não                           | `routes.ts`, sitemap                     | 2    |
| `/terapias`               | Sim                           | `routes.ts`, sitemap, Figma `13273:1439` | 1    |
| `/terapias/:slug`         | Não                           | `routes.ts`, sitemap, Figma              | 1    |
| `/para-terapeutas`        | Sim                           | `routes.ts`, sitemap, Figma `13457:848`  | 0    |
| `/para-terapeutas/planos` | Não                           | `routes.ts`, sitemap, Figma              | 0    |
| `/cliente/login`          | Sim                           | `routes.ts`, sitemap, Produto            | 0/2  |
| `/cliente/cadastro`       | Sim                           | `routes.ts`, sitemap, Produto            | 0/2  |
| `/terapeuta/login`        | Sim                           | `routes.ts`, sitemap, Produto            | 0/2  |
| `/terapeuta/cadastro`     | Sim                           | `routes.ts`, sitemap, Produto            | 0/2  |
| `/entrar`                 | Não, legado                   | `routes.ts`, sitemap                     | 0/2  |
| `/cadastro`               | Não, legado                   | `routes.ts`, sitemap                     | 0/2  |
| `/reset-senha`            | Não                           | `routes.ts`, sitemap                     | 0/2  |
| `/ajuda`                  | Não                           | `routes.ts`, sitemap                     | 0    |
| `/termos`                 | Não                           | `routes.ts`, sitemap                     | 0    |
| `/privacidade`            | Não                           | `routes.ts`, sitemap                     | 0    |

### 6.2 Paciente

| Rota                              | Page real | Fase |
| --------------------------------- | --------- | ---- |
| `/app`                            | Não       | 3    |
| `/app/sessoes`                    | Não       | 3    |
| `/app/sessoes/proximas`           | Não       | 3    |
| `/app/sessoes/historico`          | Não       | 3    |
| `/app/sessoes/:slug`              | Não       | 3    |
| `/app/mensagens`                  | Não       | 3    |
| `/app/favoritos`                  | Não       | 3    |
| `/app/favoritos/terapeutas`       | Não       | 3    |
| `/app/favoritos/terapias`         | Não       | 3    |
| `/app/pagamentos`                 | Não       | 3    |
| `/app/pagamentos/faturas`         | Não       | 3    |
| `/app/pagamentos/metodos`         | Não       | 3    |
| `/app/configuracoes`              | Não       | 3    |
| `/app/configuracoes/perfil`       | Não       | 3    |
| `/app/configuracoes/notificacoes` | Não       | 3    |
| `/app/configuracoes/privacidade`  | Não       | 3    |
| `/app/configuracoes/seguranca`    | Não       | 3    |
| `/app/ajuda`                      | Não       | 3    |

Regra: manter `/app/sessoes/:slug`. Não usar `/app/sessoes/:id` sem alteração formal em `src/lib/routes.ts`.

### 6.3 Terapeuta Básico

| Rota                    | Page real | Fase |
| ----------------------- | --------- | ---- |
| `/basico`               | Não       | 4    |
| `/basico/agenda`        | Não       | 4    |
| `/basico/pacientes`     | Não       | 4    |
| `/basico/sessoes`       | Não       | 4    |
| `/basico/mensagens`     | Não       | 4    |
| `/basico/servicos`      | Não       | 4    |
| `/basico/servicos/meus` | Não       | 4    |
| `/basico/pagamento`     | Não       | 4    |
| `/basico/perfil`        | Não       | 4    |
| `/basico/upgrade`       | Não       | 4    |
| `/basico/configuracoes` | Não       | 4    |
| `/basico/suporte`       | Não       | 4    |

Decisão histórica de 2026-07-13: `/basico/pagamento` era o path escolhido entre
as variantes legadas. Na arquitetura aprovada em 2026-07-25, ele será alias de
`/terapeuta/financeiro`.

### 6.4 Terapeuta Premium / Pro

| Rota                 | Page real | Fase |
| -------------------- | --------- | ---- |
| `/pro`               | Não       | 5    |
| `/pro/agenda`        | Não       | 5    |
| `/pro/pacientes`     | Não       | 5    |
| `/pro/sessoes`       | Não       | 5    |
| `/pro/mensagens`     | Não       | 5    |
| `/pro/servicos`      | Não       | 5    |
| `/pro/financeiro`    | Não       | 5    |
| `/pro/metricas`      | Não       | 5    |
| `/pro/avaliacoes`    | Não       | 5    |
| `/pro/plano`         | Não       | 5    |
| `/pro/perfil`        | Não       | 5    |
| `/pro/configuracoes` | Não       | 5    |
| `/pro/suporte`       | Não       | 5    |

Decisão histórica de 2026-07-13: `/pro/plano` era o path escolhido entre as
variantes legadas. Na arquitetura aprovada em 2026-07-25, ele será alias de
`/terapeuta/plano`.

### 6.5 Terapeuta Premium Plus / Plus

| Rota                                | Page real | Fase |
| ----------------------------------- | --------- | ---- |
| `/plus`                             | Não       | 5    |
| `/plus/agenda`                      | Não       | 5    |
| `/plus/pacientes`                   | Não       | 5    |
| `/plus/pacientes/:slug-do-paciente` | Não       | 5    |
| `/plus/sessoes`                     | Não       | 5    |
| `/plus/mensagens`                   | Não       | 5    |
| `/plus/servicos`                    | Não       | 5    |
| `/plus/servicos/meus`               | Não       | 5    |
| `/plus/financeiro`                  | Não       | 5    |
| `/plus/avaliacoes`                  | Não       | 5    |
| `/plus/insights`                    | Não       | 5    |
| `/plus/assessor-ia`                 | Não       | 5    |
| `/plus/perfil`                      | Não       | 5    |
| `/plus/configuracoes`               | Não       | 5    |
| `/plus/suporte`                     | Não       | 5    |

Registro histórico: a rota antiga era `/plus/pacientes/:slug-do-paciente`. A
implementação atual usa `/terapeuta/pacientes/:patientId`.

### 6.6 Admin

| Rota                                | Page real | Fase |
| ----------------------------------- | --------- | ---- |
| `/admin`                            | Não       | 6    |
| `/admin/profissionais`              | Não       | 6    |
| `/admin/profissionais/verificacoes` | Não       | 6    |
| `/admin/pacientes`                  | Não       | 6    |
| `/admin/sessoes`                    | Não       | 6    |
| `/admin/pagamentos`                 | Não       | 6    |
| `/admin/avaliacoes`                 | Não       | 6    |
| `/admin/assinaturas`                | Não       | 6    |
| `/admin/terapias`                   | Não       | 6    |
| `/admin/matching`                   | Não       | 6    |
| `/admin/integracoes`                | Não       | 6    |
| `/admin/seguranca`                  | Não       | 6    |
| `/admin/relatorios`                 | Não       | 6    |
| `/admin/configuracoes`              | Não       | 6    |
| `/admin/suporte`                    | Não       | 6    |

## 7. Perfis, planos e permissões

| Perfil                 | Área logada  | Plano         | Enum técnico   | Alias legado |
| ---------------------- | ------------ | ------------- | -------------- | ------------ |
| Paciente               | `/app`       | —             | —              | —            |
| Terapeuta Free         | `/terapeuta` | Básico / Free | `free`         | `/basico`    |
| Terapeuta Premium      | `/terapeuta` | Premium       | `premium`      | `/pro`       |
| Terapeuta Premium Plus | `/terapeuta` | Premium Plus  | `premium_plus` | `/plus`      |
| Admin                  | `/admin`     | —             | —              | —            |

Capabilities técnicas atuais em `src/domain/tes/permissions.ts`:

| Capability             | Free | Premium | Premium Plus |
| ---------------------- | ---: | ------: | -----------: |
| `operation_essentials` |  Sim |     Sim |          Sim |
| `advanced_metrics`     |  Não |     Sim |          Sim |
| `aura_limited`         |  Não |     Sim |          Sim |
| `aura_full`            |  Não |     Não |          Sim |
| `full_crm`             |  Não |     Não |          Sim |
| `strategic_reviews`    |  Não |     Não |          Sim |
| `advanced_financials`  |  Não |     Não |          Sim |
| `agenda_insights`      |  Não |     Sim |          Sim |
| `request_new_therapy`  |  Não |     Sim |          Sim |

Divergência superada pela F0/F1 financeira: a operação financeira essencial usa
`operation_essentials` em `/terapeuta/financeiro` para Free, Premium e Premium
Plus. `advanced_financials` permanece reservado a análises futuras, não ao
acesso a pagamentos, recebimentos, repasses ou conta Stripe Connect.

- Free: financeiro operacional.
- Premium: financeiro operacional, sem `advanced_financials`.
- Premium Plus: financeiro operacional, com profundidade financeira futura
  quando `advanced_financials` for implementado.

Documentos atuais: `docs/payments/therapist-finance-f0-f1.md` e
`docs/architecture/adr/ADR-012-therapist-finance-f0-f1.md`.

## 8. Modelo de dados atual

Tabelas existentes na migration real:

- `profiles`;
- `patient_profiles`;
- `therapist_profiles`;
- `therapist_verifications`;
- `therapy_categories`;
- `therapies`;
- `therapy_themes` (legado para compatibilidade histórica);
- `therapy_theme_weights` (legado para compatibilidade histórica);
- `matching_themes`;
- `matching_interests`;
- `matching_versions`;
- `matching_weights`;
- `matching_therapy_settings`;
- `therapist_services`;
- `availability_rules`;
- `availability_exceptions`;
- `bookings`;
- `pre_checkout_intakes`;
- `payments`;
- `favorite_therapists`;
- `message_templates`;
- `structured_messages`;
- `reviews`;
- `aura_recommendations`;
- `support_tickets`.

Enums existentes:

- `user_role`;
- `therapist_plan`;
- `therapist_status`;
- `therapy_status`;
- `service_status`;
- `booking_status`;
- `payment_status`;
- `match_source`;
- `message_context`;
- `review_status`.

Esta lista registrava alvos ainda não identificados em 2026-07-13. O estado
atual está em `docs/payments/architecture.md`; `session_payments`,
`financial_ledger_entries`, `payout_batches` e `payout_batch_items` já existem.

- `session_payments`;
- `financial_ledger_entries`;
- `stripe_webhook_events`;
- `therapist_connect_accounts`;
- `therapist_subscriptions`;
- `payout_batches`;
- `payout_batch_therapists`;
- `payout_batch_items`;
- `favorite_therapies`;
- `matching_versions`;
- `matching_weight_versions`;
- `matching_aggregate_metrics`.

Risco crítico: `payments` existe, mas o alvo consolidado exige `session_payments` como fonte única para pagamentos de sessão. Não criar código novo usando `payments` como fonte final de verdade.

## 9. RLS e segurança de dados

Confirmado:

- RLS está habilitado em tabelas principais.
- Políticas públicas existem para categorias, terapias e temas ativos.
- Políticas existem para favoritos de terapeutas do paciente.
- Não foi encontrado `USING (true)` nem `WITH CHECK (true)` nas policies analisadas.

TODOs existentes na migration:

- adicionar policies de Admin após estratégia de admin guard;
- adicionar views públicas de perfil/serviço antes de expor terapeuta ao público;
- adicionar policies de escrita de booking somente por Edge Functions validadas;
- adicionar policies de pagamento após Stripe flow e regras de webhook.

Implicação:

- Fase 1 pública depende de views/RLS para terapeuta aprovado e serviço ativo.
- Fase 2 depende de RLS/policies novas para booking, pagamento, ledger e Zoom.
- Admin não pode ser considerado pronto sem estratégia de claim/role.

## 10. Edge Functions

### 10.1 Estado real

Existe apenas `match-therapies`.

Contrato real identificado:

```ts
{
  selectedThemeIds?: string[]
  selectedSubthemeIds?: string[]
  source?: "journey" | "therapy_page" | "therapist_search"
  maxResults?: number
}
```

Resposta real:

```ts
{
  source: string;
  results: Array<{
    score: number;
    compatibilityPercent: number;
    explanation: string;
    matchedThemeIds: string[];
    matchedSubthemeIds: string[];
    therapy: {
      id: string;
      name: string;
      slug: string;
      shortDescription: string;
    };
  }>;
}
```

Status histórico da Edge Function legada `match-therapies`:

- não limita explicitamente a 3 temas/interesses no contrato legado;
- não usa `matching_versions`;
- não aplica threshold/fallback de 45%;
- não retorna `versionId`;
- não registra métricas agregadas;
- aceita subtemas no contrato legado; a UI atual usa “Interesse”.

Status atual do app público: `/api/public/matching/calculate` substitui esse contrato para a jornada pública e usa temas, interesses, pesos versionados, threshold e fallback.

### 10.2 Funções alvo

| Função                                                    | Fase | Status atual                                                                | Pode iniciar fase sem ela?                                           |
| --------------------------------------------------------- | ---: | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `match-therapies`                                         |    1 | Existe; precisa alinhar contrato                                            | Sim para catálogo; não para resultado final.                         |
| `record-matching-metrics`                                 |  1/6 | Não identificado nos arquivos analisados.                                   | Sim, se métricas forem postergadas.                                  |
| `stripe-create-session-payment`                           |    2 | Implementada sobre `session_payments`, com projeções transacionais.         | Sim; go-live exige E2E no Stripe test mode.                          |
| `stripe-billing-webhook`                                  |  2/5 | Implementada com reserva atômica, eventos assíncronos e ordenação temporal. | Sim; go-live exige E2E com eventos assinados.                        |
| `zoom-video-session-access` e `zoom-video-session-access` |    2 | Implementadas com outbox pós-pagamento e Video SDK.                         | Sim; go-live exige gates externos e testes RLS.                      |
| `stripe-connect-create-account` e account link            |    4 | Implementadas sobre Accounts v2, incluindo eventos thin `v2.core.account*`. | Sim; go-live exige E2E Connect em test mode.                         |
| `stripe-connect-sync-account`                             |    4 | Implementada com leitura de requirements e capability de transferência.     | Sim; go-live exige E2E Connect em test mode.                         |
| `stripe-create-subscription-checkout`                     |    5 | Implementada com catálogo server-side e reconciliação por webhook.          | Sim; go-live exige E2E Billing em test mode.                         |
| `process-payout-batch`                                    |    6 | Implementada com claim atômico, Charge de origem e reconciliação.           | Sim; go-live exige E2E de repasse em test mode.                      |
| `publish-matching-version`                                |    6 | Não identificado nos arquivos analisados.                                   | Sim se Match v1 usar tabela simples; não se exigir versão publicada. |

## 11. Sistema de Match

### 11.1 Decisão de escopo

O Match v1 recomenda terapias, não terapeutas. Ele é determinístico, anônimo e baseado em temas, interesses e pesos versionados.

Estado implementado:

| Camada        | Escopo                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Público       | `/sua-jornada` carrega `public_matching_config` com 10 temas e interesses ativos.                                            |
| Cálculo       | `/api/public/matching/calculate` usa `matching_versions`, `matching_weights` e multiplicador `1.4` para interesses.          |
| Publicação    | Somente a versão `matching_versions.status = published` entra no público.                                                    |
| Elegibilidade | Uma terapia só entra no Match se `therapies.status = published` e `matching_therapy_settings.is_visible_in_matching = true`. |

### 11.2 Fluxo público

```txt
/sua-jornada
-> usuário seleciona 1 a 3 temas e até 3 interesses por tema
-> POST /api/public/matching/calculate
-> /sua-jornada/resultado
-> /terapias/:slug
-> /terapeutas ou /terapeutas/:slug
-> /reserva
```

### 11.3 Ajustes obrigatórios na Fase 1

- Limitar seleção a no máximo 3 temas no frontend e backend.
- Validar interesses contra os temas selecionados.
- Não expor pesos internos ao cliente.
- Não persistir respostas individualizadas.
- Exibir aviso de não diagnóstico.
- Manter fallback de baixa correspondência com até 3 melhores caminhos.
- Criar testes formais do algoritmo no runner padrão do projeto.

### 11.4 Fallback recomendado

Se nenhuma terapia tiver aderência suficiente:

- mostrar as 3 terapias com maior score relativo;
- exibir copy honesta:

```txt
Não encontramos uma correspondência forte para essa combinação, mas estes caminhos podem servir como ponto de partida.
```

### 11.5 Dados do Match

Dados atuais do Match:

- `matching_themes`;
- `matching_interests`;
- `matching_versions`;
- `matching_weights`;
- `matching_therapy_settings`;
- `public_matching_config`;
- `public_matching_therapist_counts`;
- `supabase/seed.sql`;
- `/api/public/matching/config`;
- `/api/public/matching/calculate`.

Dados ainda pendentes para fase avançada/Admin:

- `matching_aggregate_metrics`;
- gestão Admin de pesos/publicação.

## 12. Catálogo público e terapeutas

### 12.1 Catálogo de terapias

Rotas:

- `/terapias`;
- `/terapias/:slug`.

Dependências:

- `therapies`;
- `therapy_categories`;
- `public_therapies_v`;
- RLS pública para `status = published`;
- componentes `TherapyCard`, `TherapyHero`, `ContentSections`;
- associação com serviços e terapeutas aprovados.

Pronto quando:

- lista apenas terapias publicadas;
- detalhe não promete cura/diagnóstico;
- mostra profissionais elegíveis associados;
- estado vazio, loading e erro existem;
- responsivo e alinhado ao Figma.

### 12.2 Busca de terapeutas

Rotas:

- `/terapeutas`;
- `/terapeutas/:slug`.

Estado atual:

- `/terapeutas` existe, mas com dados mockados/hardcoded.

Dependências:

- view pública de terapeutas aprovados;
- serviços ativos;
- disponibilidade calculada;
- filtros reais;
- RLS/view que não exponha dados privados.

Pronto quando:

- não exibe terapeuta não aprovado;
- não exibe serviço inativo;
- não depende de mock local;
- perfil não elegível retorna 404 ou estado indisponível;
- ações levam para `/reserva`.

## 13. Reserva, pagamento e sessão online

### 13.1 Fluxo transacional

```txt
Descoberta
-> terapia ou terapeuta
-> serviço
-> horário
-> login/cadastro
-> pré-checkout
-> Stripe Checkout
-> webhook confirma
-> Zoom é criado
-> /reserva/sucesso
-> /app/sessoes/:slug
```

### 13.2 Regras de reserva

- Horário precisa ser revalidado no backend antes de criar Checkout.
- Reserva inicia como `pending_payment`.
- Slot pendente deve expirar após janela definida.
- Preço e duração devem ser gravados como snapshot no momento da reserva.
- Mudança futura no serviço não altera reserva existente.
- Confirmação depende de webhook Stripe, não de redirect.
- Zoom só é criado após pagamento confirmado.

### 13.3 Lacunas atuais

Atualização de 2026-07-25: `session_payments`, ledger,
`stripe_webhook_events`, Checkout e webhooks Stripe possuem fundação
implementada. O Gate F0 de hardening financeiro foi concluído. Permanecem como
lacunas:

- snapshot financeiro completo e integração transacional do booking;
- holds, conflito autoritativo e transições de booking;
- bloqueios de produção Zoom: Video SDK token, hosts, cron, webhook remoto e pgTAP RLS;
- homologação ponta a ponta de cobrança, cancelamento, disputa e repasse.

### 13.4 Máquina de estados alvo

Booking:

```txt
draft
-> pending_payment
-> confirmed
-> completed
```

Cancelamentos:

```txt
confirmed -> cancelled_by_patient
confirmed -> cancelled_by_therapist
confirmed -> no_show_patient
confirmed -> no_show_therapist
confirmed/completed -> refunded
```

Pagamento:

```txt
not_started
-> pending
-> paid
-> failed
-> refunded
-> partially_refunded
```

Disputa deve ser modelada em `session_payments` e/ou `transfer_status`, porque o enum atual de `payments` não possui `disputed`.

## 14. Financeiro com Stripe

### 14.1 Decisão financeira

A TES absorve taxas Stripe.

Modelo alvo:

- Stripe Checkout para sessão.
- Stripe Connect Express para terapeuta.
- Separate Charges and Transfers.
- Stripe Billing para assinaturas.
- Ledger interno obrigatório.
- Repasses via `payout_batches` e `payout_batch_items`.

### 14.2 Fonte de verdade

Fonte única de pagamentos de sessão no alvo: `session_payments`.

Regra de transição:

- criar `session_payments`;
- migrar ou descontinuar `payments`;
- não manter `payments` e `session_payments` como fontes paralelas;
- código novo não deve escrever em `payments` como fonte final.

### 14.3 Tabelas financeiras alvo

Obrigatórias para Fase 2:

- `session_payments`;
- `financial_ledger_entries`;
- `stripe_webhook_events`.

Obrigatórias para Fase 4:

- `therapist_connect_accounts`.

Obrigatórias para Fase 5:

- `therapist_subscriptions`.

Obrigatórias para Fase 6:

- `payout_batches`;
- `payout_batch_therapists`;
- `payout_batch_items`;

### 14.4 Webhooks Stripe

Eventos mínimos:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `payment_intent.processing`;
- `payment_intent.succeeded`;
- `payment_intent.payment_failed`;
- `charge.refunded`;
- `refund.created`;
- `refund.updated`;
- `refund.failed`;
- `charge.dispute.created`;
- `account.updated` e eventos thin `v2.core.account*`;
- `invoice.paid`;
- `invoice.payment_failed`;
- `customer.subscription.updated`;
- `customer.subscription.deleted`.

Regras:

- persistir eventos em `stripe_webhook_events`;
- deduplicar antes de efeito colateral;
- usar idempotência em operações Stripe;
- não confiar em ordem perfeita de webhooks;
- nunca considerar redirect como confirmação de pagamento.

### 14.5 Repasses

Elegibilidade:

- pagamento `paid`;
- sessão `completed`;
- saldo Stripe disponível;
- sem refund pendente;
- sem disputa aberta;
- terapeuta com Connect Express apto para payouts;
- não incluído em lote anterior.

Ciclo recomendado:

```txt
Admin lista elegíveis
-> cria payout_batch
-> cria payout_batch_items
-> processa transfers
-> registra ledger
-> trata falhas e retries
```

## 15. Zoom

Estado atual: fundação implementada com Video SDK API credentials, Video SDK,
outbox pós-pagamento e webhooks assinados.

Fontes:

- `video_sessions`;
- RPCs locais de estado da sessão por booking;
- `zoom_video_webhook_events`;
- `video_session_participations`;
- `patient_video_session_summary_v`;
- `therapist_video_session_summary_v`.

Regras implementadas:

- sessão local criada somente após `session_payments.financial_status = paid`;
- JWT Video SDK gerado no backend;
- paciente recebe somente JWT efêmero de participante com `role_type = 0`;
- terapeuta recebe somente JWT efêmero de responsável com `role_type = 1`;
- segredo do Video SDK, URL sensível ou credencial de API não são persistidos;
- logs e tópicos não contêm conteúdo clínico;
- webhooks possuem idempotência e deduplicação.

Antes de produção:

- bloquear terapeuta suspenso/rejeitado;
- validar pagamento canônico também no endpoint de acesso;
- definir alocação/capacidade de hosts;
- homologar Video SDK token e scopes;
- configurar cron e webhook remoto;
- criar pgTAP de RLS e deduplicação semântica de participação.

## 16. Área do paciente

Fase 3 entrega:

- dashboard `/app`;
- sessões próximas e histórico;
- detalhe da sessão;
- mensagens estruturadas;
- favoritos;
- pagamentos/comprovantes;
- configurações;
- ajuda logada.

Dependências:

- Supabase Auth;
- RLS por paciente;
- bookings confirmados;
- `session_payments`;
- links Zoom protegidos;
- `favorite_therapists`;
- `favorite_therapies` a criar;
- mensagens estruturadas.

Pronto quando:

- paciente vê apenas seus próprios dados;
- sessão confirmada aparece após webhook;
- pagamento aparece a partir de `session_payments`;
- start URL não aparece ao paciente;
- favoritos de terapeuta e terapia funcionam;
- mensagens não viram chat livre sem regra definida.

## 17. Área do terapeuta

### 17.1 Básico / Free

Fase 4 entrega:

- dashboard;
- agenda;
- pacientes simples;
- sessões;
- mensagens;
- serviços;
- financeiro operacional em `/terapeuta/financeiro`;
- perfil;
- upgrade;
- configurações;
- suporte.

Financeiro Básico:

- valor bruto gerado;
- comissão TES;
- líquido a receber;
- status de repasse;
- lista paginada de recebimentos e repasses.

Não inclui:

- `advanced_financials`;
- CRM completo;
- métricas avançadas;
- Aura completa;
- gestão avançada.

### 17.2 Premium / Pro

Fase 5 entrega:

- operação do Básico;
- agenda avançada;
- pacientes intermediário;
- métricas;
- avaliações;
- Aura limitada;
- insights de agenda;
- solicitação de nova terapia;
- financeiro operacional em `/terapeuta/financeiro`;
- plano em `/pro/plano`.

Não inclui:

- `full_crm`;
- `aura_full`;
- `advanced_financials`;
- inteligência financeira futura.

### 17.3 Premium Plus / Plus

Fase 5 entrega:

- todos os recursos Pro;
- CRM completo;
- histórico operacional do paciente;
- avaliações estratégicas;
- Aura completa determinística;
- insights avançados;
- financeiro operacional e inteligência financeira futura;
- suporte prioritário.

## 18. Admin

Fase 6 entrega:

- dashboard;
- profissionais;
- verificações;
- pacientes;
- sessões;
- pagamentos;
- avaliações;
- assinaturas;
- terapias;
- matching;
- integrações;
- segurança;
- relatórios;
- configurações;
- suporte.

Dependências:

- admin guard por claim/role;
- policies de Admin;
- views seguras;
- ledger;
- repasses;
- Stripe Billing;
- Connect;
- matching versionado, se Admin editar pesos em produção.

## 19. Plano por fases

### Fase 0 — Fundação visual e shells

Objetivo: deixar navegação, estrutura visual e shells prontos sem simular backend inexistente.

Entregas:

- consolidar layout público;
- criar páginas públicas estáticas: `/`, `/como-funciona`, `/para-terapeutas`, `/para-terapeutas/planos`, `/ajuda`, `/termos`, `/privacidade`;
- criar shells de auth: `/entrar`, `/cadastro`, `/reset-senha`;
- criar shells logados vazios para `/app`, `/basico`, `/pro`, `/plus`, `/admin`;
- inventário de páginas e componentes atualizado;
- tokens TES respeitados.

Dependências:

- Figma validado;
- `routes.ts`;
- `routes-map.md`;
- componentes existentes em `src/components/tes`.

Critério de pronto:

- todas as rotas Fase 0 renderizam;
- sem dados falsos tratados como reais;
- `npm run typecheck`, `npm run lint`, `npm run build` passam;
- responsividade validada contra Figma/documentação.

Status: pode iniciar.

### Fase 1 — Descoberta pública, catálogo e Match

Objetivo: entregar descoberta real sem pagamento.

Entregas:

- `/terapias`;
- `/terapias/:slug`;
- `/terapeutas` integrado ao backend;
- `/terapeutas/:slug`;
- `/sua-jornada`;
- `/sua-jornada/resultado`;
- ajuste de contrato de `match-therapies`;
- testes mínimos do algoritmo;
- views/RLS públicas de terapeuta aprovado e serviço ativo;
- favoritos de terapeuta se usuário logado, se Auth já estiver pronta.

Dependências:

- catálogo e seed;
- `match-therapies`;
- RLS/views públicas;
- decisão de contrato do Match.

Critério de pronto:

- nenhuma página depende de mock;
- Match limita até 3 temas;
- resultado não salva pessoa individualizada;
- nenhuma terapia inativa aparece;
- terapeuta não aprovado não aparece;
- pesos internos não são expostos.

Status: parcialmente bloqueada até alinhar contrato do Match e RLS pública.

### Fase 2 — Reserva, Stripe, ledger e Zoom

Objetivo: tornar a plataforma transacional.

Entregas:

- `/reserva`;
- `/reserva/sucesso`;
- Supabase Auth necessário ao checkout;
- pré-checkout;
- `session_payments`;
- `financial_ledger_entries`;
- `stripe_webhook_events`;
- `create-checkout-session`;
- `stripe-webhook`;
- snapshot de preço/duração;
- criação de Zoom pós-webhook;
- proteção de URLs Zoom;
- status de pagamento por webhook.

Dependências:

- Fase 1 concluída;
- decisions de booking, expiração, política mínima de cancelamento e preço mínimo;
- Gate Financeiro F0 concluído sobre a fundação Stripe existente;
- configuração Zoom no ambiente alvo e gates de produção da integração;
- migrations financeiras complementares somente quando necessárias.

Critério de pronto:

- pagamento confirmado só por webhook;
- idempotência implementada;
- ledger registra eventos principais;
- `payments` não é fonte paralela;
- Zoom só é criado após pagamento confirmado;
- `npm run typecheck`, `npm run lint`, `npm run build` passam.

Status: parcialmente implementada. F0 e fundação Zoom concluídos; reserva
autoritativa, holds, snapshots completos e homologações externas permanecem.

### Fase 3 — Área do paciente

Objetivo: dar continuidade pós-compra.

Entregas:

- `/app`;
- `/app/sessoes`;
- `/app/sessoes/proximas`;
- `/app/sessoes/historico`;
- `/app/sessoes/:slug`;
- `/app/mensagens`;
- `/app/favoritos`;
- `/app/favoritos/terapeutas`;
- `/app/favoritos/terapias`;
- `/app/pagamentos`;
- `/app/pagamentos/faturas`;
- `/app/pagamentos/metodos`;
- `/app/configuracoes/**`;
- `/app/ajuda`.

Dependências:

- Fase 2 concluída;
- RLS de paciente;
- `favorite_therapies`;
- dados de sessão e pagamento.

Critério de pronto:

- paciente vê somente dados próprios;
- sessão confirmada tem join URL, não start URL;
- pagamentos vêm de `session_payments`;
- mensagens são estruturadas e seguras.

Status: bloqueada pela Fase 2.

### Fase 4 — Terapeuta Básico

Objetivo: entregar operação essencial ao terapeuta.

Entregas:

- `/basico/**`;
- gestão de agenda;
- gestão de serviços;
- sessões;
- pacientes simples;
- mensagens;
- perfil;
- suporte;
- pagamento simplificado;
- onboarding Connect Express.

Dependências:

- RLS de terapeuta;
- serviços e disponibilidade;
- Stripe Connect;
- dados financeiros transacionais.

Critério de pronto:

- terapeuta vê apenas sua operação;
- serviços só usam terapias aprovadas;
- financeiro usa `session_payments` e ledger;
- rota canônica alvo é `/terapeuta/financeiro`, com `/basico/pagamento` como
  alias de transição.

Status: bloqueada pela Fase 2 e Connect.

### Fase 5 — Premium e Premium Plus

Objetivo: entregar inteligência determinística e gestão avançada por plano.

Entregas Pro:

- `/pro/**`;
- métricas intermediárias;
- avaliações;
- financeiro intermediário;
- Aura limitada;
- plano/Billing.

Entregas Plus:

- `/plus/**`;
- CRM completo;
- histórico operacional;
- Aura completa determinística;
- insights;
- financeiro avançado.

Dependências:

- matriz de permissões validada;
- Billing;
- dados históricos suficientes;
- rules engine determinístico.

Critério de pronto:

- `src/lib/permissions.ts` e `src/domain/tes/permissions.ts` refletem o produto aprovado;
- recursos bloqueados exibem estados corretos;
- Aura não afirma usar IA real;
- recomendações são explicáveis.

Status: bloqueada parcialmente por matriz comercial/permissions.

### Fase 6 — Admin, repasses e governança

Objetivo: fechar operação da plataforma.

Entregas:

- `/admin/**`;
- admin guard;
- policies de admin;
- gestão de profissionais;
- curadoria de terapias;
- matching avançado;
- pagamentos;
- repasses;
- assinaturas;
- integrações;
- segurança;
- relatórios.

Dependências:

- ledger;
- transfer batches;
- Stripe Billing;
- Stripe Connect;
- RLS admin;
- versionamento do Match, se Admin alterar pesos.

Critério de pronto:

- nenhuma policy aberta com `USING (true)`;
- Admin opera via claims/roles;
- repasses são idempotentes;
- lote parcialmente falho é rastreável;
- matching publicado tem trilha de auditoria.

Status: bloqueada.

## 20. Decisões e gates

|   # | Decisão                                    | Classe | Fase | Status neste plano                                                                                        |
| --: | ------------------------------------------ | ------ | ---: | --------------------------------------------------------------------------------------------------------- |
|   1 | Rota financeira Básico                     | C      |  0/4 | Superada pela rota canônica `/terapeuta/financeiro`; `/basico/pagamento` é redirect legado.               |
|   2 | `/pro/upgrade` ou `/pro/plano`             | C      |  0/5 | Resolvida: `/pro/plano`.                                                                                  |
|   3 | Nome público Aura/IA                       | A      |    5 | Pendente; usar linguagem determinística até decisão.                                                      |
|   4 | Contrato do Match                          | A      |    1 | Pendente; alinhar function real e frontend.                                                               |
|   5 | Versionamento dos pesos                    | B/A    |  1/6 | Postergável se Fase 1 usar tabela simples; bloqueia Admin de pesos.                                       |
|   6 | Métricas anônimas                          | B      |  1/6 | Postergável para Fase 6.                                                                                  |
|   7 | Máquina de estados booking                 | A      |    2 | Pendente antes de migration.                                                                              |
|   8 | Expiração de booking pendente              | A      |    2 | Pendente antes de checkout.                                                                               |
|   9 | Transição `payments` -> `session_payments` | A      |    2 | Obrigatória.                                                                                              |
|  10 | Credencial de host Zoom                    | A      |    2 | Resolvida sem persistir `video_session_secret_url_removed`/Video SDK token; homologação externa pendente. |
|  11 | Financeiro disponível ao Básico            | C      |    4 | Resolvido como financeiro operacional na rota canônica `/terapeuta/financeiro`.                           |
|  12 | Modelo de disponibilidade                  | A      |  2/4 | Pendente para reserva real.                                                                               |
|  13 | Matriz definitiva de capabilities          | A      |    5 | Parcialmente resolvida pelo código; precisa decisão se produto quiser alterar Premium.                    |
|  14 | Inadimplência                              | B/A    |    5 | Postergável para shell; bloqueia Billing real.                                                            |
|  15 | Elegibilidade de repasse                   | A      |    6 | Pendente antes de transferências.                                                                         |

Legenda:

- A: bloqueadora da fase.
- B: pode ser postergada.
- C: já respondida nas fontes.

## 21. Riscos

| Risco                                                    | Severidade | Mitigação                                                                                                         |
| -------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `payments` e `session_payments` virarem fontes paralelas | Alta       | Criar `session_payments` e proibir código novo usando `payments` como fonte final.                                |
| Checkout sem webhook/idempotência                        | Alta       | `stripe_webhook_events`, dedupe e webhook como fonte única.                                                       |
| Reserva dupla de horário                                 | Alta       | Validar e bloquear no banco/Edge Function.                                                                        |
| Credencial de host Zoom exposta                          | Alta       | Não persistir `video_session_secret_url_removed`/Video SDK token; payload efêmero apenas ao terapeuta autorizado. |
| Host Zoom único para agenda concorrente                  | Alta       | Definir pool/alocação de hosts licenciados antes do go-live.                                                      |
| Terapeuta bloqueado recebendo acesso Zoom                | Alta       | Remover `allowBlockedStatus` e cobrir o gate com testes.                                                          |
| RLS pública insuficiente para terapeutas/serviços        | Alta       | Criar views/policies antes de páginas públicas reais.                                                             |
| Figma e rotas locais divergentes                         | Média      | Manter `routes.ts` como canônico e registrar aliases/legados.                                                     |
| Linguagem de IA enganosa                                 | Média      | Copy deve explicar recomendações determinísticas.                                                                 |
| Pro financeiro conflita com permissions                  | Média      | Decisão de produto antes da Fase 5.                                                                               |
| Falta de testes                                          | Média      | Adicionar testes mínimos em Fase 1 para Match e em Fase 2 para webhooks.                                          |
| Homologação externa Stripe/Zoom ausente                  | Alta       | Executar E2E em test mode/Marketplace antes de produção.                                                          |

## 22. QA e definição de pronto do MVP

Uma entrega só pode ser marcada pronta quando:

- respeita Figma e fontes de verdade aplicáveis;
- respeita `src/lib/routes.ts`;
- respeita `src/lib/permissions.ts`;
- usa tokens TES;
- não promete cura, diagnóstico ou resultado;
- não expõe segredos;
- não salva dados individualizados do Match sem decisão LGPD;
- valida pagamento por webhook Stripe;
- usa idempotência em Stripe;
- usa `session_payments` como fonte única de pagamentos de sessão;
- registra ledger em `financial_ledger_entries`;
- cria repasses a partir de `payout_batches` e `payout_batch_items`;
- grava snapshot de preço e duração no momento da reserva;
- gera link Zoom apenas após pagamento confirmado;
- não persiste `video_session_secret_url_removed` ou Video SDK token; qualquer persistência futura exige
  criptografia versionada e leitura indireta autorizada;
- protege dados por RLS conforme perfil;
- passa em `npm run typecheck`;
- passa em `npm run lint`;
- passa em `npm run build`;
- documenta limitações e riscos.

Vitest, Playwright e testes SQL estão configurados. Zoom ainda exige pgTAP de
RLS e E2E autenticado cobrindo paciente, terapeuta responsável, terapeuta
externo e terapeuta bloqueado.

## 23. Próxima sequência executável

1. Atualizar inventário de páginas e componentes com o estado real.
2. Implementar Fase 0 sem backend falso.
3. Criar componentes públicos faltantes reutilizando `src/components/tes`.
4. Criar views/RLS públicas para terapeuta aprovado e serviço ativo.
5. Alinhar contrato de `match-therapies`.
6. Implementar catálogo e Match real.
7. Criar testes mínimos do Match.
8. Gate F0 concluído: preservar os invariantes financeiros nos próximos marcos.
9. A2 concluída: preservar snapshots, holds, conflitos, transições e RLS nos
   próximos marcos.
10. Implementar A3 para edição de horários e preview de disponibilidade.
11. Implementar A5/A6 para slots autoritativos e orquestração de checkout.
12. Fechar os gates de produção da fundação Zoom já implementada.
13. Só então liberar os fluxos transacionais completos nos três shells.

## 24. Fora de escopo do MVP

- IA generativa real.
- OpenAI ou modelo externo para recomendações.
- Ranking de terapeutas pelo Match v1.
- Score por terapeuta.
- Histórico individual de respostas do Match.
- Prontuário clínico formal.
- Chat livre complexo.
- Split automático imediato sem ledger interno.
- Repasse manual fora de Stripe como fonte primária.
- Nota fiscal automática.
- Antecipação de recebíveis.
- Reembolso parcial complexo por regra dinâmica.

## 25. Conclusão

O caminho seguro parte da A2 já concluída, preserva o F0 e segue por A3, A5 e
A6 antes de liberar o checkout transacional completo. Zoom permanece como
fundação implementada com go-live condicionado a segurança, capacidade e
homologação externa. A regra principal continua sendo uma única fonte de
verdade para rotas, permissões, pagamentos e dados sensíveis.
