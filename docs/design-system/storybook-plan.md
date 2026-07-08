# Plano de Storybook

Storybook valida tokens, componentes, estados, responsividade, acessibilidade e diferenças por perfil antes das telas finais.

## Estrutura

```txt
Foundations/
  Colors
  Typography
  Spacing
  Radius
  Shadows
  Icons
  Illustrations

Atoms/
  Button
  Badge
  FormControls
  BooleanControl

Molecules/
  NavigationItem
  Card
  Tabs
  FilterBar
  SearchWithFilters
  RightRail
  SupportCard
  PolicyCard
  SaveBar
  FloatingHelpButton

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

Essa estrutura reflete a página `Design System` atual no Figma, incluindo o frame `Design System / Phase 2 Expansion`. Componentes do inventário amplo que ainda não foram publicados ficam como backlog, não como obrigação imediata do Storybook.

## Tokens Críticos

Stories de foundation devem começar pela paleta atual:

| Token | Valor | Uso |
|---|---:|---|
| `color.primitive.purple.500` | `#6C3D91` | CTA, navegação ativa e identidade |
| `color.primitive.cyan.500` | `#81BAE0` | Acento humano, paciente e dados leves |
| `color.semantic.action.primary.default` | `#6C3D91` | Botão primário e estados ativos |
| `color.semantic.profile.patient` | `#81BAE0` | Experiência do paciente |

## Stories Obrigatórias

Todo componente P0:

- `Default`
- `Hover`
- `FocusVisible`
- `Loading`
- `Disabled`
- `Error`, quando aplicável
- `Empty`, quando aplicável
- `Mobile`
- `WithLongText`
- `WithReducedMotion`, quando houver animação

Componentes com permissão por plano:

- `BasicAllowed`
- `BasicBlocked`
- `ProAllowed`
- `ProUpgradeToPlus`
- `PlusAllowed`

Componentes de dados:

- `Empty`
- `Loading`
- `WithSummaryText`
- `ColorBlindSafe`
- `ReducedData`

Ícones:

- `AllIcons`
- `Sizes`
- `NavigationIcons`
- `StatusIcons`
- `AccessibleLabels`

## Foundations

### Colors

Stories: `BrandPalette`, `SurfacePalette`, `TextPalette`, `StatusPalette`, `ProfilePalette`, `GradientPalette`, `ContrastPairs`.

Critério: mostra token, valor, uso, amostra e status `inferido`.

### Typography

Stories: `DisplayScale`, `DashboardHeadings`, `BodyText`, `LabelsAndMicrocopy`, `BadgesAndTables`, `HumanDataCopy`.

Critério: compara títulos públicos, dashboards e tabelas. Inclui palavra em ciano/itálico.

### Icons and Illustrations

Stories: `IconSizes`, `IconTones`, `TherapeuticIllustrationUsage`, `EmptyStateIllustrations`.

Critério: ícone isolado tem label/tooltip. Ilustração não compete com CTA.

## Base

### Button

Stories: `Primary`, `Secondary`, `Ghost`, `Subtle`, `Danger`, `WithIcon`, `Loading`, `FullWidthMobile`.

Critério: primary usa `gradient.brand.cta`. CTA público usa textos como “Começar minha jornada” e “Ver terapeutas”.

### Card

Stories: `Default`, `Interactive`, `Selected`, `SoftLavender`, `PremiumPlus`, `AdminDense`, `Loading`.

Critério: radius, borda e sombra vêm de `tokens.md`.

### DataTable

Stories: `Default`, `WithFilters`, `WithStatus`, `AdminDense`, `MobileCards`, `Empty`, `Loading`.

Critério: cabeçalhos claros, status com texto e mobile em cards.

## Produto Público

- `TherapyCard`: `Default`, `Highlighted`, `JourneyResultHighAlignment`, `Saved`, `NoTherapistsAvailable`.
- `TherapyVisualCard`: `Default`, `Recommended`, `Saved`, `Unavailable`, `Loading`, `KeyboardFocus`, `MobileGrid`.
- `TherapistCard`: `Grid`, `List`, `Premium`, `Favorited`, `NoAvailability`, `PlanBadge`.
- `TherapistSearchResults`: `Default`, `WithFilters`, `Empty`, `Loading`, `Mobile`.
- `PublicHero`: `Default`, `WithSecondaryCTA`, `Mobile`.
- `MatchingQuestionCard`: `Category`, `Selected`, `MaxReached`, `Subcategory`, `Mobile`.
- `MatchingQuestionGrid`: `Default`, `SelectedOptions`, `MaxReached`, `Mobile`.
- `JourneyResultCard`: `HighAlignment`, `MediumAlignment`, `Exploratory`, `LoadingEmotional`, `EmptyResult`.
- `BookingStepper`: `ChooseService`, `ChooseTime`, `AccountAfterTimeSelected`, `Payment`, `SlotExpired`, `Mobile`.
- `ReservationSummary`: `BeforePayment`, `PaymentPending`, `ConfirmedOnlineSession`, `SlotExpired`, `MobileSticky`.

## Produto Paciente

- `FavoriteTherapistList`: `WithTherapists`, `Empty`, `RemovedFeedback`, `Mobile`.
- `FavoriteTherapyList`: `WithTherapies`, `Empty`, `RemovedFeedback`, `Mobile`.
- `SessionCard`: `Upcoming`, `LiveNow`, `PendingPayment`, `Completed`, `Canceled`, `Mobile`.
- `NextSessionBlock`: `Upcoming`, `Today`, `NoSession`, `Mobile`.
- `PatientOverview`: `WithNextSession`, `WithoutSession`, `WithSupport`, `Mobile`.
- `PatientSessionDetail`: `Confirmed`, `PendingPayment`, `Rescheduled`, `Canceled`.
- `MessageThread`: `PatientTherapist`, `Support`, `Empty`, `Sending`, `Failed`, `WithAttachment`.
- `ChatLayout`: `PatientTherapist`, `Support`, `Empty`, `Mobile`.
- `SettingsNav`: `PatientSettings`, `TherapistSettings`, `WithUnsavedChanges`, `MobileTabs`.
- `SettingsLayout`: `Profile`, `Security`, `Payments`, `DirtyState`, `Mobile`.

## Produto Terapeuta

- `TherapistResultCard`: `Default`, `Compact`, `Unavailable`, `Loading`, `WithLongSpecialty`, `WithLongLocation`, `KeyboardFocus`, `MobileStacked`.
- `ProfileChecklist`: `BasicIncomplete`, `BasicComplete`, `Pro`, `PlusWithAI`.
- `UpgradeBanner`: `BasicToPro`, `BasicToPlus`, `ProToPlus`, `Dismissed`.
- `PlanFeatureComparison`: `PublicPlans`, `CompactUpgrade`, `WithHighlightedPlan`, `Loading`, `MobileStacked`, `AccessibleLabels`.
- `MetricCard`: `Default`, `PositiveTrend`, `NeutralTrend`, `WarningTrend`, `NoData`, `HumanCopy`.
- `TherapistDashboard`: `Basic`, `WithProfileChecklist`, `WithUpgrade`, `Mobile`.
- `ProMetricsDashboard`: `Default`, `NoData`, `Loading`, `Mobile`.
- `PlusInsightsDashboard`: `Default`, `WithAIInsight`, `NoData`, `Mobile`.
- `TherapistProfileEditor`: `Default`, `UnsavedChanges`, `WithAISuggestion`, `Mobile`.

## Consolidação Pública — Fase 3

- `OfficialLogo`: `Horizontal`, `HeaderUsage`, `FooterUsage`, `TransparentBackground`.
- `PublicFooter`: `Default`, `CompactHeight`, `WithOfficialLogo`, `MobileStacked`.
- `FAQAccordion`: `Collapsed`, `Expanded`, `Focused`, `LongQuestion`.
- `JourneyStepCard`: `StepOne`, `StepTwo`, `StepThree`, `StepFour`, `MobileStacked`.
- `JourneyDetailCard`: `Default`, `WithChevron`, `Focused`, `LongCopy`.
- `JourneyResultCardWide`: `HighAlignment`, `MediumAlignment`, `Exploratory`, `Loading`, `Saved`.

## Produto Plus

- `AIRecommendationCard`: `ProfileDescription`, `ServiceDescription`, `AgendaSuggestion`, `Applied`, `Dismissed`.
- `AIAssessorPanel`: `ProfileReview`, `ServiceDescription`, `PresenceSuggestions`, `Loading`, `Unavailable`, `ReviewBeforeApply`.
- `PlusPatientJourney`: `Timeline`, `EmptyHistory`, `RestrictedInformation`, `AllowedAction`, `Mobile`.
- `Heatmap`: `DemandByHour`, `DemandByTheme`, `NoData`, `Mobile`.
- `WordCloud`: `ReviewWords`, `NoData`, `Mobile`.

## Produto Admin

- `AdminModerationQueue`: `ProfessionalsPending`, `ReviewsReported`, `PaymentsAttention`, `Empty`, `Critical`.
- `VerificationPanel`: `PendingDocuments`, `Approved`, `Rejected`, `RequestChanges`.
- `AdminOverview`: `Default`, `WithAttentionQueue`, `EmptyData`, `Mobile`.
- `AdminTableWithSidePanel`: `Default`, `SelectedRow`, `Loading`, `MobileCards`.
- `VerificationReview`: `Pending`, `NeedsAdjustment`, `Approved`.

## Dados e Visualizações

- `ChartContainer`: `Default`, `WithActions`, `Empty`, `Loading`.
- `LineChart`: `PeopleInterested`, `PathsToScheduling`, `NoData`, `Loading`.
- `BarChart`: `ByService`, `ByDay`, `NoData`, `Mobile`.
- `DonutProgress`: `ProfileClarity`, `Reputation`, `NoData`.
- `MiniSparkline`: `Positive`, `Neutral`, `NoData`.
- `ProgressBar`: `ProfileCompletion`, `PlanUsage`, `Loading`.
- `KPICard`: `PeopleInterested`, `SessionsScheduled`, `MessagesStarted`, `NoData`.
- `MetricComparisonCard`: `CarefulReference`, `InsufficientData`, `Loading`.
- `Heatmap`: `DemandByHour`, `DemandByDay`, `NoData`.
- `RatingSummary`: `Default`, `NoReviews`, `WithDistribution`.
- `EmptyChartState`: `NoDataYet`, `InsufficientData`, `FilteredOut`.
- `LoadingChartState`: `Default`, `ReducedMotion`.

## Ordem de Implementação

1. Tokens e CSS Variables.
2. Atoms: Button, Badge, FormControls, BooleanControl.
3. Molecules: NavigationItem, Card, Tabs, FilterBar, SearchWithFilters, RightRail, SupportCard, PolicyCard, SaveBar, FloatingHelpButton.
4. Organisms: PublicHeader, PublicFooter, AppSidebar, AppTopbar.
5. Icons e Assets.
6. Data: ChartContainer, KPI, charts e estados de dados.
7. Produto: TherapyCard, TherapyVisualCard, TherapistCard, JourneyResultCard, JourneyResultCardWide, JourneyStepCard, JourneyDetailCard, MetricCard, AIRecommendationCard, CarefulBenchmark e componentes Fase 2/3.
8. Patterns por perfil.
9. Template: DashboardShell por perfil.
10. Backlog: componentes do inventário amplo ainda não publicados no Figma atual.

## Addons

- a11y.
- viewport.
- interactions/test runner.
- visual regression quando houver pipeline.
- autodocs para props.
- controls para plano, estado e perfil.

## Aceite

- Componentes P0 cobrem estados principais.
- Componentes com permissão mostram variação por plano.
- Interativos têm foco visível.
- Dados usam linguagem TES.
- Componentes críticos têm viewport mobile.
- Plus não renderiza upgrade.
- Básico mostra limites com cuidado.
