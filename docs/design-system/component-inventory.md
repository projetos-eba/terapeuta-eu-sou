# Inventário de Componentes

Componentes reutilizáveis para montar telas, estados e variações por perfil.

## Prioridade

- `P0`: MVP e telas principais.
- `P1`: operação completa por perfil.
- `P2`: Plus/Admin avançado ou maturidade.

## Status no Figma Atual

A página `Design System` atual publica uma biblioteca validada e expandida. A base inicial continua nos frames `Design System / Foundations`, `Design System / Component Library` e `Design System / Product Patterns & Templates`. A segunda rodada foi adicionada em `Design System / Phase 2 Expansion` e a área `Design System / Componentes` (`12363:2`) foi reorganizada em 12 frames menores para consulta.

Componentes publicados na base inicial:

- `Atoms/Button`;
- `Atoms/Form Controls`;
- `Atoms/Badge`;
- `Atoms/Boolean Control`;
- `Molecules/Navigation Item`;
- `Molecules/Card`;
- `Molecules/Tabs`;
- `Organisms/Public Header`;
- `Organisms/App Sidebar`;
- `Product/TherapistCard`;
- `Product/TherapyCard`;
- `Product/JourneyResultCard`;
- `Product/MetricCard`;
- `Product/AIRecommendationCard`;
- `Product/CarefulBenchmark`;
- `Templates/Dashboard Shell`.

Componentes e assets adicionados na Fase 2:

- `Molecules/FilterBar`;
- `Molecules/SearchWithFilters`;
- `Molecules/RightRail`;
- `Molecules/SupportCard`;
- `Molecules/PolicyCard`;
- `Molecules/SaveBar`;
- `Molecules/FloatingHelpButton`;
- `Organisms/AppTopbar`;
- `Product/SessionCard`;
- `Product/NextSessionBlock`;
- `Product/SessionDetailPanel`;
- `Product/PaymentSummary`;
- `Product/PlanCard`;
- `Product/ProfileChecklist`;
- `Product/UpgradeBanner`;
- `Product/ServiceCard`;
- `Product/ReviewCard`;
- `Product/PatientRow`;
- `Product/VerificationPanel`;
- `Product/ModerationQueue`;
- `Product/AIInsightPanel`;
- `Product/PatientJourneyTimeline`;
- `Icon/*`;
- `Asset/*`;
- `Data/*`;
- `Pattern/*` por perfil.

Números da Fase 2:

- 8 componentes em `01 Base, navegação e utilidades`;
- 4 componentes em `02 Produto: sessões e jornada`;
- 7 componentes em `03 Produto: plano, pagamento e perfil`;
- 3 componentes em `04 Produto: operações, moderação e IA`;
- 29 ícones lineares;
- 8 assets/visuais base, incluindo `Product/TherapyVisualCard`;
- 12 componentes de dados/gráficos;
- 15 patterns por perfil;
- 2 blocos de documentação `AI Metadata`.

Frames atuais da seção `Design System / Componentes`:

- `01 Base, navegação e utilidades` (`12857:626`);
- `02 Produto: sessões e jornada` (`12857:631`);
- `03 Produto: plano, pagamento e perfil` (`12857:636`);
- `04 Produto: operações, moderação e IA` (`12857:641`);
- `05 Ícones de navegação e status` (`12857:646`);
- `06 Assets e ilustrações base` (`12857:651`);
- `07 Dados e visualizações` (`12857:656`);
- `08 Patterns públicos e dashboard` (`12857:661`);
- `09 Patterns administrativos` (`12857:666`);
- `10 Patterns de paciente` (`12857:671`);
- `11 Patterns de terapeuta` (`12857:676`);
- `12 Metadados e checklist AI-friendly` (`12857:681`).

Componentes recentes refinados em `Design System / Recent Product Components` (`12829:626`), auditados em 2026-06-16:

- `Product/AuraPriorityOfDay` (`12829:632`);
- `Data/AuraMonthlyComparison` (`12829:648`);
- `Data/ProfileTrafficPaths` (`12829:682`);
- `Product/PatientHeroProfile` (`12829:715`);
- `Product/SessionMemoryTable` (`12829:753`);
- `Product/UpcomingAppointments` (`12829:784`);
- `Data/RevenueEvolutionChart` (`12829:815`);
- `Product/FinancialTransactionsTable` (`12829:831`);
- `Product/PayoutCalendar` (`12829:870`);
- `Product/RecentPayouts` (`12829:887`);
- `Product/PublicProfilePreview` (`12829:907`);
- `Product/ServicePlusCard` (`12829:955`).

Componentes públicos premium adicionados em `Design System / Premium Public Components` (`12927:624`), auditados em 2026-06-17:

- `Product/TherapistCard/Premium` (`12927:629`);
- `Molecules/FAQAccordion/Premium` (`12927:661`).

Status da seção recente:

- 12 componentes mestres preservados;
- todos com auto-layout no componente principal;
- todos com descrição no painel Figma;
- refinamento visual usando estilos `TES/*`;
- QA estrutural final com 0 overflow, 0 fontes ausentes e 0 frames de texto colapsados.

Status da seção premium pública:

- 2 componentes mestres preservados como evolução dos frames refinados;
- todos com auto-layout no componente principal;
- todos com descrição no painel Figma;
- tokens TES aplicados em fills, strokes, radius, sombras, espaçamentos e tamanhos de texto;
- QA estrutural com 0 fontes ausentes, 0 textos colapsados e 0 nomes genéricos.

Tokens de cor que devem guiar qualquer novo componente:

- `color.primitive.purple.500 = #6C3D91`;
- `color.primitive.cyan.500 = #81BAE0`.

Observação: componentes listados nas tabelas abaixo que não aparecem na lista publicada ainda continuam como backlog de produto/código. Componentes publicados na Fase 2 devem ser implementados no Storybook conforme `FIGMA_STORYBOOK_SYNC_MAP.md`.

## Base

| Componente     | Prioridade | Objetivo                                    | Uso                                             | Variações                                                                             | Estados                                  | Props                                               |
| -------------- | ---------: | ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `Button`       |         P0 | Executar ações.                             | Todas as áreas.                                 | primary, gradient, secondary, ghost, subtle, danger, link, iconLeading, iconTrailing. | hover, focus, loading, disabled.         | `variant`, `size`, `loading`, `icon`, `fullWidth`.  |
| `IconButton`   |         P0 | Ação compacta.                              | Topbar, tabela, card.                           | ghost, outline, filled.                                                               | hover, focus, active, disabled.          | `icon`, `label`, `variant`, `size`.                 |
| `Card`         |         P0 | Agrupar conteúdo.                           | Todas.                                          | default, soft, elevated, selected, interactive.                                       | hover, selected, disabled, loading.      | `variant`, `padding`, `interactive`.                |
| `HeroCard`     |         P0 | Contexto visual.                            | Público e dashboards.                           | public, dashboard, compact, premium.                                                  | loading, imageFallback.                  | `title`, `subtitle`, `image`, `actions`, `profile`. |
| `AppSidebar`   |         P0 | Navegação logada.                           | Paciente e terapeutas.                          | patient, basic, pro, plus, compact.                                                   | active, collapsed, badge.                | `items`, `profile`, `collapsed`, `supportCard`.     |
| `AdminSidebar` |         P0 | Navegação interna.                          | Admin.                                          | default, compact.                                                                     | active, collapsed, badge.                | `items`, `collapsed`.                               |
| `Topbar`       |         P0 | Ações globais.                              | Apps.                                           | default, admin, minimal.                                                              | notification, menu open.                 | `user`, `notifications`, `actions`.                 |
| `PublicHeader` |         P0 | Navegação pública.                          | Público.                                        | transparent, solid, mobile.                                                           | scrolled, menu open.                     | `links`, `cta`, `user`.                             |
| `Tabs`         |         P0 | Alternar contexto.                          | Sessões, pagamentos, favoritos.                 | default, pill, underline.                                                             | active, disabled.                        | `items`, `value`, `onChange`.                       |
| `Badge`        |         P0 | Status e categorias.                        | Todas.                                          | status, therapy, plan, count, soft.                                                   | success, warning, danger, info, neutral. | `variant`, `tone`, `icon`.                          |
| `Avatar`       |         P0 | Identidade.                                 | Cards, chat, listas.                            | image, initials, stacked.                                                             | fallback, online.                        | `src`, `name`, `size`, `status`.                    |
| `Input`        |         P0 | Texto curto.                                | Forms e busca.                                  | text, email, password, search.                                                        | error, success, disabled.                | `label`, `hint`, `error`, `leftIcon`.               |
| `Textarea`     |         P0 | Texto longo.                                | Perfil, serviços, suporte.                      | default, AI-assisted.                                                                 | error, disabled, characterCount.         | `label`, `maxLength`, `suggestion`.                 |
| `Select`       |         P0 | Escolha simples.                            | Filtros e forms.                                | default, searchable.                                                                  | open, disabled, error.                   | `options`, `value`, `placeholder`.                  |
| `Checkbox`     |         P0 | Seleção múltipla.                           | Jornada, filtros, tabelas.                      | default, card.                                                                        | checked, indeterminate, disabled.        | `label`, `description`, `checked`.                  |
| `Toggle`       |         P0 | Preferência on/off.                         | Configurações.                                  | default, compact.                                                                     | on, off, disabled.                       | `checked`, `label`.                                 |
| `TESDialog`    |         P1 | Decisão crítica com overlay e foco seguros. | Formulários, cancelamento, confirmação e Admin. | default, danger, form.                                                                | open, loading.                           | `title`, `description`, `onClose`, `children`.      |
| `Drawer`       |         P1 | Detalhe sem sair da lista.                  | Serviços, Admin, pacientes.                     | right, bottomMobile.                                                                  | open, loading.                           | `title`, `content`, `actions`.                      |
| `Toast`        |         P1 | Feedback breve.                             | Todas.                                          | success, info, warning, danger.                                                       | timed, persistent.                       | `title`, `description`, `tone`.                     |
| `Tooltip`      |         P1 | Explicar ícone.                             | Métricas e ações.                               | default, rich.                                                                        | open.                                    | `content`, `placement`.                             |
| `Accordion`    |         P0 | FAQ e detalhes.                             | Público e ajuda.                                | default, compact.                                                                     | expanded.                                | `items`.                                            |
| `Skeleton`     |         P0 | Loading.                                    | Todas.                                          | text, card, table, chart.                                                             | animated.                                | `shape`, `lines`.                                   |
| `EmptyState`   |         P0 | Estado vazio com ação.                      | Todas.                                          | neutral, supportive, upgrade.                                                         | default.                                 | `title`, `description`, `action`, `illustration`.   |

## Produto

| Componente               | Prioridade | Objetivo                                                                             | Onde                                                                        | Variações                                       | Estados                                        | Props                                                                                               | Perfil              |
| ------------------------ | ---------: | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- |
| `OfficialLogo`           |         P0 | Representar a marca oficial.                                                         | Header, footer, docs e páginas públicas.                                    | horizontal.                                     | default.                                       | `asset`, `alt`, `size`.                                                                             | Todos.              |
| `TherapyCard`            |         P0 | Apresentar terapia.                                                                  | Home, terapias, resultado, favoritos.                                       | grid, result, compact, saved.                   | selected, recommended, unavailable.            | `name`, `description`, `image`, `tags`, `therapistCount`, `cta`.                                    | Público/Paciente.   |
| `TherapyVisualCard`      |         P0 | Apresentar terapia em catálogo visual.                                               | `/terapias`, favoritos de terapias, recomendações da jornada.               | default, recommended, saved, unavailable.       | loading, focused, unavailable.                 | `name`, `description`, `image`, `icon`, `cta`.                                                      | Público/Paciente.   |
| `TherapistCard`          |         P0 | Apresentar terapeuta.                                                                | Home, busca, favoritos.                                                     | grid, list, compact, premium.                   | favorite, unavailable, loading.                | `name`, `photo`, `title`, `therapies`, `rating`, `nextSlot`, `price`, `cta`.                        | Público/Paciente.   |
| `TherapistCard/Premium`  |         P0 | Apresentar terapeuta com hierarquia premium e maior confiança visual.                | Busca pública, favoritos e recomendações destacadas.                        | premium.                                        | favorite, loading, unavailable, focus.         | `name`, `photo`, `title`, `therapies`, `rating`, `reviews`, `nextSlot`, `price`, `cta`, `verified`. | Público/Paciente.   |
| `TherapistResultCard`    |         P0 | Apresentar terapeuta em resultado horizontal.                                        | `/terapeutas`, busca, favoritos, recomendações.                             | default, compact, unavailable.                  | loading, focused, unavailable.                 | `name`, `photo`, `title`, `description`, `tags`, `rating`, `nextSlot`, `price`, `actions`.          | Público/Paciente.   |
| `FavoriteTherapistList`  |         P0 | Listar terapeutas salvos.                                                            | `/app/favoritos/terapeutas`.                                                | grid, list, compact.                            | empty, loading, removed.                       | `items`, `onRemove`, `onSchedule`, `onOpenProfile`.                                                 | Paciente.           |
| `FavoriteTherapyList`    |         P0 | Listar terapias salvas.                                                              | `/app/favoritos/terapias`.                                                  | grid, list, compact.                            | empty, loading, removed.                       | `items`, `onRemove`, `onOpenTherapy`.                                                               | Paciente.           |
| `MatchingQuestionCard`   |         P0 | Capturar Tema e Interesse da jornada.                                                | `/sua-jornada`.                                                             | theme, interest.                                | selected, disabled, maxReached.                | `title`, `description`, `image`, `selected`.                                                        | Público/Paciente.   |
| `JourneyResultCard`      |         P0 | Recomendar caminho.                                                                  | `/sua-jornada/resultado`.                                                   | high, medium, exploratory.                      | loading, saved.                                | `therapy`, `alignmentLabel`, `benefits`, `therapistCount`.                                          | Público/Paciente.   |
| `JourneyResultCard/Wide` |         P0 | Recomendar caminho em layout horizontal amplo.                                       | `/sua-jornada/resultado`.                                                   | high, medium, exploratory.                      | loading, saved.                                | `therapy`, `alignmentLabel`, `description`, `therapistCount`, `cta`.                                | Público/Paciente.   |
| `JourneyStepCard`        |         P0 | Explicar passo da jornada.                                                           | `/como-funciona`, onboarding e jornada.                                     | numbered.                                       | default, focused.                              | `step`, `title`, `description`, `icon`.                                                             | Público/Paciente.   |
| `JourneyDetailCard`      |         P0 | Explicar detalhe educacional.                                                        | `/como-funciona`, ajuda e suporte público.                                  | default.                                        | default, focused.                              | `title`, `description`, `icon`, `href`.                                                             | Público/Paciente.   |
| `FAQAccordion`           |         P0 | Exibir pergunta frequente expansível.                                                | FAQ público, terapia detalhe e ajuda.                                       | default, compact.                               | collapsed, expanded, focused.                  | `question`, `answer`, `expanded`.                                                                   | Público/Paciente.   |
| `FAQAccordion/Premium`   |         P0 | Exibir bloco de dúvidas frequentes com intro, pergunta expandida e apoio contextual. | Home pública, landing de terapeutas, páginas de terapia e central de ajuda. | premiumSection.                                 | collapsed, expanded, focused.                  | `eyebrow`, `title`, `description`, `items`, `supportCta`.                                           | Público/Paciente.   |
| `BookingStepper`         |         P0 | Conduzir reserva.                                                                    | `/reserva`.                                                                 | service, schedule, account, payment, review.    | activeStep, completed, blocked, loading.       | `steps`, `currentStep`, `completedSteps`, `onStepChange`.                                           | Público/Paciente.   |
| `ReservationSummary`     |         P0 | Resumir reserva.                                                                     | Reserva e detalhe.                                                          | compact, sticky, success.                       | slotExpired, paymentPending, confirmed.        | `therapist`, `service`, `slot`, `price`, `status`.                                                  | Público/Paciente.   |
| `ServiceCard`            |         P0 | Mostrar serviço.                                                                     | Perfil e painéis.                                                           | public, editable, tableRow.                     | active, paused, limited, locked.               | `name`, `duration`, `price`, `format`, `description`, `status`.                                     | Terapeuta.          |
| `AvailabilityPicker`     |         P0 | Escolher horário.                                                                    | Agendamento e agenda.                                                       | publicBooking, therapistEditor.                 | noSlots, selected, conflict.                   | `dates`, `slots`, `timezone`, `selected`.                                                           | Público/Terapeuta.  |
| `SessionCard`            |         P0 | Resumir sessão.                                                                      | Paciente e terapeuta.                                                       | patient, therapist, admin.                      | live, confirmed, pending, completed, canceled. | `session`, `primaryAction`, `secondaryActions`.                                                     | Todos logados.      |
| `SessionDetail`          |         P0 | Detalhar sessão.                                                                     | Paciente e Admin.                                                           | patient, therapist, admin.                      | live, pendingPayment, canceled.                | `session`, `participant`, `timeline`, `policies`.                                                   | Todos logados.      |
| `MessageThread`          |         P0 | Conversar.                                                                           | Mensagens.                                                                  | patient, therapist, support.                    | unread, archived, sending, failed.             | `conversation`, `messages`, `composerActions`.                                                      | Todos logados.      |
| `PaymentSummary`         |         P0 | Mostrar valores.                                                                     | Paciente, terapeuta, Admin.                                                 | simple, complete, admin.                        | paid, pending, refund, failed.                 | `amounts`, `transactions`, `nextPayout`.                                                            | Todos logados.      |
| `SettingsNav`            |         P0 | Navegar configurações.                                                               | Paciente, terapeutas, Admin.                                                | patient, therapist, admin.                      | active, disabled, dirty.                       | `items`, `activeItem`, `badges`.                                                                    | Todos logados.      |
| `ReviewCard`             |         P1 | Mostrar avaliação.                                                                   | Público, Pro, Plus, Admin.                                                  | public, replyable, moderation.                  | pendingReply, reported, hidden.                | `rating`, `comment`, `author`, `reply`, `actions`.                                                  | Pro/Plus/Admin.     |
| `PlanCard`               |         P0 | Comparar planos.                                                                     | Público, Básico, Pro.                                                       | basic, pro, plus, current, recommended.         | selected, current, disabled.                   | `plan`, `price`, `features`, `cta`, `badge`.                                                        | Público/Básico/Pro. |
| `PlanFeatureComparison`  |         P0 | Comparar recursos por plano.                                                         | `/para-terapeutas`, planos e upgrade contextual.                            | public, upgrade.                                | default, compact, loading.                     | `plans`, `features`, `highlightPlan`.                                                               | Público/Básico/Pro. |
| `ComparisonTable`        |         P0 | Comparar recursos.                                                                   | Planos e upgrade.                                                           | public, internal.                               | default.                                       | `plans`, `features`.                                                                                | Público/Básico/Pro. |
| `ProfileChecklist`       |         P0 | Melhorar perfil.                                                                     | Terapeutas.                                                                 | basic, pro, plus.                               | complete, incomplete, locked.                  | `items`, `progress`, `cta`.                                                                         | Terapeuta.          |
| `UpgradeBanner`          |         P0 | Sugerir evolução.                                                                    | Básico e Pro.                                                               | basicToPro, basicToPlus, proToPlus, contextual. | dismissed, loading.                            | `title`, `description`, `features`, `cta`.                                                          | Básico/Pro.         |
| `MetricCard`             |         P0 | Mostrar indicador.                                                                   | Dashboards.                                                                 | default, trend, status, premium.                | up, down, neutral, noData.                     | `label`, `value`, `trend`, `description`, `icon`.                                                   | Pro/Plus/Admin.     |
| `InsightCard`            |         P1 | Explicar dado.                                                                       | Pro, Plus, Admin.                                                           | recommendation, observation, opportunity.       | unread, applied.                               | `title`, `description`, `action`, `tone`.                                                           | Pro/Plus/Admin.     |
| `AIRecommendationCard`   |         P1 | Sugerir melhoria assistida.                                                          | Plus.                                                                       | profile, service, agenda.                       | applied, dismissed, loading.                   | `recommendation`, `reason`, `action`.                                                               | Plus.               |
| `AIAssessorPanel`        |         P1 | Organizar sugestões de IA.                                                           | `/terapeuta/assessor-ia`.                                                   | profile, services, presence, replies.           | loading, generated, applied, unavailable.      | `context`, `suggestions`, `reviewRequired`.                                                         | Premium Plus.       |
| `PlusPatientJourney`     |         P1 | Mostrar histórico operacional.                                                       | `/terapeuta/pacientes/:slug-do-paciente`.                                   | timeline, patientSummary, allowedActions.       | empty, restricted, loading.                    | `patient`, `events`, `allowedActions`, `privacyLevel`.                                              | Premium Plus.       |
| `Heatmap`                |         P1 | Mostrar procura por horário/tema.                                                    | Pro, Plus, Admin.                                                           | simple, advanced.                               | noData.                                        | `xAxis`, `yAxis`, `values`, `legend`.                                                               | Pro/Plus/Admin.     |
| `WordCloud`              |         P2 | Mostrar palavras percebidas.                                                         | Plus avaliações.                                                            | sentiment, profile.                             | noData.                                        | `words`, `tone`.                                                                                    | Plus.               |
| `AdminModerationQueue`   |         P1 | Priorizar revisão.                                                                   | Admin.                                                                      | professionals, reviews, reports.                | empty, critical.                               | `items`, `filters`, `actions`.                                                                      | Admin.              |
| `VerificationPanel`      |         P1 | Validar terapeuta.                                                                   | Admin.                                                                      | document, profile, certification.               | pending, approved, rejected.                   | `documents`, `checklist`, `decisionActions`.                                                        | Admin.              |
| `IntegrationStatusCard`  |         P2 | Mostrar saúde externa.                                                               | Admin.                                                                      | payment, video, email, analytics.               | operational, degraded, down.                   | `name`, `status`, `lastCheck`, `actions`.                                                           | Admin.              |

## Por Área

- Público: `OfficialLogo`, `PublicHeader`, `PublicFooter`, `HeroCard`, `TherapyCard`, `TherapyVisualCard`, `TherapistCard`, `TherapistResultCard`, `MatchingQuestionCard`, `JourneyResultCard`, `JourneyResultCard/Wide`, `JourneyStepCard`, `JourneyDetailCard`, `FAQAccordion`, `BookingStepper`, `ReservationSummary`, `PlanCard`.
- Paciente: `AppSidebar`, `Topbar`, `SessionCard`, `SessionDetail`, `MessageThread`, `FavoriteTherapistList`, `FavoriteTherapyList`, `PaymentSummary`, `SettingsNav`.
- Básico: `ProfileChecklist`, `PlanCard`, `UpgradeBanner`, `ServiceCard`, `PaymentSummary`, `AvailabilityPicker`, `BlockedFeature`.
- Pro: `MetricCard`, `DataTable`, `ReviewCard`, `FinanceSummary`, `InsightCard`, `PlanCard`.
- Plus: `AIRecommendationCard`, `AIAssessorPanel`, `PlusPatientJourney`, `InsightCard`, `Heatmap`, `WordCloud`.
- Plus recentes: `AuraPriorityOfDay`, `AuraMonthlyComparison`, `ProfileTrafficPaths`, `RevenueEvolutionChart`, `FinancialTransactionsTable`, `PayoutCalendar`, `RecentPayouts`, `ServicePlusCard`.
- Admin: `AdminSidebar`, `AdminKPIGrid`, `AdminModerationQueue`, `VerificationPanel`, `TransactionTable`, `IntegrationStatusCard`, `RuleBuilder`.

## Fase 2 por Área

- Público: `Pattern/PublicHero`, `Pattern/TherapistSearchResults`, `Pattern/MatchingQuestionGrid`, `Product/PatientJourneyTimeline`, `Product/PlanFeatureComparison`, `Icon/Journey/24`.
- Paciente: `Pattern/PatientOverview`, `Pattern/PatientSessionDetail`, `Pattern/ChatLayout`, `Pattern/SettingsLayout`, `Product/SessionCard`, `Product/NextSessionBlock`, `Product/PaymentSummary`.
- Básico: `Pattern/TherapistDashboard`, `Product/ProfileChecklist`, `Product/UpgradeBanner`, `Product/ServiceCard`.
- Pro: `Pattern/ProMetricsDashboard`, `Data/KPICard`, `Data/MetricComparisonCard`, `Data/LineChart`, `Data/BarChart`.
- Plus: `Pattern/PlusInsightsDashboard`, `Product/AIInsightPanel`, `Data/DonutProgress`, `Data/Heatmap`, `Data/RatingSummary`.
- Admin: `Pattern/AdminOverview`, `Pattern/AdminTableWithSidePanel`, `Pattern/VerificationReview`, `Product/VerificationPanel`, `Product/ModerationQueue`, `Product/PatientRow`.

## Fase 3 — Consolidação Pública

- `Brand/OfficialLogo` (`12548:140`) usa `docs/design-system/assets/logo-oficial-terapeuta-eu-sou.png`.
- `Organisms/Public Footer` (`12548:142`) substitui footers locais recorrentes.
- `Molecules/FAQAccordion` (`12548:162`) cobre linhas de FAQ.
- `Product/JourneyStepCard` (`12548:165`) e `Product/JourneyDetailCard` (`12548:170`) cobrem `/como-funciona`.
- `Product/JourneyResultCard/Wide` (`12548:175`) cobre cards amplos de `/sua-jornada/resultado`.

## Regras

- Não criar card dentro de card.
- Não usar roxo saturado em grandes áreas.
- Não usar lavanda claro como texto principal.
- Ícone isolado tem `aria-label` ou tooltip.
- Dados usam linguagem TES.
- Plus não mostra upgrade.
- Básico mostra financeiro operacional e não mostra avaliações ou métricas intermediárias como navegação principal.
- Assessora Aura é Premium Plus.
- Subpáginas só existem quando simplificam o uso.

## Estados Obrigatórios

Todo P0 implementa:

- Default.
- Loading.
- Empty quando aplicável.
- Error quando aplicável.
- Disabled quando interativo.
- Focus visible.
- Mobile/compact quando usado em layout responsivo.
