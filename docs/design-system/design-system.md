# Design System

Sistema visual e comportamental do Terapeuta Eu Sou. A interface deve parecer clara, acolhedora, premium e humana.

## Fontes

- `↳ Jornadas dos Usuários` (`12272:2`, frame principal `12280:2`): navegação, fluxos e permissões.
- `Design Telas` (`5999:10563`): layout, hierarquia visual e componentes.
- `Referencias/Publico`: páginas abertas, busca, jornada e reserva.
- `Referencias/Paciente`: área logada do paciente.
- `Referencias/Terapeuta Básico`: operação essencial e upgrade.
- `Referencias/Terapeuta Pro`: financeiro, métricas e avaliações.
- `Referencias/Terapeuta Plus`: IA, insights e detalhe do paciente.
- `Referencias/Admin`: gestão, moderação e indicadores.

## Fonte Visual Atual

A fonte final de verdade visual está na página única `Design System` do Figma, recriada sem cover e organizada em:

- `Design System / Foundations`;
- `Design System / Component Library`;
- `Design System / Product Patterns & Templates`;
- `Design System / Componentes`;
- `Design System / Public Reusable Consolidation`;
- `Design System / Product Component Documentation`;
- `Design System / Patient Screen Examples`;
- `Design System / Therapist App Components`;
- `Design System / Recent Product Components`.
- `Design System / Premium Public Components`.

Organização atual de `Design System / Componentes` (`12363:2`), revisada em 2026-06-16:

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

Auditoria de organização: `Design System / Componentes` possui 12 frames menores, 88 componentes únicos, 0 duplicidades por nome, 0 overflow e 0 textos colapsados. Os componentes originais foram preservados e apenas redistribuídos em prateleiras menores por domínio de uso.

Componentes publicados na versão atual:

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

Componentes recentes refinados em `Design System / Recent Product Components` (`12829:626`):

- `Product/AuraPriorityOfDay`;
- `Data/AuraMonthlyComparison`;
- `Data/ProfileTrafficPaths`;
- `Product/PatientHeroProfile`;
- `Product/SessionMemoryTable`;
- `Product/UpcomingAppointments`;
- `Data/RevenueEvolutionChart`;
- `Product/FinancialTransactionsTable`;
- `Product/PayoutCalendar`;
- `Product/RecentPayouts`;
- `Product/PublicProfilePreview`;
- `Product/ServicePlusCard`.

Auditoria visual de 2026-06-16: a seção recente foi refinada com auto-layout, estilos `TES/*`, tokens de superfície/borda/radius/spacing e QA estrutural com 0 overflow, 0 fontes ausentes e 0 cabeçalhos cortados.

Componentes públicos premium adicionados em `Design System / Premium Public Components` (`12927:624`) em 2026-06-17:

- `Product/TherapistCard/Premium` (`12927:629`);
- `Molecules/FAQAccordion/Premium` (`12927:661`).

QA estrutural da seção premium: 83 camadas, 39 textos, 0 fontes ausentes, 0 textos colapsados e 0 nomes genéricos. Os componentes usam bindings para cores, texto, borda, radius, sombras, espaçamentos e tamanhos tipográficos a partir das collections TES com modo `Light`.

## Princípios

- Clareza acolhedora: a tela organiza decisões sem parecer fria.
- Premium leve: branco, lavanda, roxo profundo, ciano e verde suave criam profundidade sem contraste agressivo.
- Dados humanos: métricas explicam o que ajudam a perceber.
- Progressão respeitosa: Básico mostra limites, Pro profissionaliza, Plus aprofunda.
- Profundidade por necessidade: subníveis só existem quando melhoram a navegação.
- Cuidado sem promessa: textos não prometem cura, diagnóstico ou resultado garantido.

## Assinatura Visual

### Atmosfera

Usa fundos quase brancos, névoa lavanda, ilustrações humanizadas, plantas, cristais, luz suave e cenas calmas. Esses recursos aparecem em:

- Hero público.
- Hero de dashboards.
- Sidebar e banners de app.
- Empty states.
- Cards de suporte.
- Cards premium do Plus.

### Cores

- Roxo profundo: marca, títulos, CTA e navegação ativa. Base atual: `color.primitive.purple.500 = #6C3D91`.
- Lavanda: superfícies suaves, seleção, bordas e gráficos leves.
- Ciano: acento humano, dados leves e ênfase de palavras. Base atual: `color.primitive.cyan.500 = #81BAE0`.
- Verde suave: sucesso, confirmação e bem-estar.
- Laranja suave: pendência e dica.
- Rosa suave: alerta, cancelamento e criticidade.

Semânticos principais:

- `color.semantic.action.primary.default = #6C3D91`;
- `color.semantic.profile.patient = #81BAE0`;
- `color.semantic.text.primary = #261433`;
- `color.semantic.status.info = #5EA3D2`.

Gradiente canônico para CTA premium:

- `gradient.brand.ctaLinear = linear-gradient(135deg, #6C3D91 0%, #AE94C3 100%)`;
- Figma paint style: `TES/Gradient/Brand CTA Linear`;
- aplicado em `Atoms/Button` como `variant=gradient`.

### Tipografia

- Display: `IvyPresto Display`.
- UI/body: `Manrope`.
- Ênfase: display itálica ou palavra em ciano.

Fallbacks técnicos: enquanto a fonte IvyPresto Display não estiver disponível em algum ambiente, usar `Cormorant Garamond`, `Playfair Display` e `serif` nessa ordem. No Figma, os styles `TES/Display/IvyPresto/*` e `TES/Accent/IvyPresto` foram criados. A aplicação visual real em componentes depende da fonte estar instalada/listada no arquivo; até lá, os styles legados `TES/Display/*` seguem em Cormorant para evitar fontes ausentes.

Nota técnica: os arquivos locais de `IvyPresto Display` no projeto são itálicos. Para manter o nome de família definido no design system sem quebrar títulos retos no produto, o CSS declara `IvyPresto Display` com os cortes retos de `IvyPresto Headline` e os cortes itálicos de `IvyPresto Display`, todos servidos por `/public/fonts/ivy-presto`.

Uso:

- Landing: títulos grandes e emocionais.
- Dashboards: títulos menores, leitura rápida e tabelas densas.
- Microcopy: frases curtas, claras e acolhedoras.

### Formas

- Cards: radius 16–24px.
- Botões principais: pill ou rounded, roxo/gradiente.
- Inputs: branco, borda lavanda, foco roxo/ciano.
- Badges: fundo tintado e texto legível.
- Gráficos: cantos arredondados e legendas humanas.
- Ícones: lineares, preferencialmente lucide.

## Layouts

### Público

Usa header horizontal, hero com imagem integrada, seções largas, cards de terapia e terapeuta, comparativo de planos, FAQ e footer.

### Paciente

Usa sidebar, topbar, cards, listas, favoritos separados, suporte lateral e ilustrações suaves. A rota raiz é `/app`.

### Terapeuta Básico

Usa dashboard simples, checklist de perfil, agenda, pacientes, sessões, mensagens, serviços, pagamento, perfil, upgrade e suporte.

### Terapeuta Pro

Usa shell de app com mais densidade: financeiro, métricas, avaliações, tabelas, filtros e página de plano.

### Terapeuta Plus

Usa visual premium com insights, Assessor IA, detalhe do paciente em `/plus/pacientes/:slug-do-paciente`, financeiro completo, avaliações e suporte prioritário. Plus não exibe upgrade.

### Admin

Usa alta densidade com sidebar, KPIs, tabelas, filtros, filas de moderação, gráficos e painéis laterais de decisão.

## Componentes Base

### Navegação

- `PublicHeader`
- `AppSidebar`
- `AdminSidebar`
- `Topbar`
- `Footer`
- `Breadcrumb`
- `Tabs`

### Ações

- `Button`
- `IconButton`
- `SplitButton` (`inferido`)
- `FloatingHelpButton`
- `ContextualUpgradeCTA`

### Formulários

- `Input`
- `Textarea`
- `SearchInput`
- `Select`
- `Combobox`
- `Checkbox`
- `RadioCard`
- `Toggle`
- `DatePicker`
- `TimeSlotPicker`
- `FileUpload`

### Superfícies

- `Card`
- `HeroCard`
- `MetricCard`
- `Banner`
- `Drawer`
- `Modal`
- `Popover`
- `Tooltip`
- `Accordion`
- `Toast`

### Dados

- `DataTable`
- `ListRow`
- `StatusBadge`
- `ProgressRing`
- `LineChart`
- `BarChart`
- `DonutChart`
- `Heatmap`
- `WordCloud`
- `Timeline`

### Feedback

- `EmptyState`
- `LoadingState`
- `Skeleton`
- `ErrorState`
- `SuccessState`
- `BlockedFeature`

## Componentes de Produto

- `TherapyCard`
- `TherapistCard`
- `FavoriteTherapistList`
- `FavoriteTherapyList`
- `MatchingQuestionCard`
- `JourneyResultCard`
- `BookingStepper`
- `ReservationSummary`
- `ServiceCard`
- `AvailabilityPicker`
- `SessionCard`
- `SessionDetail`
- `MessageThread`
- `PaymentSummary`
- `ReviewCard`
- `PlanCard`
- `ComparisonTable`
- `ProfileChecklist`
- `UpgradeBanner`
- `SettingsNav`
- `InsightCard`
- `AIRecommendationCard`
- `AIAssessorPanel`
- `PlusPatientJourney`
- `AdminModerationQueue`
- `VerificationPanel`
- `IntegrationStatusCard`

## Estados

### Loading

Usa skeleton lavanda. Matching usa texto emocional:

- “Estamos analisando suas escolhas com cuidado...”
- “Buscando caminhos terapêuticos que combinem com o seu momento...”
- “Cada pessoa é única. Seu caminho também.”

Não usar “Processando dados” como texto final de UI.

### Empty

Sempre oferece contexto e ação:

- “Você ainda não tem sessões agendadas.”
- “Quando uma pessoa agendar com você, ela aparecerá aqui.”
- “Que tal completar seu perfil para ajudar mais pessoas a conhecerem seu trabalho?”

### Erro

Explica o problema e o próximo passo:

> Não conseguimos carregar suas sessões agora. Tente novamente em instantes ou fale com suporte se precisar de ajuda.

### Bloqueio por Plano

Mostra valor sem culpa:

> Esse recurso ajuda terapeutas Pro a entenderem melhor como as pessoas encontram seu perfil.

CTA: “Conhecer plano Pro” ou “Ver possibilidades”.

### Sucesso

Confirma com segurança:

- “Sua sessão foi confirmada.”
- “Seu perfil foi atualizado.”
- “As alterações foram salvas com segurança.”

## Linguagem

Usar:

- “Pessoas que viram seu perfil.”
- “Pessoas que quiseram conhecer melhor seu trabalho.”
- “Pessoas que seguiram para agendar.”
- “Seu perfil pode ficar mais claro.”
- “Que tal revisar sua descrição?”
- “Horários com maior procura.”

Evitar:

- “Conversão.”
- “CTR.”
- “Leads.”
- “Funil.”
- “Baixa performance.”
- Comparação agressiva entre terapeutas.

## Acessibilidade

- Texto normal tem contraste mínimo recomendado de 4.5:1.
- Texto grande tem contraste mínimo recomendado de 3:1.
- CTAs roxos usam texto branco.
- Lavanda claro não é texto principal.
- Ícone isolado exige tooltip ou `aria-label`.
- Status usa texto ou ícone além da cor.
- Focus ring usa roxo/ciano.
- Tabelas usam cabeçalhos semânticos.
- Modais e drawers prendem foco e fecham com `Esc`.

## Responsividade

- Público: desktop em 3–6 colunas, tablet em 2, mobile em 1.
- Apps: desktop com sidebar fixa, tablet com sidebar compacta, mobile com drawer ou navegação inferior (`inferido`).
- Tabelas viram cards no mobile.
- Texto quebra antes de reduzir demais.
- CTAs não ficam fora da área visível.

## Governança

- Todo componente usa tokens de `tokens.md`.
- Todo padrão reutilizável entra no Storybook.
- Exceções por plano precisam de justificativa.
- shadcn/ui é base estrutural; telas finais usam wrappers TES.
- Ilustrações novas seguem lavanda/ciano, luz suave e figuras serenas.
- Páginas públicas novas usam `Brand/OfficialLogo`, `Organisms/Public Header` e `Organisms/Public Footer`.
- FAQs públicas usam `Molecules/FAQAccordion` quando forem linhas expansíveis.
- Páginas de jornada usam `Product/JourneyStepCard`, `Product/JourneyDetailCard` e `Product/JourneyResultCard/Wide` quando o layout corresponder.

## Divergências

- Algumas telas do Figma estão rasterizadas. Tokens numéricos são `inferido` e devem ser calibrados por comparação visual.
- Grafias visuais com acento viram aliases técnicos quando necessário.
- Admin aparece na Jornada consolidada e usa Design Telas/referências para detalhamento visual.
- O logotipo oficial foi importado de `docs/design-system/assets/logo-oficial-terapeuta-eu-sou.png` e está registrado em `Brand/OfficialLogo` (`12548:140`).

## Fase 3 — Consolidação Pública

Componentes Figma adicionados em 2026-06-15:

- `Brand/OfficialLogo` (`12548:140`).
- `Organisms/Public Footer` (`12548:142`).
- `Molecules/FAQAccordion` (`12548:162`).
- `Product/JourneyStepCard` (`12548:165`).
- `Product/JourneyDetailCard` (`12548:170`).
- `Product/JourneyResultCard/Wide` (`12548:175`).

QA das 10 páginas públicas recriadas: largura `1055px`, 0 nomes genéricos, 0 placeholders e 0 overflow horizontal.
