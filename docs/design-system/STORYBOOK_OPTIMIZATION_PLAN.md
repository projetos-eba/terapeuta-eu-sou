# Storybook Optimization Plan - Terapeuta Eu Sou

Data: 2026-06-14

## Objetivo

Criar um Storybook alinhado ao Figma, tokens e componentes reais do produto.

## Pré-requisito

Como Storybook não está instalado, a implementação exige instalação de dependências.

Sugestão:

```bash
npm create storybook@latest
```

Addons recomendados:

- `@storybook/addon-a11y`
- `@storybook/addon-viewport`
- `@storybook/addon-interactions`
- `@storybook/test-runner`

## Estrutura Recomendada

```txt
Foundations/
  Colors
  Typography
  Spacing
  Radius
  Shadows

Atoms/
  Button
  Badge
  FormControls
  BooleanControl

Molecules/
  NavigationItem
  Card
  Tabs

Organisms/
  PublicHeader
  AppSidebar
  AppTopbar

Product/
  TherapyCard
  TherapistCard
  JourneyResultCard
  MetricCard
  AIRecommendationCard
  CarefulBenchmark
  SessionCard
  NextSessionBlock
  SessionDetailPanel
  PaymentSummary
  PlanCard
  ProfileChecklist
  UpgradeBanner
  ServiceCard
  ReviewCard
  PatientRow
  VerificationPanel
  ModerationQueue
  AIInsightPanel
  PatientJourneyTimeline

Icons/
  Library

Assets/
  IllustrationTile
  SoftDivider
  HeroImageMask
  SidebarBloom

Data/
  ChartContainer
  LineChart
  BarChart
  DonutProgress
  MiniSparkline
  ProgressBar
  KPICard
  MetricComparisonCard
  Heatmap
  RatingSummary
  EmptyChartState
  LoadingChartState

Patterns/
  PublicHero
  TherapistSearchResults
  MatchingQuestionGrid
  DashboardMetricsGrid
  PatientOverview
  PatientSessionDetail
  ChatLayout
  SettingsLayout
  TherapistDashboard
  ProMetricsDashboard
  PlusInsightsDashboard
  TherapistProfileEditor
  AdminOverview
  AdminTableWithSidePanel
  VerificationReview

Templates/
  DashboardShell
```

## Tokens Críticos

Antes de criar stories, alinhar as variáveis de cor com a versão atual do Figma:

| Token | Valor |
|---|---:|
| `color.primitive.purple.500` | `#6C3D91` |
| `color.primitive.cyan.500` | `#81BAE0` |
| `color.semantic.action.primary.default` | `#6C3D91` |
| `color.semantic.profile.patient` | `#81BAE0` |

## Stories Obrigatórias

Para cada P0:

- `Overview`
- `Playground`
- `Variants`
- `States`
- `Sizes`, quando aplicável
- `Disabled`
- `Loading`, quando aplicável
- `Error`, quando aplicável
- `Empty`, quando aplicável
- `Accessibility`
- `WithLongText`
- `Mobile`

Para `Data/*`, adicionar também:

- `Empty`
- `Loading`
- `WithSummaryText`
- `ColorBlindSafe`
- `ReducedData`

Para `Icons/Library`, adicionar:

- `AllIcons`
- `Sizes`
- `StatusIcons`
- `NavigationIcons`
- `AccessibleLabels`

## Ordem de Implementação

1. Expandir tokens em `globals.css` e `tailwind.config.ts`.
2. Criar atoms: `Button`, `Badge`, `FormControls`, `BooleanControl`.
3. Criar molecules: `NavigationItem`, `Card`, `Tabs`, `FilterBar`, `SearchWithFilters`, `RightRail`, `SupportCard`, `PolicyCard`, `SaveBar`, `FloatingHelpButton`.
4. Criar organisms: `PublicHeader`, `AppSidebar`, `AppTopbar`.
5. Criar `Icon/*` e `Asset/*`.
6. Criar `Data/*`, com resumo textual acessível.
7. Criar componentes de produto validados no Figma.
8. Criar patterns compostos por perfil.
9. Criar stories e docs.
10. Adicionar testes de acessibilidade.
11. Mapear props para variants do Figma.

## Regras Técnicas

- Não hardcode valores que são tokens.
- Props devem refletir variants do Figma.
- Variants sem uso real não entram.
- Storybook deve usar a mesma linguagem TES do Figma.
- Plus não deve renderizar upgrade.
- Dados não devem usar linguagem de performance agressiva.
- `Data/*` deve ter título, legenda ou resumo textual.
- `Icon/*` deve aceitar `aria-label` quando usado sem texto visível.
- Patterns não devem duplicar lógica: compor atoms, molecules, product components e data components.

## Backlog Fase 2

P0 para alinhar com o Figma expandido:

- `Molecules/FilterBar`
- `Molecules/SearchWithFilters`
- `Organisms/AppTopbar`
- `Product/SessionCard`
- `Product/NextSessionBlock`
- `Product/ProfileChecklist`
- `Product/UpgradeBanner`
- `Data/KPICard`
- `Data/ChartContainer`
- `Data/LineChart`
- `Data/BarChart`
- `Data/EmptyChartState`
- `Icons/Library`

P1:

- `Product/PaymentSummary`
- `Product/PlanCard`
- `Product/ServiceCard`
- `Product/ReviewCard`
- `Product/PatientJourneyTimeline`
- `Data/DonutProgress`
- `Data/ProgressBar`
- `Data/Heatmap`
- `Pattern/PatientOverview`
- `Pattern/TherapistDashboard`
- `Pattern/ProMetricsDashboard`
- `Pattern/PlusInsightsDashboard`
- `Pattern/AdminOverview`

P2:

- `Product/VerificationPanel`
- `Product/ModerationQueue`
- `Pattern/AdminTableWithSidePanel`
- `Pattern/VerificationReview`
- `Pattern/ChatLayout`
- `Pattern/SettingsLayout`
- `Asset/*`

## Critério de Aceite

- Todos os componentes P0 têm stories.
- A11y addon não aponta falhas críticas de contraste/foco.
- Mobile é validado em viewport.
- Estados loading, empty e error existem onde aplicável.
- Tabela de sync Figma/Storybook/Código está atualizada.
