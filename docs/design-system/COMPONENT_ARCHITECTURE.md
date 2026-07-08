# Component Architecture - Terapeuta Eu Sou

Data: 2026-06-14

## Princípio

A biblioteca foi criada a partir da auditoria, não de uma identidade nova.

Critérios usados:

- existe nas telas, docs ou sitemap;
- é recorrente;
- resolve um fluxo real;
- pode ser controlado por variant/property;
- respeita linguagem humana e sem promessa de cura.

## Organização no Figma

Página única: `Design System`.

Depois da revisão visual, a página foi recriada sem cover, organizada em três grandes áreas iniciais e expandida com um quarto frame para a Fase 2. A referência estrutural veio do arquivo `Projeto Leo Barros Atualizado`, sem copiar sua identidade visual.

Frames principais atuais:

1. `Design System / Foundations`
2. `Design System / Component Library`
3. `Design System / Product Patterns & Templates`
4. `Design System / Phase 2 Expansion`
5. `Design System / Premium Public Components`

## Foundations

A base de tokens foi reorganizada em torno das novas escalas primitivas:

- `color/primitive/purple/500 = #6C3D91`;
- `color/primitive/cyan/500 = #81BAE0`;
- escalas `50-900` refeitas para roxo e ciano;
- semânticos principais reaponteados para as novas bases;
- modo único `Light`.

## Atoms

| Figma Component | Variants | Status |
|---|---:|---|
| `Atoms/Button` | 60 | Criado |
| `Atoms/Form Controls` | 16 | Criado |
| `Atoms/Badge` | 9 | Criado |
| `Atoms/Boolean Control` | 4 | Criado |

Validação executada:

- sem altura colapsada;
- sem overflow;
- sem nomes genéricos;
- variants reais;
- bindings de variables aplicados onde apropriado.

Atualização de 2026-06-17: `Atoms/Button` recebeu a família `variant=gradient` com 12 variações (`sm`, `md`, `lg` x `default`, `hover`, `disabled`, `loading`) usando o paint style `TES/Gradient/Brand CTA Linear` (`#6C3D91` para `#AE94C3`, linear 135deg).

## Molecules

| Figma Component | Variants | Status |
|---|---:|---|
| `Molecules/Navigation Item` | 4 | Criado |
| `Molecules/Card` | 5 | Criado |
| `Molecules/Tabs` | 4 | Criado |

## Organisms

| Figma Component | Tipo | Status |
|---|---|---|
| `Organisms/Public Header` | Component | Criado |
| `Organisms/App Sidebar` | Component | Criado |

## Product Components

| Figma Component | Categoria | Status |
|---|---|---|
| `Product/TherapistCard` | Público/Paciente | Criado |
| `Product/TherapyCard` | Público/Paciente | Criado |
| `Product/JourneyResultCard` | Jornada | Criado |
| `Product/MetricCard` | Pro/Plus/Admin | Criado |
| `Product/AIRecommendationCard` | Plus | Criado |
| `Product/CarefulBenchmark` | Pro/Plus | Criado |
| `Product/TherapistCard/Premium` | Público/Paciente | Criado |
| `Molecules/FAQAccordion/Premium` | Público/Paciente | Criado |

## Fase 5 — Componentes Públicos Premium

Atualização: 2026-06-17

A seção `Design System / Premium Public Components` (`12927:624`) consolida os componentes refinados a partir dos frames públicos de busca de terapeutas e FAQ. Os componentes foram duplicados para a página `Design System`, renomeados para a taxonomia da biblioteca e ajustados aos tokens canônicos documentados em `tokens.md`.

| Figma Component | Base | Tokens principais | Status |
|---|---|---|---|
| `Product/TherapistCard/Premium` (`12927:629`) | `Product/TherapistCard` | `color/semantic/surface/default`, `color/semantic/action/primary/default`, `color/semantic/status/success`, `color/semantic/status/warning`, `color/semantic/text/*`, `color/semantic/border/subtle`, `spacing/4`, `radius/panel`, `radius/full`, `shadow/float` | Criado |
| `Molecules/FAQAccordion/Premium` (`12927:661`) | `Molecules/FAQAccordion` | `color/semantic/background/soft`, `color/semantic/surface/default`, `color/semantic/action/primary/default`, `color/semantic/text/*`, `color/semantic/border/subtle`, `spacing/8`, `radius/hero`, `radius/card`, `radius/full`, `shadow/soft` | Criado |

QA estrutural:

- 83 camadas totais;
- 39 textos;
- 0 fontes ausentes;
- 0 textos colapsados;
- 0 nomes genéricos;
- bindings aplicados em fills, strokes, radius, sombras, espaçamentos e tamanhos tipográficos.

## Fase 2 — Expansão

Atualização: 2026-06-15

A segunda rodada expandiu a página única `Design System` sem refazer a base existente. A expansão ficou no frame `Design System / Phase 2 Expansion`, com seções internas para componentes reais observados nas telas estáticas, prints e referências por perfil.

Seções originais criadas:

- `Components — Expanded`
- `Product Components`
- `Icon Library`
- `Charts & Data Visualization`
- `Dashboard Patterns`
- `Admin Patterns`
- `Patient Patterns`
- `Therapist Patterns`
- `AI Metadata`

Organização atual no frame `Design System / Componentes` (`12363:2`), revisada em 2026-06-16:

- `01 Base, navegação e utilidades` (`12857:626`) — 8 componentes.
- `02 Produto: sessões e jornada` (`12857:631`) — 4 componentes.
- `03 Produto: plano, pagamento e perfil` (`12857:636`) — 7 componentes.
- `04 Produto: operações, moderação e IA` (`12857:641`) — 3 componentes.
- `05 Ícones de navegação e status` (`12857:646`) — 29 componentes.
- `06 Assets e ilustrações base` (`12857:651`) — 8 componentes.
- `07 Dados e visualizações` (`12857:656`) — 12 componentes.
- `08 Patterns públicos e dashboard` (`12857:661`) — 4 componentes.
- `09 Patterns administrativos` (`12857:666`) — 3 componentes.
- `10 Patterns de paciente` (`12857:671`) — 4 componentes.
- `11 Patterns de terapeuta` (`12857:676`) — 4 componentes.
- `12 Metadados e checklist AI-friendly` (`12857:681`) — 2 componentes.

Critério de organização: os componentes mestres foram preservados nos mesmos IDs e redistribuídos em frames menores por domínio de uso. A seção usa Auto Layout vertical no container principal e prateleiras internas com bounds corrigidos para evitar corte visual.

### Components — Expanded

| Figma Component | Função | Status |
|---|---|---|
| `Molecules/FilterBar` | Filtros recorrentes de listas e busca | Criado |
| `Molecules/SearchWithFilters` | Busca compacta com filtros | Criado |
| `Molecules/RightRail` | Apoio contextual lateral | Criado |
| `Molecules/SupportCard` | Suporte humano e contextual | Criado |
| `Molecules/PolicyCard` | Política, segurança e orientação sensível | Criado |
| `Molecules/SaveBar` | Estado de alterações não salvas | Criado |
| `Molecules/FloatingHelpButton` | Acesso rápido a ajuda | Criado |
| `Organisms/AppTopbar` | Topbar interna para áreas logadas | Criado |

### Product Components — Fase 2

| Figma Component | Perfil/Fluxo | Status |
|---|---|---|
| `Product/SessionCard` | Paciente/Terapeuta | Criado |
| `Product/NextSessionBlock` | Paciente/Terapeuta | Criado |
| `Product/SessionDetailPanel` | Sessões | Criado |
| `Product/PaymentSummary` | Pagamentos | Criado |
| `Product/PlanCard` | Planos | Criado |
| `Product/PlanFeatureComparison` | Planos e upgrade | Criado |
| `Product/ProfileChecklist` | Perfil de terapeuta | Criado |
| `Product/UpgradeBanner` | Básico/Pro/Plus | Criado |
| `Product/ServiceCard` | Serviços/Terapias | Criado |
| `Product/ReviewCard` | Avaliações/Reputação | Criado |
| `Product/PatientRow` | Listas densas | Criado |
| `Product/VerificationPanel` | Admin | Criado |
| `Product/ModerationQueue` | Admin | Criado |
| `Product/AIInsightPanel` | Plus/IA | Criado |
| `Product/PatientJourneyTimeline` | Jornada/Matching | Criado |

Observação de localização: `Product/PlanFeatureComparison` e `Product/TherapistResultCard` existem na página `Design System`, mas ficam em frames de documentação/consolidação fora de `Design System / Componentes`. `Product/TherapyVisualCard` foi organizado em `06 Assets e ilustrações base` por funcionar como visual reutilizável.

### Icon Library e Assets

Foram criados 29 ícones lineares e 7 assets simples como componentes Figma, com tamanhos `16`, `20` e `24`.

Grupos:

- navegação: `Icon/Home/24`, `Icon/Sessions/24`, `Icon/Calendar/24`, `Icon/Messages/24`, `Icon/Patients/24`, `Icon/Therapists/24`, `Icon/Therapies/24`, `Icon/Payments/24`, `Icon/Profile/24`, `Icon/Settings/24`, `Icon/Support/24`;
- produto: `Icon/Journey/24`, `Icon/Favorites/24`, `Icon/Reviews/24`, `Icon/Metrics/24`, `Icon/Insights/24`, `Icon/AI/24`, `Icon/Reputation/24`, `Icon/Highlight/24`, `Icon/Security/24`, `Icon/Admin/24`;
- ações/status: `Icon/Filter/20`, `Icon/Search/20`, `Icon/Calendar/20`, `Icon/Status/Success/16`, `Icon/Status/Warning/16`, `Icon/Status/Error/16`, `Icon/Status/Info/16`, `Icon/Loading/16`;
- assets: `Asset/IllustrationTile/*`, `Asset/SoftDivider`, `Asset/HeroImageMask`, `Asset/SidebarBloom`.

### Charts & Data Visualization

| Figma Component | Uso | Status |
|---|---|---|
| `Data/ChartContainer` | Container base de gráficos | Criado |
| `Data/LineChart` | Evolução ao longo do tempo | Criado |
| `Data/BarChart` | Comparação simples | Criado |
| `Data/DonutProgress` | Progresso ou reputação | Criado |
| `Data/MiniSparkline` | Tendência compacta | Criado |
| `Data/ProgressBar` | Progresso linear | Criado |
| `Data/KPICard` | KPI humano | Criado |
| `Data/MetricComparisonCard` | Comparação cuidadosa | Criado |
| `Data/Heatmap` | Padrões por dia/horário | Criado |
| `Data/RatingSummary` | Resumo de avaliações | Criado |
| `Data/EmptyChartState` | Estado vazio de dados | Criado |
| `Data/LoadingChartState` | Estado carregando | Criado |

Linguagem obrigatória para dados:

- usar `Pessoas interessadas`, `Caminhos até o agendamento`, `Sinais para observar`;
- evitar `lead`, `funil`, `CTR`, `conversão`, `baixa performance` e ranking competitivo.

### Patterns por Perfil

| Figma Pattern | Perfil | Status |
|---|---|---|
| `Pattern/PublicHero` | Público | Criado |
| `Pattern/TherapistSearchResults` | Público/Paciente | Criado |
| `Pattern/MatchingQuestionGrid` | Jornada | Criado |
| `Pattern/DashboardMetricsGrid` | Pro/Plus/Admin | Criado |
| `Pattern/PatientOverview` | Paciente | Criado |
| `Pattern/PatientSessionDetail` | Paciente | Criado |
| `Pattern/ChatLayout` | Paciente/Terapeuta/Suporte | Criado |
| `Pattern/SettingsLayout` | Perfis logados | Criado |
| `Pattern/TherapistDashboard` | Terapeuta Básico | Criado |
| `Pattern/ProMetricsDashboard` | Terapeuta Pro | Criado |
| `Pattern/PlusInsightsDashboard` | Terapeuta Plus | Criado |
| `Pattern/TherapistProfileEditor` | Terapeuta | Criado |
| `Pattern/AdminOverview` | Admin | Criado |
| `Pattern/AdminTableWithSidePanel` | Admin | Criado |
| `Pattern/VerificationReview` | Admin | Criado |

## Layout e Templates

| Figma Component | Variants | Status |
|---|---:|---|
| `Templates/Dashboard Shell` | 6 | Criado |

Templates visuais documentados na página:

- Público;
- Paciente;
- Terapeuta Básico;
- Terapeuta Pro;
- Terapeuta Plus;
- Admin.

## Variant Strategy

Variants foram criadas apenas onde havia uso real ou previsível:

- estado visual: default, hover, disabled, loading, selected;
- perfil: patient, basic, pro, plus, admin;
- status: paid, pending, canceled, live, completed;
- plano: basic, pro, plus;
- intenção: observation, recommendation, opportunity.

Exceções visuais não viraram regra.

## AI Metadata

Componentes e component sets relevantes receberam metadados em `sharedPluginData` com namespace `tes.ds`.

Campos usados:

- `componentName`;
- `category`;
- `intent`;
- `relatedComponents`;
- `avoid`;
- `tokens`;
- `figmaVariables`;
- `profile`;
- `variant`.

Na Fase 2, todos os 87 componentes/assets/patterns adicionados ao frame `Design System / Phase 2 Expansion` receberam metadados ou descrições. Na organização atual de `Design System / Componentes`, a consulta soma 88 componentes únicos porque `Product/TherapyVisualCard` foi incorporado à prateleira `06 Assets e ilustrações base`. O frame `12 Metadados e checklist AI-friendly` documenta o modelo visual obrigatório para novas peças.

## Handoff

O Figma está mais avançado que o código e o Storybook.

Estado correto:

- Figma: pronto como fonte visual expandida da Fase 2.
- Código: tokens parciais e sem componentes implementados.
- Storybook: pendente, não instalado.

## Fase 3 — Refinamento de Telas Recriadas

### Product/PlanFeatureComparison

Componente criado no Figma para a página pública `/para-terapeutas`.

Uso:

- comparar recursos dos planos Básico, Pro e Plus;
- apoiar páginas públicas, upgrade contextual e documentação de Storybook;
- substituir tabelas compactadas ou rasterizadas por uma estrutura editável e reutilizável.

Arquitetura:

- container com Auto Layout vertical;
- header com `TES/Heading/H2` e `TES/Caption`;
- tabela com colunas `Recurso`, `Básico`, `Pro`, `Plus`;
- linhas com `TES/Caption` e `TES/Micro`;
- checks usando `Icon/Status/Success/16`;
- tokens semânticos de surface, border, text, status, spacing e radius.

Regra adicionada ao fluxo `recreate_figma_pages`: recriações preservam a largura da referência, mas podem crescer em altura quando isso melhora espaçamento, legibilidade e qualidade de componente.

### Product/TherapistResultCard

Componente criado no Figma durante a auditoria visual da página pública `/terapeutas`.

Uso:

- apresentar terapeutas em resultados de busca e listagens públicas;
- manter avatar, nome, especialidade, descrição, badges, avaliação, próximo horário, preço e ações no mesmo card horizontal;
- evitar que botões, preço ou metadados sejam cortados em cards desenhados manualmente.

Arquitetura:

- container horizontal com Auto Layout, largura base `911px` e colunas compactas;
- avatar circular;
- bloco `Content` com `TES/Heading/H3`, `TES/Caption` e `TES/Micro`;
- bloco `Care Tags` para até dois marcadores principais;
- blocos `Rating`, `Schedule` e `Actions`;
- botões compactos para `Ver perfil` e `Agendar`;
- tokens semânticos de surface, border, text, action, spacing, radius e shadow.

Regra para recriações: quando uma tela tiver listagem horizontal de terapeutas, usar `Product/TherapistResultCard` ou uma instância equivalente; não comprimir colunas manualmente se isso causar corte lateral.

### Product/TherapyVisualCard

Componente criado no Figma durante a recriação da página pública `/terapias`.

Uso:

- apresentar terapias em catálogo visual público;
- combinar área de imagem/ilustração, nome da terapia, descrição curta e ação `Saiba mais`;
- substituir cards desenhados manualmente quando a terapia precisa de presença visual forte;
- manter consistência entre `/terapias`, favoritos de terapias, recomendações da jornada e resultados relacionados.

Arquitetura:

- container vertical com Auto Layout, largura base `220px` e altura base `274px`;
- slot `Visual` com comportamento de área de imagem/ilustração, radius e clipping;
- `Content` com `TES/Heading/H3` e `TES/Caption`;
- ação outline compacta com ícone `arrow-right` vindo da página `ícones`;
- ícone visual `flower-2` vindo da página `ícones` como fallback quando não houver imagem real;
- tokens semânticos de background, border, text, action, spacing, radius e shadow.

Regra para recriações: quando a tela usar grid visual de terapias, usar `Product/TherapyVisualCard` antes de criar cards locais. A imagem pode ser representada por placeholder estruturado, mas o espaço visual precisa permanecer claro e intencional.

## Fase 3 — Consolidação Pública

Atualização: 2026-06-15

A auditoria das 10 páginas públicas recriadas consolidou padrões recorrentes em componentes reutilizáveis, sem recriar foundations e sem alterar código.

| Figma Component | Categoria | Status |
|---|---|---|
| `Brand/OfficialLogo` | Brand | Criado |
| `Organisms/Public Footer` | Público | Criado |
| `Molecules/FAQAccordion` | FAQ | Criado |
| `Product/JourneyStepCard` | Jornada | Criado |
| `Product/JourneyDetailCard` | Jornada/educacional | Criado |
| `Product/JourneyResultCard/Wide` | Jornada/resultado | Criado |
| `Organisms/Public Header` | Público | Atualizado com logo oficial |

IDs Figma:

- `Brand/OfficialLogo`: `12548:140`.
- `Organisms/Public Header`: `12335:465`.
- `Organisms/Public Footer`: `12548:142`.
- `Molecules/FAQAccordion`: `12548:162`.
- `Product/JourneyStepCard`: `12548:165`.
- `Product/JourneyDetailCard`: `12548:170`.
- `Product/JourneyResultCard/Wide`: `12548:175`.
- Seção documental: `Design System / Public Reusable Consolidation` (`12548:136`).

Regras adicionadas:

- Headers e footers públicos devem usar `Brand/OfficialLogo`.
- Footers de páginas públicas devem partir de `Organisms/Public Footer`.
- FAQs públicas devem usar `Molecules/FAQAccordion` quando forem linhas expansíveis.
- Fluxos explicativos de jornada devem usar `Product/JourneyStepCard` e `Product/JourneyDetailCard`.
- Resultados de jornada em layout horizontal amplo devem usar `Product/JourneyResultCard/Wide`.

O logo oficial fica salvo em `docs/design-system/assets/logo-oficial-terapeuta-eu-sou.png` e foi aplicado no Figma sem redesenho.

### Refinamento visual e manutenção

Atualização: 2026-06-15

O frame `Design System / Public Reusable Consolidation` (`12548:136`) foi reorganizado como biblioteca pública reutilizável, com seções para auditoria, componentes mestres, exemplos de uso e notas de implementação.

Arquitetura refinada:

- Componentes mestres ficam dentro de `Master Components / Public Core`, evitando nós soltos em `(0,0)`.
- Exemplos ficam em `Usage Examples` e usam instâncias reais com overrides para FAQ, jornada de 4 passos e resultado de jornada.
- Notas ficam em `Implementation Notes` e documentam quando usar componente existente antes de criar composição local.
- `Organisms/Public Header` (`12335:465`) recebeu estilos `TES/*` nos textos do mestre para corrigir instâncias sem estilo.

Tamanhos de referência:

| Figma Component | Tamanho mestre | Observação |
|---|---:|---|
| `Brand/OfficialLogo` | `220x118` | PNG oficial com proporção preservada |
| `Organisms/Public Footer` | `1055x236` | Footer padrão para páginas públicas `1055px` |
| `Molecules/FAQAccordion` | `620x64` | Estado colapsado base |
| `Product/JourneyStepCard` | `210x332` | Sequências de 3 a 4 passos |
| `Product/JourneyDetailCard` | `330x170` | Grids educacionais |
| `Product/JourneyResultCard/Wide` | `923x220` | Resultado de jornada |

Limitação técnica registrada:

- A página `ícones` foi auditada antes do refinamento, mas alguns ícones existentes renderizaram como glyphs preenchidos/quadrados em screenshots. Os componentes públicos refinados usam vetores compatíveis com Lucide nos slots visuais até a biblioteca de ícones ser corrigida.

## Fase 4 — Recent Product Components

Atualização: 2026-06-16

O frame `Design System / Recent Product Components` (`12829:626`) consolida componentes importantes criados nas telas recentes de Aura IA, Histórico de Atendimento, Financeiro, Perfil Público e Serviços Plus. O objetivo é transformar blocos antes locais em componentes mestres reutilizáveis, mantendo a página `Design System` como fonte de verdade visual.

Arquitetura do frame:

- `Library Header`: resumo da biblioteca, status e tags de auditoria.
- `Section / Aura IA`: componentes de insight, comparação e caminhos de perfil.
- `Section / Histórico de Atendimento`: hero do paciente, memória dos encontros e próximos encontros.
- `Section / Financeiro`: evolução, transações e repasses.
- `Section / Perfil Público`: preview do perfil público.
- `Section / Serviços Plus`: card de serviço com métricas.

Componentes refinados:

| Figma Component | Node ID | Tamanho mestre | Uso |
|---|---:|---:|---|
| `Product/AuraPriorityOfDay` | `12829:632` | `530x380` | Prioridade automatizada da Aura IA |
| `Data/AuraMonthlyComparison` | `12829:648` | `530x380` | Comparativo mês atual vs. anterior |
| `Data/ProfileTrafficPaths` | `12829:682` | `530x380` | Caminhos que levam ao perfil |
| `Product/PatientHeroProfile` | `12829:715` | `530x420` | Hero resumido de paciente em acompanhamento |
| `Product/SessionMemoryTable` | `12829:753` | `800x420` | Memória dos encontros e temas recorrentes |
| `Product/UpcomingAppointments` | `12829:784` | `530x420` | Próximos encontros agendados |
| `Data/RevenueEvolutionChart` | `12829:815` | `800x400` | Evolução de faturamento |
| `Product/FinancialTransactionsTable` | `12829:831` | `800x400` | Transações recentes |
| `Product/PayoutCalendar` | `12829:870` | `530x360` | Calendário de repasses |
| `Product/RecentPayouts` | `12829:887` | `560x360` | Repasses recentes |
| `Product/PublicProfilePreview` | `12829:907` | `760x620` | Preview do perfil público |
| `Product/ServicePlusCard` | `12829:955` | `760x260` | Card de serviço Plus com métricas |

Decisões de qualidade:

- Componentes principais usam Auto Layout e descrições no painel Figma.
- Textos usam estilos `TES/*`; onde a fonte display estava ausente no ambiente, o texto foi corrigido para `TES/Heading/H1` em Manrope.
- Fills, bordas, radius, spacing e sombras seguem tokens/estilos TES quando disponíveis.
- Imagens continuam como placeholders estruturados quando a tela original pedia imagem, sem gastar tempo com geração de asset.
- O card `Product/ServicePlusCard` preserva placeholder visual, conteúdo do serviço e métricas em um único componente horizontal.

QA final no Figma:

- 12 componentes encontrados.
- 0 overflow direto nos componentes.
- 0 overflow nos grids das seções.
- 0 fontes ausentes.
- 0 subframes com texto colapsado.
- 0 cabeçalhos cortados.

Inconsistências registradas para manutenção:

- Existem collections legadas no Figma (`Color Schemes`, `Primitives`, `UI Styles`, `Spacing & Sizing`) que não devem ser usadas como fonte TES.
- Há duas collections chamadas `Typography`: a antiga com modos `Desktop/Mobile` e a TES com modo `Light`. A fonte de verdade para produto é a collection `Typography` com modo `Light`.
- Os componentes recentes ainda não possuem variants/properties avançadas nem Code Connect; devem ser tratados como master components visuais até a implementação React/Storybook.
