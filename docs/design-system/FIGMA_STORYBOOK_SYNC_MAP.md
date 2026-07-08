# Figma Storybook Sync Map - Terapeuta Eu Sou

Data: 2026-06-14

Status possíveis:

- `Figma Ready`
- `Code Partial`
- `Code Pending`
- `Storybook Pending`
- `Synced`

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Atoms/Button` | `Atoms/Button` | `Button.tsx` | color, gradient, spacing, radius, opacity | Storybook Pending |
| `Atoms/Form Controls` | `Atoms/FormControls` | `Input.tsx`, `Textarea.tsx`, `Select.tsx` | color, border, radius, typography | Storybook Pending |
| `Atoms/Badge` | `Atoms/Badge` | `Badge.tsx` | color, radius, typography | Storybook Pending |
| `Atoms/Boolean Control` | `Atoms/BooleanControl` | `Checkbox.tsx`, `Radio.tsx`, `Switch.tsx` | color, border, size, radius | Storybook Pending |
| `Molecules/Navigation Item` | `Molecules/NavigationItem` | `NavigationItem.tsx` | color, spacing, radius | Storybook Pending |
| `Molecules/Card` | `Molecules/Card` | `Card.tsx` | color, border, radius, shadow | Storybook Pending |
| `Molecules/Tabs` | `Molecules/Tabs` | `Tabs.tsx` | color, radius, spacing | Storybook Pending |
| `Organisms/Public Header` | `Organisms/PublicHeader` | `PublicHeader.tsx` | color, size, spacing | Storybook Pending |
| `Organisms/App Sidebar` | `Organisms/AppSidebar` | `AppSidebar.tsx` | color, size, spacing | Storybook Pending |
| `Product/TherapistCard` | `Product/TherapistCard` | `TherapistCard.tsx` | card, badge, button | Storybook Pending |
| `Product/TherapyCard` | `Product/TherapyCard` | `TherapyCard.tsx` | card, badge, button | Storybook Pending |
| `Product/JourneyResultCard` | `Product/JourneyResultCard` | `JourneyResultCard.tsx` | card, status, button | Storybook Pending |
| `Product/MetricCard` | `Product/MetricCard` | `MetricCard.tsx` | card, status, typography | Storybook Pending |
| `Product/AIRecommendationCard` | `Product/AIRecommendationCard` | `AIRecommendationCard.tsx` | plus color, card, badge | Storybook Pending |
| `Product/CarefulBenchmark` | `Product/CarefulBenchmark` | `CarefulBenchmark.tsx` | warning, card, typography | Storybook Pending |
| `Templates/Dashboard Shell` | `Templates/DashboardShell` | `DashboardShell.tsx` | sidebar, topbar, layout, profile colors | Storybook Pending |

## Fase 2 — Expansão

Atualização: 2026-06-15

Organização revisada em 2026-06-16: o frame `Design System / Componentes` (`12363:2`) foi separado em 12 prateleiras menores por domínio. Os componentes abaixo continuam como backlog de Storybook, mas a consulta no Figma deve priorizar os frames `01` a `12` dentro de `Design System / Componentes`.

Observação de localização: `Product/PlanFeatureComparison` existe em `Design System / Product Component Documentation`; `Product/TherapistResultCard` existe em `Documentation / Product / TherapistResultCard`; `Product/TherapyVisualCard` fica em `06 Assets e ilustrações base`.

### Components — Expanded

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Molecules/FilterBar` | `Molecules/FilterBar` | `FilterBar.tsx` | color, spacing, radius, border | Storybook Pending |
| `Molecules/SearchWithFilters` | `Molecules/SearchWithFilters` | `SearchWithFilters.tsx` | color, spacing, border, icon | Storybook Pending |
| `Molecules/RightRail` | `Layout/RightRail` | `RightRail.tsx` | surface, border, spacing | Storybook Pending |
| `Molecules/SupportCard` | `Molecules/SupportCard` | `SupportCard.tsx` | surface, primary, typography | Storybook Pending |
| `Molecules/PolicyCard` | `Molecules/PolicyCard` | `PolicyCard.tsx` | status, surface, border | Storybook Pending |
| `Molecules/SaveBar` | `Molecules/SaveBar` | `SaveBar.tsx` | surface, border, action | Storybook Pending |
| `Molecules/FloatingHelpButton` | `Molecules/FloatingHelpButton` | `FloatingHelpButton.tsx` | primary, surface, shadow | Storybook Pending |
| `Organisms/AppTopbar` | `Navigation/AppTopbar` | `AppTopbar.tsx` | surface, border, action, avatar | Storybook Pending |

### Product Components — Fase 2

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Product/SessionCard` | `Product/SessionCard` | `SessionCard.tsx` | card, badge, button, status | Storybook Pending |
| `Product/NextSessionBlock` | `Product/NextSessionBlock` | `NextSessionBlock.tsx` | surface, cyan, primary | Storybook Pending |
| `Product/SessionDetailPanel` | `Product/SessionDetailPanel` | `SessionDetailPanel.tsx` | surface, border, status | Storybook Pending |
| `Product/PaymentSummary` | `Product/PaymentSummary` | `PaymentSummary.tsx` | surface, border, action | Storybook Pending |
| `Product/PlanCard` | `Product/PlanCard` | `PlanCard.tsx` | plan, success, action | Storybook Pending |
| `Product/PlanFeatureComparison` | `Product/PlanFeatureComparison` | `PlanFeatureComparison.tsx` | surface, border, text, status, spacing, radius | Storybook Pending |
| `Product/TherapistResultCard` | `Product/TherapistResultCard` | `TherapistResultCard.tsx` | surface, border, text, action, spacing, radius, shadow | Storybook Pending |
| `Product/TherapyVisualCard` | `Product/TherapyVisualCard` | `TherapyVisualCard.tsx` | surface, border, text, action, purple, cyan, spacing, radius, shadow | Storybook Pending |
| `Product/ProfileChecklist` | `Product/ProfileChecklist` | `ProfileChecklist.tsx` | surface, success, border | Storybook Pending |
| `Product/UpgradeBanner` | `Product/UpgradeBanner` | `UpgradeBanner.tsx` | purple, surface, action | Storybook Pending |
| `Product/ServiceCard` | `Product/ServiceCard` | `ServiceCard.tsx` | card, badge, typography | Storybook Pending |
| `Product/ReviewCard` | `Product/ReviewCard` | `ReviewCard.tsx` | warning, card, button | Storybook Pending |
| `Product/PatientRow` | `Product/PatientRow` | `PatientRow.tsx` | table, avatar, status | Storybook Pending |
| `Product/VerificationPanel` | `Product/VerificationPanel` | `VerificationPanel.tsx` | status, admin, surface | Storybook Pending |
| `Product/ModerationQueue` | `Product/ModerationQueue` | `ModerationQueue.tsx` | status, admin, list | Storybook Pending |
| `Product/AIInsightPanel` | `Product/AIInsightPanel` | `AIInsightPanel.tsx` | plus, surface, action | Storybook Pending |
| `Product/PatientJourneyTimeline` | `Product/PatientJourneyTimeline` | `PatientJourneyTimeline.tsx` | primary, success, timeline | Storybook Pending |

### Icons, Assets e Dados

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Icon/*` | `Icons/Library` | `icons.tsx` | icon color, size | Storybook Pending |
| `Asset/IllustrationTile/*` | `Assets/IllustrationTile` | `IllustrationTile.tsx` | purple, cyan, surface | Storybook Pending |
| `Asset/SoftDivider` | `Assets/SoftDivider` | `SoftDivider.tsx` | border, purple, cyan | Storybook Pending |
| `Asset/HeroImageMask` | `Assets/HeroImageMask` | `HeroImageMask.tsx` | radius, surface | Storybook Pending |
| `Asset/SidebarBloom` | `Assets/SidebarBloom` | `SidebarBloom.tsx` | purple, cyan, opacity | Storybook Pending |
| `Data/ChartContainer` | `Data/ChartContainer` | `ChartContainer.tsx` | surface, border, spacing | Storybook Pending |
| `Data/LineChart` | `Data/LineChart` | `LineChart.tsx` | chart, purple, cyan | Storybook Pending |
| `Data/BarChart` | `Data/BarChart` | `BarChart.tsx` | chart, purple, cyan | Storybook Pending |
| `Data/DonutProgress` | `Data/DonutProgress` | `DonutProgress.tsx` | progress, chart, status | Storybook Pending |
| `Data/MiniSparkline` | `Data/MiniSparkline` | `MiniSparkline.tsx` | chart, primary | Storybook Pending |
| `Data/ProgressBar` | `Data/ProgressBar` | `ProgressBar.tsx` | progress, radius, status | Storybook Pending |
| `Data/KPICard` | `Data/KPICard` | `KPICard.tsx` | card, typography, status | Storybook Pending |
| `Data/MetricComparisonCard` | `Data/MetricComparisonCard` | `MetricComparisonCard.tsx` | card, chart, status | Storybook Pending |
| `Data/Heatmap` | `Data/Heatmap` | `Heatmap.tsx` | chart, opacity, cyan | Storybook Pending |
| `Data/RatingSummary` | `Data/RatingSummary` | `RatingSummary.tsx` | warning, rating, card | Storybook Pending |
| `Data/EmptyChartState` | `Data/EmptyChartState` | `EmptyChartState.tsx` | empty, surface, muted text | Storybook Pending |
| `Data/LoadingChartState` | `Data/LoadingChartState` | `LoadingChartState.tsx` | loading, skeleton, surface | Storybook Pending |

### Public Consolidation — Fase 3

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Brand/OfficialLogo` | `Brand/OfficialLogo` | `OfficialLogo.tsx` | image asset, brand sizing | Storybook Pending |
| `Organisms/Public Footer` | `Organisms/PublicFooter` | `PublicFooter.tsx` | surface, text, spacing, brand | Storybook Pending |
| `Molecules/FAQAccordion` | `Molecules/FAQAccordion` | `FAQAccordion.tsx` | surface, border, text, icon | Storybook Pending |
| `Product/JourneyStepCard` | `Product/JourneyStepCard` | `JourneyStepCard.tsx` | card, primary, cyan, spacing | Storybook Pending |
| `Product/JourneyDetailCard` | `Product/JourneyDetailCard` | `JourneyDetailCard.tsx` | card, icon, text, action | Storybook Pending |
| `Product/JourneyResultCard/Wide` | `Product/JourneyResultCardWide` | `JourneyResultCard.tsx` | card, therapy visual, action, badge | Storybook Pending |

### Recent Product Components — Fase 4

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Product/AuraPriorityOfDay` | `Product/AuraPriorityOfDay` | `AuraPriorityOfDay.tsx` | surface, border, text, status, action, spacing, radius, shadow | Storybook Pending |
| `Data/AuraMonthlyComparison` | `Data/AuraMonthlyComparison` | `AuraMonthlyComparison.tsx` | data, chart, status, text, spacing, radius | Storybook Pending |
| `Data/ProfileTrafficPaths` | `Data/ProfileTrafficPaths` | `ProfileTrafficPaths.tsx` | data, chart, text, spacing, radius | Storybook Pending |
| `Product/PatientHeroProfile` | `Product/PatientHeroProfile` | `PatientHeroProfile.tsx` | surface, avatar, badge, text, status, spacing | Storybook Pending |
| `Product/SessionMemoryTable` | `Product/SessionMemoryTable` | `SessionMemoryTable.tsx` | table, surface, border, text, badge | Storybook Pending |
| `Product/UpcomingAppointments` | `Product/UpcomingAppointments` | `UpcomingAppointments.tsx` | list, status, badge, surface, border | Storybook Pending |
| `Data/RevenueEvolutionChart` | `Data/RevenueEvolutionChart` | `RevenueEvolutionChart.tsx` | data, chart, status, surface, text | Storybook Pending |
| `Product/FinancialTransactionsTable` | `Product/FinancialTransactionsTable` | `FinancialTransactionsTable.tsx` | table, finance, status, surface, border | Storybook Pending |
| `Product/PayoutCalendar` | `Product/PayoutCalendar` | `PayoutCalendar.tsx` | finance, status, list, surface, text | Storybook Pending |
| `Product/RecentPayouts` | `Product/RecentPayouts` | `RecentPayouts.tsx` | finance, status, button, list | Storybook Pending |
| `Product/PublicProfilePreview` | `Product/PublicProfilePreview` | `PublicProfilePreview.tsx` | profile, avatar, badge, surface, border, text | Storybook Pending |
| `Product/ServicePlusCard` | `Product/ServicePlusCard` | `ServicePlusCard.tsx` | service, plus, badge, data, surface, shadow | Storybook Pending |

### Premium Public Components — Fase 5

| Figma Component | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Product/TherapistCard/Premium` | `Product/TherapistCardPremium` | `TherapistCard.tsx` | surface, text, action, status, border, spacing, radius, shadow | Storybook Pending |
| `Molecules/FAQAccordion/Premium` | `Molecules/FAQAccordionPremium` | `FAQAccordion.tsx` | background, surface, text, action, border, spacing, radius, shadow | Storybook Pending |

### Patterns e Templates

| Figma Pattern | Storybook Component | Code Component | Tokens Used | Status |
|---|---|---|---|---|
| `Pattern/PublicHero` | `Patterns/PublicHero` | `PublicHero.tsx` | background, primary, cyan | Storybook Pending |
| `Pattern/TherapistSearchResults` | `Patterns/TherapistSearchResults` | `TherapistSearchResults.tsx` | layout, filter, card | Storybook Pending |
| `Pattern/MatchingQuestionGrid` | `Patterns/MatchingQuestionGrid` | `MatchingQuestionGrid.tsx` | card, border, primary | Storybook Pending |
| `Pattern/DashboardMetricsGrid` | `Patterns/DashboardMetricsGrid` | `DashboardMetricsGrid.tsx` | data, chart, grid | Storybook Pending |
| `Pattern/PatientOverview` | `Patterns/PatientOverview` | `PatientOverview.tsx` | layout, next session, support | Storybook Pending |
| `Pattern/PatientSessionDetail` | `Patterns/PatientSessionDetail` | `PatientSessionDetail.tsx` | session, status, action | Storybook Pending |
| `Pattern/ChatLayout` | `Patterns/ChatLayout` | `ChatLayout.tsx` | message, surface, border | Storybook Pending |
| `Pattern/SettingsLayout` | `Patterns/SettingsLayout` | `SettingsLayout.tsx` | form, navigation, save | Storybook Pending |
| `Pattern/TherapistDashboard` | `Patterns/TherapistDashboard` | `TherapistDashboard.tsx` | dashboard, table, card | Storybook Pending |
| `Pattern/ProMetricsDashboard` | `Patterns/ProMetricsDashboard` | `ProMetricsDashboard.tsx` | data, pro, chart | Storybook Pending |
| `Pattern/PlusInsightsDashboard` | `Patterns/PlusInsightsDashboard` | `PlusInsightsDashboard.tsx` | plus, ai, data | Storybook Pending |
| `Pattern/TherapistProfileEditor` | `Patterns/TherapistProfileEditor` | `TherapistProfileEditor.tsx` | form, checklist, save | Storybook Pending |
| `Pattern/AdminOverview` | `Patterns/AdminOverview` | `AdminOverview.tsx` | admin, table, data | Storybook Pending |
| `Pattern/AdminTableWithSidePanel` | `Patterns/AdminTableWithSidePanel` | `AdminTableWithSidePanel.tsx` | table, side panel, status | Storybook Pending |
| `Pattern/VerificationReview` | `Patterns/VerificationReview` | `VerificationReview.tsx` | verification, status, admin | Storybook Pending |

## Observação

O Figma está pronto como referência visual inicial. Código e Storybook ainda precisam ser implementados para atingir `Synced`.

Após a Fase 2, o Figma contém uma fonte visual expandida. O Storybook deve priorizar primeiro atoms/molecules de base, depois `Data/*`, componentes de produto e, por fim, patterns compostos por perfil.

Tokens críticos para sincronização inicial:

- `color/primitive/purple/500 = #6C3D91`;
- `color/primitive/cyan/500 = #81BAE0`;
- `color/semantic/action/primary/default = #6C3D91`;
- `color/semantic/profile/patient = #81BAE0`.
