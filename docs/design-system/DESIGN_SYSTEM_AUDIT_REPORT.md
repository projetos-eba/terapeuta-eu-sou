# DESIGN SYSTEM AUDIT REPORT

Projeto: Terapeuta Eu Sou  
Data: 2026-06-14  
Status: auditoria inicial concluída sem alterações grandes no Figma ou no Storybook.

> Snapshot histórico de 2026-06-14. O estado operacional de stack e rotas foi
> revisado em 2026-07-25: Next.js 15 e namespace autenticado alvo
> `/terapeuta/*`. As referências `/basico/*`, `/pro/*` e `/plus/*` abaixo
> registram o material auditado naquela data.

## 1. Escopo da auditoria

Esta auditoria foi feita antes de criar tokens, variables, componentes ou uma nova página no Figma, seguindo a regra de ouro do projeto: auditar antes de criar.

Fontes auditadas:

- Documentação do Design System.
- Documentação de produto, sitemap, inventário de páginas e mapa de rotas.
- Arquivo Figma `Projeto Terapeuta Eu Sou Atualizado`.
- Página Figma `↳ Jornadas dos Usuários`.
- Página Figma `↳ Design Telas`.
- Página Figma `↳ Sitemap`.
- Pasta local `Referencias`, separada por perfil.
- Código atual Next.js/Tailwind.
- Presença ou ausência de Storybook.

## 2. Arquivos analisados

### Design System

- `docs/design-system/design-system.md`
- `docs/design-system/tokens.md`
- `docs/design-system/component-inventory.md`
- `docs/design-system/storybook-plan.md`
- `docs/design-system/implementation-notes.md`
- `docs/design-system/qa-checklist.md`

Observação: todos os 6 arquivos da pasta `docs/design-system` foram lidos integralmente, totalizando 1.368 linhas.

### Produto

- `docs/product/product.md`
- `docs/product/sitemap.md`
- `docs/product/page-inventory.md`
- `docs/product/routes-map.md`

### Código

- `package.json`
- `tailwind.config.ts`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/lib/routes.ts`
- `src/lib/permissions.ts`
- `src/lib/utils.ts`
- `components.json`
- `README.md`

### Referências visuais

- `Referencias/Publico`: 10 imagens.
- `Referencias/Paciente`: 8 imagens.
- `Referencias/Terapeuta Básico`: 10 imagens.
- `Referencias/Terapeuta Pro`: 10 imagens.
- `Referencias/Terapeuta Plus`: 10 imagens.
- `Referencias/Admin`: 9 imagens.

Total: 57 referências visuais locais.

## 3. Figma analisado

Arquivo: `Projeto Terapeuta Eu Sou Atualizado`  
File key: `OSXJi8tknHHCj82MTY2NbG`

### Páginas encontradas

| Página | ID | Conteúdo observado |
|---|---|---|
| `WORKSPACE` | `1320:44` | Sem conteúdo relevante carregado. |
| `↳ Jornadas dos Usuários` | `12272:2` | Mapa de jornadas por perfil. |
| `↳ Design Telas` | `5999:10563` | Telas estáticas organizadas por perfil. |
| `↳ Sitemap` | `12259:2` | Sitemap visual estruturado com auto layout. |
| `---` | `4174:80291` | Sem conteúdo relevante carregado. |

### Inventário Figma

#### `↳ Jornadas dos Usuários`

- 1 frame principal: `↳ Jornadas dos Usuários - Terapeuta Eu Sou`.
- 263 frames.
- 681 textos.
- 98 retângulos.
- 98 elipses.
- Não há components/component sets locais nesta página.
- A página documenta os 6 perfis: Público, Paciente, Terapeuta Básico, Terapeuta Pro, Terapeuta Plus e Admin.
- A tipografia observada nesta página usa majoritariamente `Inter`.

#### `↳ Design Telas`

- 6 grupos principais:
  - `Telas Admin`
  - `Telas Terapeuta Básico`
  - `Telas Publico`
  - `Telas Paciente`
  - `Telas Terapeuta Plus`
  - `Telas Terapeuta Pro`
- 57 frames de tela.
- As telas estão rasterizadas como imagens dentro de frames.
- Não há textos editáveis relevantes dentro das telas.
- Não há components/component sets locais nesta página.
- A página é excelente como referência visual, mas não é componentizada.

#### `↳ Sitemap`

- 7 blocos principais por área/perfil.
- 470 frames.
- 559 textos.
- 39 retângulos.
- Muitos frames usam auto layout.
- Não há components/component sets locais.

### Telas analisadas no Figma `Design Telas`

#### Admin

- `/admin` em 9 variações.
- Telas: visão geral, profissionais, verificações, pacientes, sessões, pagamentos, avaliações, assinaturas/planos e terapias.

#### Terapeuta Básico

- `/basico` em 10 variações.
- Telas: início, agenda, pacientes, sessões, mensagens, serviços, pagamento, perfil, upgrade e configurações.

#### Público

- `/`
- `/como funciona`
- `/para-terapeutas`
- `/para-terapeutas/planos`
- `/terapeutas`
- `/terapeutas/:slug`
- `/terapias`
- `/terapias/:slug`
- `/sua-jornada`
- `sua-jornada/resultado`

#### Paciente

- `/app/sessoes`
- `/app/sessoes/:slug`
- `/app/mensagens`
- `/app/favoritos`
- `/app/ajuda`
- `/app/pagamentos`
- `/app/configurações`
- `/app/inicio`

#### Terapeuta Plus

- `/plus`
- `/plus/agenda`
- `/plus/pacientes`
- `/plus/mensagens`
- `/plus/serviços`
- `/plus/financeiro`
- `/plus/insights`
- `/plus/avaliações`
- `/plus/sessoes`
- `/plus/pacientes/:slug-do-paciente`

#### Terapeuta Pro

- `/pro/inicio`
- `/pro/agenda`
- `/pro/pacientes`
- `/pro/sessoes`
- `/pro/mensagens`
- `/pro/servicos`
- `/pro/financeiro`
- `/pro/avaliacoes`
- `/pro/upgrade`
- `/pro/metricas`

## 4. Variables e styles atuais no Figma

### Collections atuais

| Collection | Modos | Variáveis | Observação |
|---|---|---:|---|
| `Color Schemes` | `Mode 1` | 5 | Sem nome semântico TES. |
| `Primitives` | `Mode 1` | 32 | Mistura neutros, opacidades e cores de marca. |
| `UI Styles` | `Mode 1` | 5 | Inclui stroke/radius, mas ainda genérico. |
| `Typography` | `Desktop`, `Mobile` | 11 | Boa base responsiva, mas precisa alinhar com tokens TES. |
| `Spacing & Sizing` | `Desktop`, `Mobile` | 14 | Base útil, mas não segue a nomenclatura pedida. |

Total observado: 67 variáveis locais.

### Problemas atuais em Variables

- O modo principal está como `Mode 1`, não `Light`.
- Muitas variáveis de cor usam `ALL_SCOPES`, o que polui pickers e dificulta governança.
- As collections não seguem a estrutura obrigatória:
  - `Color / Primitive`
  - `Color / Semantic`
  - `Typography`
  - `Spacing`
  - `Radius`
  - `Shadow`
  - `Size`
  - `Border`
  - `Opacity`
  - `Elevation`
  - `Component Tokens`
- Há nomes genéricos como `Color Scheme 1/Background`, `Color/Neutral Darkest`, `Roxo Principal`, `Azul ciano`.
- Não há hierarquia clara `primitive -> semantic -> component`.
- Não há tokens componentizados para botões, badges, inputs ou cards.

### Styles atuais

Paint styles encontrados:

- `Black`
- `White`
- `Grey`
- `Gradiente ciano`
- `Gradiente Roxo`

Text styles encontrados:

- Escala `Heading/H1` até `Heading/H6`.
- Escalas `Text/Large`, `Text/Medium`, `Text/Regular`, `Text/Small`, `Text/Tiny`.
- Famílias encontradas: `Plus Jakarta Sans`, `Roboto` e `Inter`.

Effect styles encontrados:

- `xxsmall`
- `xsmall`
- `small`
- `medium`
- `large`
- `xlarge`
- `xxlarge`

### Divergência tipográfica

A documentação e o código apontam:

- Display: `IvyPresto Display`, fallback `Cormorant Garamond` e `Playfair Display`.

Nota de 2026-06-17: os styles `TES/Display/IvyPresto/2XL`, `TES/Display/IvyPresto/XL`, `TES/Display/IvyPresto/LG` e `TES/Accent/IvyPresto` foram criados. Como a fonte ainda não aparece instalada/listada no Figma, os components continuam usando fallback seguro até a instalação da fonte. Os arquivos locais disponíveis de `IvyPresto Display` são itálicos; no produto, os cortes retos usam `IvyPresto Headline` via `@font-face` em `/public/fonts/ivy-presto`.
- UI/body: `Manrope`, fallback `Inter`.

O Figma atual usa:

- `Plus Jakarta Sans`
- `Roboto`
- `Inter`

Essa é uma das principais divergências de handoff. A decisão recomendada é padronizar o Design System em torno da documentação e do código, sem apagar a leitura visual existente: display emocional para landing/heros e fonte UI limpa para dashboards.

## 5. Storybook auditado

Status atual:

- Storybook não está instalado no `package.json`.
- Não há scripts `storybook` ou `build-storybook`.
- Não há pasta `.storybook`.
- Não há arquivos `*.stories.*`.
- O único artefato Storybook encontrado é o plano documental `docs/design-system/storybook-plan.md`.

Conclusão:

O Storybook existe como intenção de arquitetura, mas ainda não como implementação técnica. A otimização do Storybook deve começar com instalação e estrutura mínima, não com ajuste de stories existentes.

## 6. Código atual auditado

### Stack confirmada

- Next.js 15 no estado atual; a auditoria original foi produzida sobre a versão
  anterior do projeto.
- React 18.
- TypeScript.
- Tailwind CSS.
- shadcn/ui planejado via `components.json`.
- Radix Slot, CVA, clsx, lucide-react e tailwind-merge.

### Tokens já iniciados

`src/app/globals.css` já contém CSS Variables TES para:

- Brand colors.
- Surface colors.
- Text colors.
- Status colors.
- Font families.
- Radius.
- Shadows.
- Layout/sidebar/topbar.
- Tokens shadcn compatíveis em HSL.

`tailwind.config.ts` já mapeia parte desses tokens para:

- `brand`
- `surface`
- `tesText`
- `status`
- `fontFamily`
- `borderRadius`
- `boxShadow`
- `spacing`
- `zIndex`

### Lacunas no código

- Ainda não há biblioteca de componentes TES em `src/components/tes`.
- Ainda não há wrappers como `TESButton`, `TESCard`, `TESInput`, `TESBadge` e `TESTabs`.
- A página inicial é um setup técnico simples, não uma implementação completa das telas de referência.
- Há valores visuais hardcoded na página inicial, por exemplo o radial gradient do background.
- Não há stories, testes visuais ou documentação de props.

## 7. Padrões visuais encontrados

### Atmosfera

- Interface clara, branca e lavanda.
- Sensação acolhedora, premium e suave.
- Ilustrações com plantas, cristais, luz difusa, meditação e cenas calmas.
- Uso recorrente de hero/banners com imagem lateral.
- Cards com muita área branca e bordas lavanda sutis.

### Cor

Padrões recorrentes:

- Roxo profundo para títulos, CTA, ícones principais e navegação ativa.
- Lavanda clara para fundos suaves, estados ativos e skeletons.
- Ciano para destaque emocional em palavras e indicadores leves.
- Verde suave para sucesso/confirmação.
- Laranja suave para pendências ou atenção.
- Rosa/vermelho suave para criticidade.

### Tipografia

Padrões esperados:

- Display serifado para títulos emocionais e landing.
- Sans UI para navegação, dashboards, tabelas, botões e microcopy.
- Palavra em ciano/itálico em heros e títulos-chave.

### Layout

Padrões recorrentes:

- Público: header horizontal, hero grande, cards em grade, seções largas, FAQ e footer.
- Paciente: sidebar fixa, topbar, hero pessoal, cards de atividade, suporte lateral e favoritos.
- Básico: dashboard claro, foco em perfil, agenda, mensagens, serviços e upgrade contextual.
- Pro: dashboard mais denso, métricas, financeiro, avaliações e cards operacionais.
- Plus: experiência premium com IA, insights, reputação, audiência e cards analíticos.
- Admin: alta densidade, muitos KPIs, tabelas, filas de moderação, gráficos e saúde da plataforma.

### Formas

- Cards com radius entre 16px e 24px.
- Banners/heros com radius maior.
- Botões principais em roxo/gradiente, normalmente arredondados.
- Badges em fundos tintados com texto legível.
- Ícones lineares, compatíveis com lucide.
- Sidebars com item ativo em lavanda suave.

## 8. Componentes identificados

### P0 Base

- `Button`
- `IconButton`
- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `Switch/Toggle`
- `Badge`
- `Avatar`
- `Tabs`
- `Divider`
- `Tooltip`
- `Toast`
- `Skeleton`
- `Spinner/LoadingState`
- `EmptyState`
- `ErrorState`

### P0 Navigation

- `PublicHeader`
- `AppSidebar`
- `AdminSidebar`
- `SidebarItem`
- `Topbar`
- `Footer`
- `Breadcrumb`
- `Tabs`
- `Dropdown`
- `Pagination`

### P0 Layout

- `Container`
- `Section`
- `Grid`
- `PageShell`
- `DashboardShell`
- `AuthLayout`
- `DashboardHero`
- `SupportPanel`

### P0 Cards e blocos

- `Card`
- `HeroCard`
- `TherapyCard`
- `TherapistCard`
- `SessionCard`
- `MetricCard`
- `PlanCard`
- `PaymentSummary`
- `ProfileChecklist`
- `UpgradeBanner`
- `SupportCard`

### Produto específico

- `MatchingQuestionCard`
- `JourneyResultCard`
- `BookingStepper`
- `ReservationSummary`
- `AvailabilityPicker`
- `ServiceCard`
- `ReviewCard`
- `InsightCard`
- `AIRecommendationCard`
- `AIAssessorPanel`
- `PlusPatientJourney`
- `AdminModerationQueue`
- `VerificationPanel`
- `IntegrationStatusCard`
- `StatusBadge`
- `PlanBadge`
- `PaymentStatusBadge`
- `SessionStatusBadge`

### Componentes que devem ser tratados como composition, não como novos componentes base

- Blocos de dashboard formados por `Card + Badge + IconButton + Text`.
- Cards de suporte simples formados por `Card + Button`.
- Variações de plano formadas por `Badge/Plan` e tokens semânticos.
- Estados de bloqueio por plano formados por `EmptyState/BlockedFeature + CTA`.
- Blocos de métricas humanas formados por `MetricCard + Tooltip + trend badge`.

## 9. Tokens identificados

### Color / Primitive

Base a preservar e normalizar:

- `lavender`
- `purple`
- `cyan`
- `mint`
- `orange`
- `pink/red`
- `neutral`
- `white`

Tokens candidatos:

- `color.primitive.purple.900`
- `color.primitive.purple.700`
- `color.primitive.purple.600`
- `color.primitive.purple.500`
- `color.primitive.lavender.50`
- `color.primitive.lavender.100`
- `color.primitive.lavender.200`
- `color.primitive.cyan.500`
- `color.primitive.cyan.50`
- `color.primitive.mint.500`
- `color.primitive.mint.50`
- `color.primitive.orange.500`
- `color.primitive.orange.50`
- `color.primitive.pink.500`
- `color.primitive.pink.50`
- `color.primitive.neutral.0`
- `color.primitive.neutral.50`
- `color.primitive.neutral.100`
- `color.primitive.neutral.600`
- `color.primitive.neutral.900`

### Color / Semantic

Tokens candidatos:

- `color.semantic.background.default`
- `color.semantic.background.soft`
- `color.semantic.background.mist`
- `color.semantic.surface.default`
- `color.semantic.surface.elevated`
- `color.semantic.text.primary`
- `color.semantic.text.secondary`
- `color.semantic.text.muted`
- `color.semantic.text.inverse`
- `color.semantic.border.subtle`
- `color.semantic.border.default`
- `color.semantic.border.focus`
- `color.semantic.action.primary.default`
- `color.semantic.action.primary.hover`
- `color.semantic.action.primary.pressed`
- `color.semantic.status.success`
- `color.semantic.status.success.bg`
- `color.semantic.status.warning`
- `color.semantic.status.warning.bg`
- `color.semantic.status.error`
- `color.semantic.status.error.bg`
- `color.semantic.status.info`
- `color.semantic.status.info.bg`

### Typography

Tokens candidatos:

- `font.family.display`
- `font.family.body`
- `font.family.accent`
- `font.size.display.2xl`
- `font.size.display.xl`
- `font.size.display.lg`
- `font.size.heading.h1`
- `font.size.heading.h2`
- `font.size.heading.h3`
- `font.size.body.lg`
- `font.size.body.md`
- `font.size.body.sm`
- `font.size.caption`
- `font.size.micro`
- `font.weight.regular`
- `font.weight.medium`
- `font.weight.semibold`
- `font.weight.bold`
- `line.height.display`
- `line.height.body`
- `letter.spacing.default`

### Spacing

Base 4px:

- `spacing.0`
- `spacing.1` = 4
- `spacing.2` = 8
- `spacing.3` = 12
- `spacing.4` = 16
- `spacing.5` = 20
- `spacing.6` = 24
- `spacing.8` = 32
- `spacing.10` = 40
- `spacing.12` = 48
- `spacing.16` = 64
- `spacing.20` = 80
- `spacing.24` = 96

### Radius

- `radius.xs` = 6
- `radius.sm` = 8
- `radius.md` = 12
- `radius.card` = 18
- `radius.panel` = 22
- `radius.hero` = 28
- `radius.full` = 999

### Shadow / Elevation

- `shadow.none`
- `shadow.card`
- `shadow.soft`
- `shadow.float`
- `shadow.focus`
- `elevation.base`
- `elevation.sticky`
- `elevation.dropdown`
- `elevation.toast`
- `elevation.modal`
- `elevation.overlay`
- `elevation.tooltip`

### Size

- `size.icon.xs`
- `size.icon.sm`
- `size.icon.md`
- `size.icon.lg`
- `size.icon.xl`
- `size.touch.min`
- `size.sidebar.default`
- `size.sidebar.compact`
- `size.topbar.height`
- `size.container.public`
- `size.container.app`

### Border

- `border.width.none`
- `border.width.default`
- `border.width.strong`
- `border.color.subtle`
- `border.color.default`
- `border.color.focus`

### Opacity

- `opacity.disabled`
- `opacity.subtle`
- `opacity.overlay`
- `opacity.illustrationSoft`

### Component Tokens

Criar apenas quando houver necessidade real de handoff:

- `color.component.button.primary.background`
- `color.component.button.primary.background.hover`
- `color.component.button.primary.text`
- `color.component.button.secondary.background`
- `color.component.input.background`
- `color.component.input.border`
- `color.component.input.border.focus`
- `color.component.badge.success.background`
- `color.component.badge.success.text`
- `color.component.card.background`
- `color.component.card.border`
- `radius.component.button`
- `radius.component.card`
- `shadow.component.card`

## 10. Inconsistências encontradas

### Figma

- As telas principais estão rasterizadas, não editáveis.
- Não há componentes locais publicados ou component sets reutilizáveis.
- Variables existem, mas estão com nomenclatura genérica e coleções desalinhadas.
- Modo de cor está como `Mode 1`, não `Light`.
- Muitas variables usam `ALL_SCOPES`.
- Text styles atuais não batem com a tipografia da documentação/código.
- Routes no Figma usam acentos ou espaços em alguns nomes visuais:
  - `/como funciona`
  - `/app/configurações`
  - `/plus/serviços`
  - `/plus/avaliações`
  - `sua-jornada/resultado` sem barra inicial.
- Na auditoria original, o Figma tinha `/pro/inicio` e a documentação tratava
  `/pro` como entrada. A política aprovada em 2026-07-25 substitui ambos por
  `/terapeuta`.
- Alguns textos visuais usam termos que devem ser revisados com cuidado, por exemplo `Benchmark`, para não parecer comparação ansiosa ou competitiva.

### Código

- Tokens existem parcialmente em CSS Variables e Tailwind, mas não estão completos para todos os grupos solicitados.
- Não há componente TES implementado.
- Não há Storybook.
- Não há documentação técnica por componente em formato AI-friendly.
- Algumas classes usam valores arbitrários ou gradientes hardcoded.

### Produto / UX writing

- A linguagem geral está alinhada ao tom TES.
- Termos proibidos como `lead`, `funil`, `CTR` e `conversão` estão explicitamente marcados como proibidos na documentação.
- Algumas telas de referência usam expressões de alta carga emocional como transformação; isso deve ser tratado com cuidado para evitar promessa de resultado terapêutico.
- Métricas devem continuar sendo apresentadas como leitura humana, não cobrança de performance.

## 11. Riscos de handoff

| Risco | Impacto | Mitigação proposta |
|---|---|---|
| Telas rasterizadas no Figma | Dificulta extração fiel de spacing, radius e componentes | Criar Design System componentizado a partir dos padrões documentados e referências. |
| Variables genéricas | Dificulta uso consistente por designers/devs | Criar collections padronizadas e aliases `primitive -> semantic -> component`. |
| Tipografia divergente | Figma e código podem parecer produtos diferentes | Padronizar em IvyPresto Display com fallback Cormorant/Playfair + Manrope/Inter ou registrar decisão explícita se Figma mantiver outra família. |
| Storybook ausente | Não há validação entre Figma e código | Instalar Storybook e criar foundations/stories P0. |
| Componentes ausentes no código | shadcn pode ser usado cru e gerar inconsistência | Criar wrappers TES antes das telas finais. |
| Nomes de rotas divergentes | Pode gerar links errados e documentação confusa | Usar rotas canônicas no código e labels visuais com acento apenas na UI. |
| States não componentizados | Hover/focus/loading/error podem divergir | Criar variants/states reais no Figma e props equivalentes no Storybook. |
| Acessibilidade sem validação final | Risco de contraste insuficiente em lavandas/cianos claros | Validar contraste e foco antes do handoff final. |
| Termos de performance | Pode quebrar o tom acolhedor do produto | Documentar content guidelines por componente e revisar labels sensíveis. |

## 12. Proposta de padronização

### Direção

Preservar a identidade já existente:

- Branco, lavanda, roxo profundo, ciano e verdes suaves.
- Interface calma, clara e humana.
- Cards arredondados e leves.
- Ilustrações terapêuticas suaves.
- Dados com leitura humana.
- Progressão de planos sem pressão.

Não criar uma nova identidade visual.

### Variables

Criar ou reorganizar as collections no Figma com modo único `Light`:

1. `Color / Primitive`
2. `Color / Semantic`
3. `Typography`
4. `Spacing`
5. `Radius`
6. `Shadow`
7. `Size`
8. `Border`
9. `Opacity`
10. `Elevation`
11. `Component Tokens`

Regras:

- Usar aliases sempre que possível.
- Renomear/migrar padrões existentes quando for seguro.
- Evitar `ALL_SCOPES` quando houver escopo mais específico.
- Não criar `Dark` agora, porque não há base visual suficiente.
- Não criar modos por plano agora; usar tokens semânticos e variantes de componente.

### Componentes

Criar primeiro P0 e componentes comprovados nas telas:

1. `Button`
2. `IconButton`
3. `Badge`
4. `Input`
5. `Select`
6. `Checkbox`
7. `Switch`
8. `Avatar`
9. `Card`
10. `MetricCard`
11. `PlanCard`
12. `SessionCard`
13. `TherapyCard`
14. `TherapistCard`
15. `SidebarItem`
16. `AppSidebar`
17. `PublicHeader`
18. `Topbar`
19. `Tabs`
20. `EmptyState`
21. `LoadingState/Skeleton`

Depois avançar para componentes de produto:

- `MatchingQuestionCard`
- `JourneyResultCard`
- `BookingStepper`
- `ReservationSummary`
- `ProfileChecklist`
- `UpgradeBanner`
- `InsightCard`
- `AIRecommendationCard`
- `AIAssessorPanel`
- `PlusPatientJourney`
- `AdminModerationQueue`
- `VerificationPanel`

### Variants

Criar variants somente onde há uso real ou previsível:

- `Button`: `variant`, `size`, `state`, `icon`.
- `Input`: `state`, `size`, `icon`, `helperText`.
- `Badge`: `intent`, `style`, `size`.
- `Card`: `type`, `state`, `density`.
- `SidebarItem`: `profile`, `state`, `badge`.
- `MetricCard`: `tone`, `trend`, `state`.
- `PlanCard`: `plan`, `state`, `highlight`.

## 13. Plano de execução proposto

Este plano deve ser aprovado antes de alterações grandes no Figma ou no Storybook.

### Etapa 1 - Foundations no Figma

- Criar a página única `Design System`.
- Criar frames principais:
  - `00 — Cover`
  - `01 — Audit`
  - `02 — Foundations`
  - `03 — Tokens`
  - `04 — Colors`
  - `05 — Typography`
  - `06 — Spacing & Layout`
  - `07 — Components`
  - `08 — Navigation`
  - `09 — Patterns`
  - `10 — Templates`
  - `11 — Accessibility`
  - `12 — Documentation`
  - `13 — References`
- Criar collections de variables com modo `Light`.
- Documentar tokens visualmente na página.

### Etapa 2 - Componentes P0 no Figma

- Criar componentes base com Auto Layout.
- Aplicar variables.
- Criar variants essenciais.
- Documentar uso, estados, acessibilidade e metadata AI-friendly.
- Evitar componentes não comprovados.

### Etapa 3 - Patterns por perfil

- Criar exemplos reais por perfil:
  - Público
  - Paciente
  - Terapeuta Básico
  - Terapeuta Pro
  - Terapeuta Plus
  - Admin
- Usar composição de componentes, não duplicação.

### Etapa 4 - Storybook

- Instalar Storybook se aprovado.
- Criar foundations.
- Criar stories P0.
- Criar wrappers TES em código antes de stories finais.
- Mapear Figma variants para props reais.

### Etapa 5 - Sincronização e handoff

- Criar:
  - `tokens.md`
  - `FIGMA_VARIABLES_GUIDE.md`
  - `COMPONENT_ARCHITECTURE.md`
  - `COMPONENT_USAGE_GUIDELINES.md`
  - `STORYBOOK_AUDIT_REPORT.md`
  - `STORYBOOK_OPTIMIZATION_PLAN.md`
  - `FIGMA_STORYBOOK_SYNC_MAP.md`
  - `DESIGN_SYSTEM_FINAL_HANDOFF.md`
- Validar acessibilidade.
- Validar consistência visual.
- Registrar pendências e riscos restantes.

## 14. Decisões recomendadas antes da próxima etapa

1. Usar a documentação e o código como fonte principal de tipografia: `IvyPresto Display` com fallback `Cormorant Garamond`/`Playfair Display` para display e `Manrope`/`Inter` para UI.
2. Criar apenas modo `Light`.
3. Criar variables novas padronizadas e preservar variables antigas até a migração estar segura.
4. Tratar as telas rasterizadas como referência visual, não como componentes reaproveitáveis.
5. Começar por P0 e evitar componentes avançados sem uso claro.
6. Instalar Storybook apenas depois da aprovação do plano.
7. Revisar termos sensíveis como `Benchmark`, `Clientes` e mensagens de transformação para manter o tom TES.

## 15. Checklist de qualidade da auditoria

- [x] Documentação do Design System lida integralmente.
- [x] Produto, sitemap, inventário de páginas e rotas analisados.
- [x] Figma analisado antes de alterações.
- [x] Referências por perfil analisadas.
- [x] Código atual analisado.
- [x] Storybook auditado.
- [x] Padrões visuais identificados.
- [x] Inconsistências registradas.
- [x] Componentes identificados.
- [x] Tokens identificados.
- [x] Riscos de handoff registrados.
- [x] Plano de execução preparado.
- [x] Nenhuma alteração grande feita no Figma ou Storybook antes de aprovação.

## Fase 2 — Lacunas encontradas e expansão recomendada

Data: 2026-06-14  
Status: auditoria de expansão concluída antes de novas alterações grandes no Figma ou Storybook.

### Fontes revisitadas

- Página atual `Design System` no Figma.
- Página Figma `↳ Design Telas`, com 57 telas rasterizadas.
- Referências locais por perfil: Público, Paciente, Terapeuta Básico, Terapeuta Pro, Terapeuta Plus e Admin.
- `docs/design-system/component-inventory.md`.
- `docs/product/page-inventory.md`.
- `COMPONENT_ARCHITECTURE.md`.
- `COMPONENT_USAGE_GUIDELINES.md`.
- `FIGMA_STORYBOOK_SYNC_MAP.md`.
- `STORYBOOK_OPTIMIZATION_PLAN.md`.
- `src/app/globals.css` e `tailwind.config.ts`.

### Estado do Design System no Figma antes da expansão

No momento da auditoria de lacunas, antes da Fase 2, a página estava organizada em três frames principais:

- `Design System / Foundations`;
- `Design System / Component Library`;
- `Design System / Product Patterns & Templates`.

Component sets existentes:

- `Atoms/Button` — 48 variants;
- `Atoms/Form Controls` — 16 variants;
- `Atoms/Badge` — 9 variants;
- `Atoms/Boolean Control` — 4 variants;
- `Molecules/Navigation Item` — 4 variants;
- `Molecules/Card` — 5 variants;
- `Molecules/Tabs` — 4 variants;
- `Templates/Dashboard Shell` — 6 variants.

Componentes top-level existentes:

- `Organisms/Public Header`;
- `Organisms/App Sidebar`;
- `Product/TherapistCard`;
- `Product/TherapyCard`;
- `Product/JourneyResultCard`;
- `Product/MetricCard`;
- `Product/AIRecommendationCard`;
- `Product/CarefulBenchmark`.

Conclusão naquele momento: a base estava correta, mas ainda era uma biblioteca enxuta. As referências reais mostravam muitos padrões recorrentes ainda não componentizados.

### Padrões recorrentes encontrados nas referências

#### Padrões globais

- Sidebar com navegação por perfil, CTA de plano/suporte e ilustração lavanda no rodapé.
- Topbar com avatar, notificações, estado de conta e contexto de atualização.
- Hero interno com imagem terapêutica, saudação, resumo e ações rápidas.
- Cards brancos com borda lavanda, sombra leve e radius alto.
- Faixas ilustradas com portal, cristais, plantas, meditação e luz suave.
- Blocos laterais de apoio: suporte, próximos passos, dicas, alertas, política e ajuda.
- Tabelas com filtros, chips de status, ações por linha e paginação.
- Cards de métrica com ícone, número, variação, microcopy e, em alguns casos, sparkline.
- Banners de upgrade ou sugestão com linguagem acolhedora.
- Empty states e loading states ainda aparecem mais como intenção do que como componentes.

#### Público

- Hero público com imagem integrada e CTAs primário/secundário.
- Cards de etapas da jornada.
- Cards de terapia em grid e lista.
- Cards de terapeuta em lista com foto, tags, avaliação, preço/horário e CTA.
- Cards de planos e tabela de comparação.
- Matching/Jornada com cards selecionáveis e checkboxes.
- Resultado de jornada com cards de caminho terapêutico em lista.
- Perfil de terapeuta com hero, serviços, agenda, avaliações, FAQ e relacionados.

#### Paciente

- Próxima sessão e detalhe de sessão com link, políticas e suporte.
- Lista/tabela de sessões com status.
- Chat com lista de conversas, mensagens, composer e cards de orientação.
- Favoritos com terapeuta/terapia em lista.
- Pagamentos com resumo, transações, método e suporte.
- Configurações com tabs, formulários, toggles e seções de segurança/privacidade.
- Ajuda com busca, cards de categoria, FAQ e tickets.

#### Terapeuta Básico

- Dashboard com progresso de perfil, próximos passos, agenda, sessões e mensagens.
- Checklist de perfil recorrente.
- Agenda mensal/semanal com sessões e dicas laterais.
- Pacientes e sessões em tabela com limites do plano.
- Serviços com cards/listas, limite de uso e CTA de upgrade.
- Perfil público com preview, checklist e visibilidade.
- Upgrade com cards de plano e comparação.

#### Terapeuta Pro

- Dashboard com KPIs, próximas sessões, avaliações recentes e resumo financeiro.
- Agenda com calendário semanal, blocos de horário e solicitações.
- Financeiro com KPIs, line chart, tabela e side summary.
- Métricas e insights com cards, gráficos, heatmap e recomendações cuidadosas.
- Avaliações com rating summary, lista, resposta e filtros.
- Serviços com tabela, indicadores e recomendações.

#### Terapeuta Plus

- Dashboard premium com KPIs, donut/progress chart, heatmap, reputação e recomendações.
- Benchmark cuidadoso com comparação não competitiva, oportunidades e gráficos.
- Agenda Plus com calendário, demanda por horário e sugestões.
- Pacientes com indicadores de retorno, risco/atenção e cards de acompanhamento.
- Mensagens com sugestões IA e painel lateral.
- Serviços Plus com demanda, clareza do serviço e sugestões inteligentes.
- Financeiro completo com bar chart, tabelas e resumo lateral.
- Avaliações com sentiment chart, palavras recorrentes, lista e recomendações.
- Insights com heatmap, barras, donut e cards de ação.

#### Admin

- Dashboard denso com KPI grid, gráficos, filas de atenção e estado do sistema.
- Profissionais, pacientes, sessões, pagamentos, avaliações, assinaturas e terapias em tabelas.
- Painéis laterais de decisão e detalhe.
- Verificações com preview de documentos, checklist, histórico e ações.
- Moderação com estados críticos, badges e cards de decisão.
- Gráficos de linha, donut, barras, distribuição e mini charts em várias telas.

### Componentes existentes que precisam de refinamento

| Componente atual | Lacuna | Recomendação |
|---|---|---|
| `Molecules/Card` | Genérico demais para cobrir tabela, métrica, insight, suporte e estado. | Manter como base e criar composições específicas: KPI, summary, support, empty, chart container. |
| `Product/MetricCard` | Ainda não cobre comparação, sparkline, período, tendência e estados sem dados. | Expandir variantes: default, comparison, sparkline, noData, loading. |
| `Product/TherapistCard` | Precisa refletir grid/lista/favorito/perfil. | Criar variantes ou componentes compostos para grid, list e compact. |
| `Product/TherapyCard` | Precisa cobrir grid, resultado de jornada e detalhe. | Criar variantes grid, result, compact e selected. |
| `Product/JourneyResultCard` | Falta conexão com seleção/resultado e CTA por caminho. | Adicionar estado high/medium/exploratory e saved/loading. |
| `Product/AIRecommendationCard` | Precisa de applied, dismissed, reviewBeforeApply e loading. | Expandir states e criar composição para painel IA. |
| `Product/CarefulBenchmark` | Precisa de relação com charts e linguagem não competitiva. | Transformar em pattern com cards de sinais, gráfico e recomendação. |
| `Templates/Dashboard Shell` | Shell ainda abstrato perto das telas reais. | Refinar com hero interno, sidebar visual, topbar, right rail, footer e floating help. |
| `Atoms/Form Controls` | Agrupa input/search/select/textarea, mas filtros e save bars aparecem muito. | Criar FilterBar, SearchWithFilters e SaveBar como molecules. |
| `Atoms/Badge` | Cobre tons, mas faltam status específicos. | Adicionar documentação/uso para sessão, pagamento, verificação, avaliação e plano. |

### Componentes novos recomendados

#### Assets e ícones

Registro histórico da Fase 2: naquele momento não havia uma biblioteca ampla de ícones adicionada ao arquivo, então foi recomendada uma biblioteca própria mínima, linear, leve e consistente.

Atualização da Fase 3: o arquivo agora possui a página `ícones`, com componentes Lucide reutilizáveis. Para recriações de telas, a página `ícones` deve ser consultada antes da biblioteca mínima criada no `Design System` e antes de qualquer placeholder.

Component set recomendado:

- `Icon/Home/24`
- `Icon/Sessions/24`
- `Icon/Calendar/24`
- `Icon/Messages/24`
- `Icon/Patients/24`
- `Icon/Therapists/24`
- `Icon/Therapies/24`
- `Icon/Payments/24`
- `Icon/Profile/24`
- `Icon/Settings/24`
- `Icon/Support/24`
- `Icon/Journey/24`
- `Icon/Favorites/24`
- `Icon/Reviews/24`
- `Icon/Metrics/24`
- `Icon/Insights/24`
- `Icon/AI/24`
- `Icon/Reputation/24`
- `Icon/Highlight/24`
- `Icon/Security/24`
- `Icon/Admin/24`
- `Icon/Filter/20`
- `Icon/Search/20`
- `Icon/Calendar/20`
- `Icon/Status/Success/16`
- `Icon/Status/Warning/16`
- `Icon/Status/Error/16`
- `Icon/Status/Info/16`
- `Icon/Loading/16`

Assets recorrentes a documentar como peças reutilizáveis:

- `Asset/IllustrationTile/Crystal`
- `Asset/IllustrationTile/Portal`
- `Asset/IllustrationTile/Meditation`
- `Asset/IllustrationTile/Plant`
- `Asset/SoftDivider`
- `Asset/HeroImageMask`
- `Asset/SidebarBloom`

#### Charts & Data Visualization

Componentes recomendados:

- `Data/ChartContainer`
- `Data/LineChart`
- `Data/BarChart`
- `Data/DonutProgress`
- `Data/MiniSparkline`
- `Data/ProgressBar`
- `Data/KPICard`
- `Data/MetricComparisonCard`
- `Data/Heatmap`
- `Data/RatingSummary`
- `Data/EmptyChartState`
- `Data/LoadingChartState`

Linguagem recomendada:

- `Pessoas interessadas`;
- `Pessoas que quiseram conhecer melhor`;
- `Caminhos até o agendamento`;
- `Sinais para observar`;
- `Horários com maior procura`;
- `Dados insuficientes para comparar com cuidado`.

Evitar:

- `Conversão`;
- `Leads`;
- `CTR`;
- `Baixa performance`;
- `Ranking inferior`;
- `Benchmark inferior`.

#### Navigation e layout

- `Organisms/App Topbar`
- `Organisms/Profile Sidebar Support`
- `Molecules/Filter Bar`
- `Molecules/Search With Filters`
- `Molecules/Pagination`
- `Molecules/Save Bar`
- `Molecules/Right Rail`
- `Molecules/Support Card`
- `Molecules/Policy Card`
- `Molecules/Floating Help Button`

#### Produto específico

- `Product/SessionCard`
- `Product/NextSessionBlock`
- `Product/SessionDetailPanel`
- `Product/PaymentSummary`
- `Product/PlanCard`
- `Product/ProfileChecklist`
- `Product/UpgradeBanner`
- `Product/ServiceCard`
- `Product/ReviewCard`
- `Product/PatientRow`
- `Product/VerificationPanel`
- `Product/AdminKPIGrid`
- `Product/ModerationQueue`
- `Product/AIInsightPanel`
- `Product/PatientJourneyTimeline`

#### Patterns por perfil

- `Pattern/PublicHero`
- `Pattern/MatchingQuestionGrid`
- `Pattern/TherapistSearchResults`
- `Pattern/PatientOverview`
- `Pattern/TherapistDashboard`
- `Pattern/ProMetricsDashboard`
- `Pattern/PlusInsightsDashboard`
- `Pattern/AdminOverview`
- `Pattern/AdminTableWithSidePanel`
- `Pattern/ChatLayout`
- `Pattern/SettingsLayout`

### Estados faltantes

- Empty chart.
- Loading chart.
- Dados insuficientes.
- Sem sessões.
- Sem favoritos.
- Sem avaliações.
- Sem pacientes.
- Sem resultados de busca.
- Erro calmo com próximo passo.
- Falha de pagamento.
- Horário expirado.
- Perfil incompleto.
- Recurso limitado pelo plano.
- Sugestão IA indisponível.
- Sugestão IA aplicada.
- Item denunciado/em moderação.
- Documento pendente/aprovado/precisa ajuste.

### Templates que precisam ficar mais fiéis

- Dashboard Paciente: incluir próxima sessão, favoritos, suporte e cards rápidos.
- Dashboard Básico: incluir progresso de perfil, limites do plano e upgrade contextual.
- Dashboard Pro: incluir KPI grid, sessões, financeiro e avaliações.
- Dashboard Plus: incluir insights, IA, reputação, heatmap e recomendações.
- Admin: incluir KPI grid, tabelas, filas de atenção e side panels.
- Público: incluir hero integrado, etapas, terapia/terapeuta, planos e FAQ.

### Variants vs novos componentes

Criar como variants/properties:

- `TherapistCard`: grid/list/compact/favorite.
- `TherapyCard`: grid/result/selected/compact.
- `MetricCard`: default/comparison/sparkline/noData/loading.
- `Badge`: status/session/payment/plan/review/verificação via intent e label.
- `Dashboard Shell`: patient/basic/pro/plus/admin com slots.
- `AIRecommendationCard`: default/review/applied/dismissed/loading.

Criar como novos componentes:

- Icon library.
- Chart primitives.
- Filter/search bar.
- Data table row/table shell.
- Profile checklist.
- Session card/detail.
- Payment summary.
- Plan card.
- Review card.
- Admin side panel/verification panel.
- Chat layout.
- Right rail/support card.

### Riscos de handoff encontrados na Fase 2

| Risco | Evidência | Mitigação recomendada |
|---|---|---|
| Código precisava alinhar cores antigas | `src/app/globals.css` mantinha a paleta antiga na auditoria original. | CSS variables e HSL shadcn foram alinhados à paleta atual antes do Storybook. |
| Storybook segue ausente | Não há `.storybook`, stories ou dependências `@storybook/*`. | Instalar somente após fechar lista de componentes Figma Fase 2. |
| Telas estáticas são rasterizadas | Figma `↳ Design Telas` tem 57 frames com imagem única. | Usar como referência visual, não como fonte componentizada. |
| Componentes atuais ainda são poucos | Página `Design System` tem 8 component sets e 8 componentes top-level. | Expandir em blocos incrementais e validar visualmente cada seção. |
| Ícones tinham biblioteca limitada na Fase 2 | O arquivo dependia de set mínimo no `Design System`; na Fase 3 foi adicionada a página `ícones` com Lucide. | Usar `ícones` como primeira fonte para recriações e manter o set mínimo do Design System para aliases/produto. |
| Gráficos ainda não têm componentes | Pro, Plus e Admin usam line, bar, donut, progress, heatmap e sparkline nas referências. | Criar `Charts & Data Visualization` antes de templates avançados. |
| Linguagem de dados pode escorregar para performance | Telas usam métricas e benchmark. | Documentar termos humanos e evitar pressão/competição. |

### Plano de expansão recomendado

1. Criar frames internos na página única `Design System`:
   - `Components — Expanded`;
   - `Product Components`;
   - `Icon Library`;
   - `Charts & Data Visualization`;
   - `Dashboard Patterns`;
   - `Admin Patterns`;
   - `Patient Patterns`;
   - `Therapist Patterns`;
   - `AI Metadata`.
2. Usar a página `ícones` como fonte primária de ícones nas recriações e manter a biblioteca mínima do Design System como aliases/produto.
3. Criar primitives de charts e estados de dados.
4. Refinar cards existentes por variants quando fizer sentido.
5. Criar componentes de produto recorrentes.
6. Refinar templates por perfil a partir das referências reais.
7. Atualizar `COMPONENT_ARCHITECTURE.md`, `COMPONENT_USAGE_GUIDELINES.md`, `FIGMA_STORYBOOK_SYNC_MAP.md` e `DESIGN_SYSTEM_FINAL_HANDOFF.md`.
8. Rodar auditoria visual no Figma e corrigir overflow, cortes, contraste, nomes genéricos e metadados ausentes.

Este plano deve ser aprovado antes de iniciar alterações grandes no Figma ou no Storybook.

### Fase 2 — Execução realizada após aprovação

Atualização: 2026-06-15  
Status: expansão executada no Figma e documentação atualizada.

Após aprovação, a expansão foi criada dentro da mesma página única `Design System`, sem recriar a biblioteca do zero e sem alterar a identidade visual.

Frame criado/expandido:

- `Design System / Phase 2 Expansion`

Seções internas criadas:

- `Components — Expanded`
- `Product Components`
- `Icon Library`
- `Charts & Data Visualization`
- `Dashboard Patterns`
- `Admin Patterns`
- `Patient Patterns`
- `Therapist Patterns`
- `AI Metadata`

Componentes criados:

- 8 componentes em `Components — Expanded`;
- 14 componentes em `Product Components`;
- 29 ícones lineares;
- 7 assets simples;
- 12 componentes de dados/gráficos;
- 15 patterns por perfil;
- 2 blocos de documentação `AI Metadata`.

Componentes e patterns adicionados:

- `Molecules/FilterBar`, `Molecules/SearchWithFilters`, `Molecules/RightRail`, `Molecules/SupportCard`, `Molecules/PolicyCard`, `Molecules/SaveBar`, `Molecules/FloatingHelpButton`, `Organisms/AppTopbar`;
- `Product/SessionCard`, `Product/NextSessionBlock`, `Product/SessionDetailPanel`, `Product/PaymentSummary`, `Product/PlanCard`, `Product/ProfileChecklist`, `Product/UpgradeBanner`, `Product/ServiceCard`, `Product/ReviewCard`, `Product/PatientRow`, `Product/VerificationPanel`, `Product/ModerationQueue`, `Product/AIInsightPanel`, `Product/PatientJourneyTimeline`;
- `Data/ChartContainer`, `Data/LineChart`, `Data/BarChart`, `Data/DonutProgress`, `Data/MiniSparkline`, `Data/ProgressBar`, `Data/KPICard`, `Data/MetricComparisonCard`, `Data/Heatmap`, `Data/RatingSummary`, `Data/EmptyChartState`, `Data/LoadingChartState`;
- `Pattern/PublicHero`, `Pattern/TherapistSearchResults`, `Pattern/MatchingQuestionGrid`, `Pattern/DashboardMetricsGrid`, `Pattern/PatientOverview`, `Pattern/PatientSessionDetail`, `Pattern/ChatLayout`, `Pattern/SettingsLayout`, `Pattern/TherapistDashboard`, `Pattern/ProMetricsDashboard`, `Pattern/PlusInsightsDashboard`, `Pattern/TherapistProfileEditor`, `Pattern/AdminOverview`, `Pattern/AdminTableWithSidePanel`, `Pattern/VerificationReview`.

### Auditoria visual e teste de qualidade da Fase 2

Verificações executadas no Figma:

- sem nomes genéricos nas seções criadas;
- sem componentes sem metadados;
- sem componentes sem descrição;
- sem overflow horizontal nas seções após correção;
- seções exportadas internamente como PNG para validar renderização;
- vetores horizontais com altura geométrica zero mantidos apenas quando eram strokes visíveis de ícones ou gráficos.

Resultado:

- `Design System / Phase 2 Expansion` registra 87 componentes/assets/patterns no histórico da Fase 2; a seção reorganizada `Design System / Componentes` possui 88 componentes únicos por incluir `Product/TherapyVisualCard`;
- todas as seções da Fase 2 renderizaram;
- a documentação foi atualizada para refletir a expansão.

### Documentação atualizada na Fase 2

- `DESIGN_SYSTEM_AUDIT_REPORT.md`
- `COMPONENT_ARCHITECTURE.md`
- `COMPONENT_USAGE_GUIDELINES.md`
- `FIGMA_STORYBOOK_SYNC_MAP.md`
- `STORYBOOK_OPTIMIZATION_PLAN.md`
- `DESIGN_SYSTEM_FINAL_HANDOFF.md`

### Pendências após a Fase 2

- Storybook segue não instalado.
- Componentes React ainda precisam ser implementados.
- Tokens do código precisam ser alinhados antes das stories.
- `Data/*` deve ser implementado com resumo textual acessível.
- `Icon/*` deve aceitar label acessível quando usado sem texto visível.

## Fase 3 — Auditoria visual de recriações

### `/terapeutas` — corte lateral e desalinhamento

Atualização: 2026-06-15  
Status: corrigido no Figma.

Problemas encontrados:

- a QA estrutural inicial aprovou a página porque nenhum filho direto era maior que o frame;
- visualmente, os cards horizontais da listagem estavam cortados à direita;
- a causa era soma interna de colunas maior que a largura útil do card;
- `Search and Filters`, `Results / Therapist List` e `CTA / Find Support` estavam funcionais, mas precisavam de centralização explícita no frame de `1055px`;
- o padrão de card horizontal apareceu como recorrente e não deveria ficar como composição manual solta.

Correções aplicadas:

- criação do componente `Product/TherapistResultCard` na página `Design System`;
- reconstrução da listagem da página `Page / Público / Terapeutas` com 6 cards `TherapistResultCard`;
- centralização das seções principais em `x=72`, largura `911px`;
- remoção de cortes internos em cards e de overflow lateral;
- revisão visual lado a lado com `Reference / Público / Terapeutas`.

Resultado de QA:

- largura editável: `1055px`;
- altura editável: `1976px`;
- `0` placeholders;
- `0` nomes genéricos no frame consolidado e nos componentes públicos refinados;
- `0` textos sem estilo;
- `0` overflow de página;
- `0` cortes internos nos cards;
- `6` cards horizontais de terapeuta padronizados.

Regra adicionada ao processo:

- a QA visual deve verificar overflow interno de componentes compostos, não apenas largura de filhos diretos da página;
- quando uma composição recorrente corrige problema real de layout, ela deve virar componente no `Design System` e ser documentada no mesmo ciclo.

### `/terapeutas/:slug` — seção de avaliações ausente

Atualização: 2026-06-15  
Status: corrigido no Figma.

Problemas encontrados:

- a recriação inicial estava visualmente incompleta em relação à referência;
- havia menção a avaliações no rating do hero, mas faltava a seção real de `Avaliações`;
- o bloco inferior agrupava perguntas frequentes e recomendações, mas não reproduzia a organização visual da referência;
- a tela precisava separar melhor `Próximos horários disponíveis`, `Avaliações`, `Perguntas frequentes` e `Terapeutas semelhantes`.

Correções aplicadas:

- reconstrução do bloco `Profile Details` em duas colunas;
- coluna esquerda com `Próximos horários disponíveis` e `Perguntas frequentes`;
- coluna direita com `Avaliações` e `Terapeutas semelhantes`;
- inclusão de resumo de avaliação, estrelas, três cards compactos de comentários e nota de privacidade;
- ajuste de overflow interno no grid de terapeutas semelhantes.

Resultado de QA:

- largura editável: `1055px`;
- altura editável: `1606px`;
- `0` placeholders;
- `0` nomes genéricos;
- `0` textos sem estilo;
- `0` overflow de página;
- `0` cortes internos em componentes compostos;
- cobertura visual confirmada para hero, terapias oferecidas, horários, avaliações, FAQ, terapeutas semelhantes e footer.

Regra reforçada:

- a presença de uma palavra no hero ou em metadados não conta como cobertura de seção; a QA visual deve validar se a seção equivalente da referência existe como bloco próprio quando ela aparece no print.

### Página `ícones` — integração ao processo de recriação

Atualização: 2026-06-15  
Status: incorporado ao fluxo `recreate_figma_pages`.

Contexto:

- foi adicionada ao arquivo Figma uma página chamada `ícones`;
- a página contém uma biblioteca ampla de componentes Lucide;
- esses ícones devem ser usados antes de qualquer marcador genérico, bolinha, vetor improvisado ou placeholder de ícone.

Regra de processo:

- inspecionar a página `ícones` durante a etapa de discovery;
- buscar ícones por termos semânticos como `calendar`, `heart`, `shield`, `star`, `user`, `help`, `share`, `clock`, `message`, `video`, `filter` e sinônimos próximos;
- usar correspondência exata quando existir;
- quando não existir, usar substituição semântica próxima e nomear o layer com o ícone escolhido e a intenção de UI;
- registrar aproximações quando o ícone usado não for literal.

Teste aplicado:

- tela `Page / Público / Terapeuta Perfil`;
- 14 instâncias de ícones vindas da página `ícones`;
- ações: `calendar-check`, `heart`, `share-2`;
- confiança: `hand-heart`, `shield-check`, `heart-pulse`;
- terapias: `brain`, `hand-heart`, `heart-pulse`, `leaf`;
- blocos inferiores: `calendar-check`, `star`, `circle-help`, `users-round`.

Resultado de QA:

- `0` placeholders;
- `0` nomes genéricos;
- `0` textos sem estilo;
- `0` overflow de página;
- `0` cortes internos;
- cobertura confirmada para agenda, avaliações, FAQ e terapeutas semelhantes com ícones reais.

## Consolidação pública das páginas recriadas

Atualização: 2026-06-15  
Status: concluído.

Escopo auditado:

- `QA Pair / Público / Home` (`12386:2`);
- `QA Pair / Público / Para Terapeutas` (`12392:38`);
- `QA Pair / Público / Planos Para Terapeutas` (`12417:212`);
- `QA Pair / Público / Terapeutas` (`12425:369`);
- `QA Pair / Público / Terapeuta Perfil` (`12441:380`);
- `QA Pair / Público / Terapias` (`12465:430`);
- `QA Pair / Público / Terapia Detalhe` (`12486:566`);
- `QA Pair / Público / Sua Jornada` (`12501:611`);
- `QA Pair / Público / Resultado` (`12521:623`);
- `QA Pair / Público / Como Funciona` (`12532:662`).

Componentes consolidados no `Design System / Public Reusable Consolidation` (`12548:136`):

- `Brand/OfficialLogo` (`12548:140`);
- `Organisms/Public Footer` (`12548:142`);
- `Molecules/FAQAccordion` (`12548:162`);
- `Product/JourneyStepCard` (`12548:165`);
- `Product/JourneyDetailCard` (`12548:170`);
- `Product/JourneyResultCard/Wide` (`12548:175`).

Aplicações realizadas:

- `Organisms/Public Header` (`12335:465`) atualizado com o logo oficial;
- `/como-funciona` recebeu 4 instâncias de `Product/JourneyStepCard`, 6 de `Product/JourneyDetailCard` e footer por instância;
- `/sua-jornada/resultado` recebeu 3 instâncias de `Product/JourneyResultCard/Wide` e footer por instância;
- nomes residuais com `Placeholder` foram substituídos por nomes semânticos de artwork ou icon slot.

Resultado de QA final:

- todas as páginas editáveis públicas mantêm largura `1055px`;
- `Page / Público / Resultado` (`12521:631`) validada com largura `1055px`;
- `0` nomes genéricos;
- `0` placeholders;
- `0` overflow horizontal por bounding box absoluto;
- frames estáticos de referência preservados.

Observação:

- o logo oficial foi usado exatamente como recebido em `docs/design-system/assets/logo-oficial-terapeuta-eu-sou.png`; a imagem é um lockup horizontal largo e pode parecer cortada no lado direito.

## Refinamento visual do frame público reutilizável

Atualização: 2026-06-15  
Status: concluído.

Escopo refinado:

- `Design System / Public Reusable Consolidation` (`12548:136`);
- `Brand/OfficialLogo` (`12548:140`);
- `Organisms/Public Header` (`12335:465`);
- `Organisms/Public Footer` (`12548:142`);
- `Molecules/FAQAccordion` (`12548:162`);
- `Product/JourneyStepCard` (`12548:165`);
- `Product/JourneyDetailCard` (`12548:170`);
- `Product/JourneyResultCard/Wide` (`12548:175`).

Ajustes realizados:

- frame reorganizado em `Header`, `Audit Summary`, `Master Components / Public Core`, `Usage Examples` e `Implementation Notes`;
- componentes mestres posicionados dentro da seção documental, sem nós mestres soltos em `(0,0)`;
- `Organisms/Public Footer` refinado para `1055x236`, com logo oficial, colunas e links sem corte;
- `Molecules/FAQAccordion` validado em `620x64`, com exemplos collapsed/expanded/focus;
- `Product/JourneyStepCard` refinado para `210x332`, com número, slot de ícone e textos auto-height;
- `Product/JourneyDetailCard` refinado para `330x170`, corrigindo compressão de descrição e ação;
- `Product/JourneyResultCard/Wide` refinado para `923x220`, com badge, tags, contagem de terapeutas e CTAs;
- `Organisms/Public Header` recebeu estilos `TES/*` nos textos do componente mestre.

QA estrutural do frame `12548:136`:

- `0` nomes genéricos;
- `0` placeholders;
- `0` overflow horizontal ou vertical;
- `0` textos sem estilo TES;
- `0` containers com altura residual de `1px`;
- screenshot final validado visualmente;
- screenshots individuais gerados para os 6 componentes refinados.

QA das páginas dependentes após refinamento:

- `Page / Público / Resultado` (`12521:631`): largura `1055px`, altura ajustada para `1786px`, `0` overflow horizontal/vertical, `0` placeholders, `0` textos sem estilo TES.
- `Page / Público / Como Funciona` (`12532:670`): largura `1055px`, altura ajustada para `2460px`, `0` overflow horizontal/vertical, `0` placeholders, `0` textos sem estilo TES.
- Footers nas duas páginas atualizados para instâncias de `Organisms/Public Footer` em `1055x236`.

Limitação / inferência:

- A página `ícones` (`12450:506`) foi consultada antes de criar/refinar slots visuais. Alguns ícones existentes renderizaram como glyphs preenchidos/quadrados em screenshots isolados; por isso, os slots visuais dos componentes refinados usam vetores compatíveis com Lucide e nomes semânticos até uma correção dedicada da biblioteca de ícones.

## Auditoria visual — Recent Product Components

Atualização: 2026-06-16  
Status: concluído no Figma e documentação atualizada.

Escopo auditado:

- página Figma `    ↳ Design System` (`12304:2`);
- frame `Design System / Recent Product Components` (`12829:626`);
- 12 componentes mestres recentes extraídos das páginas de Aura IA, Histórico de Atendimento, Financeiro, Perfil Público e Serviços Plus.

Problemas encontrados antes do refinamento:

- componentes estavam corretos como inventário, mas com qualidade visual inferior ao restante da biblioteca;
- vários componentes usavam `Inter` localmente em vez de estilos `TES/*`;
- grids de seção tinham alturas excessivas ou insuficientes;
- alguns headers e subframes internos tinham altura técnica de `1px`, ocultando textos em screenshots;
- duas tabelas ultrapassavam levemente o bounds do componente;
- `Product/ServicePlusCard` escondia conteúdo e métricas por subframes colapsados;
- o nome do paciente em `Product/PatientHeroProfile` usava fonte display ausente no ambiente e foi migrado para `TES/Heading/H1`.

Ajustes realizados:

- frame reestruturado em `Library Header` e seções por domínio;
- todos os componentes foram refinados com Auto Layout no componente principal;
- componentes passaram a usar estilos `TES/Display`, `TES/Heading`, `TES/Body`, `TES/Caption` e `TES/Micro`;
- fills, bordas, shadows, radius e spacing foram realinhados aos tokens/estilos TES disponíveis no Figma;
- alturas dos componentes foram corrigidas para acomodar conteúdo real;
- headers e subframes internos foram corrigidos para não clipar texto;
- `Product/ServicePlusCard` foi refinado como componente horizontal com imagem placeholder, conteúdo e métricas visíveis;
- `Section / Aura IA` foi compactada depois da captura visual para remover espaço vazio excessivo.

Componentes validados:

| Figma Component | Node ID | Tamanho após refinamento |
|---|---:|---:|
| `Product/AuraPriorityOfDay` | `12829:632` | `530x380` |
| `Data/AuraMonthlyComparison` | `12829:648` | `530x380` |
| `Data/ProfileTrafficPaths` | `12829:682` | `530x380` |
| `Product/PatientHeroProfile` | `12829:715` | `530x420` |
| `Product/SessionMemoryTable` | `12829:753` | `800x420` |
| `Product/UpcomingAppointments` | `12829:784` | `530x420` |
| `Data/RevenueEvolutionChart` | `12829:815` | `800x400` |
| `Product/FinancialTransactionsTable` | `12829:831` | `800x400` |
| `Product/PayoutCalendar` | `12829:870` | `530x360` |
| `Product/RecentPayouts` | `12829:887` | `560x360` |
| `Product/PublicProfilePreview` | `12829:907` | `760x620` |
| `Product/ServicePlusCard` | `12829:955` | `760x260` |

QA final no Figma:

- `12` componentes encontrados;
- `0` overflow direto em componentes;
- `0` overflow nos grids das seções;
- `0` fontes ausentes;
- `0` frames internos com texto colapsado;
- `0` cabeçalhos cortados;
- todos os componentes têm descrição no painel Figma;
- screenshot final validado visualmente.

Auditoria de tokens e styles:

- Collections TES ativas em modo `Light`: `Color / Primitive`, `Color / Semantic`, `Typography`, `Spacing`, `Radius`, `Shadow`, `Size`, `Border`, `Opacity`, `Elevation`, `Component Tokens`;
- total ativo TES: `189` variables;
- aliases encontrados: `67`;
- aliases quebrados: `0`;
- estilos de texto TES disponíveis: `TES/Display/2XL`, `TES/Display/XL`, `TES/Display/LG`, `TES/Heading/H1`, `TES/Heading/H2`, `TES/Heading/H3`, `TES/Body/LG`, `TES/Body/MD`, `TES/Body/SM`, `TES/Caption`, `TES/Micro`;
- estilos de sombra TES disponíveis: `TES/Shadow/None`, `TES/Shadow/Card`, `TES/Shadow/Soft`, `TES/Shadow/Float`, `TES/Shadow/Focus`.

Inconsistências remanescentes:

| Inconsistência | Impacto | Recomendação |
|---|---|---|
| Collections legadas `Color Schemes`, `Primitives`, `UI Styles` e `Spacing & Sizing` ainda existem | Designers podem escolher tokens antigos por engano | Marcar como legado, ocultar se possível ou migrar consumidores antes de remover |
| Existem duas collections chamadas `Typography` | Confusão entre `Desktop/Mobile` antigo e `Light` TES | Renomear a antiga para `Legacy / Typography` ou consolidar |
| Código e Storybook ainda não implementam os 12 componentes recentes | Figma está à frente da base técnica | Usar `FIGMA_STORYBOOK_SYNC_MAP.md` como backlog |
| Componentes recentes ainda não têm variants/properties avançadas | Overrides em instâncias dependem de edição manual | Adicionar properties quando a implementação React for definida |

## Auditoria de organização — Design System / Componentes

Atualização: 2026-06-16  
Status: concluído no Figma e documentação atualizada.

Escopo auditado:

- página Figma `    ↳ Design System` (`12304:2`);
- frame `Design System / Componentes` (`12363:2`);
- componentes da expansão Fase 2, incluindo base, produto, ícones, assets, dados, patterns e documentação AI-friendly.

Problema encontrado:

- a seção já continha componentes válidos, mas a consulta estava difícil porque blocos amplos como `Product Components` concentravam muitos componentes em uma única área longa;
- a documentação ainda descrevia a organização antiga em 9 blocos principais, sem refletir a separação mais útil por domínio;
- após a primeira redistribuição, os frames novos ficaram com altura compactada por comportamento de Auto Layout e precisaram de correção de bounds.

Ajustes realizados:

- `Design System / Componentes` foi separado em 12 frames menores por domínio de uso;
- componentes mestres originais foram preservados e apenas redistribuídos;
- prateleiras novas usam Auto Layout vertical, largura fixa `1592px`, padding `28px`, gap `22px`, radius `24px` e borda lavanda;
- alturas de headers, conteúdos e frames foram recalculadas para envolver os componentes reais;
- metadata de organização foi registrada no frame principal com namespace `tes.ds.organization`.

Frames atuais:

| Frame | Node ID | Componentes |
|---|---:|---:|
| `01 Base, navegação e utilidades` | `12857:626` | 8 |
| `02 Produto: sessões e jornada` | `12857:631` | 4 |
| `03 Produto: plano, pagamento e perfil` | `12857:636` | 7 |
| `04 Produto: operações, moderação e IA` | `12857:641` | 3 |
| `05 Ícones de navegação e status` | `12857:646` | 29 |
| `06 Assets e ilustrações base` | `12857:651` | 8 |
| `07 Dados e visualizações` | `12857:656` | 12 |
| `08 Patterns públicos e dashboard` | `12857:661` | 4 |
| `09 Patterns administrativos` | `12857:666` | 3 |
| `10 Patterns de paciente` | `12857:671` | 4 |
| `11 Patterns de terapeuta` | `12857:676` | 4 |
| `12 Metadados e checklist AI-friendly` | `12857:681` | 2 |

QA final:

- `12` frames menores no container principal;
- `88` componentes únicos;
- `0` nomes duplicados entre componentes;
- `0` overflow horizontal ou vertical nos grids diretos;
- `0` textos colapsados;
- screenshot do frame `12363:2` gerado para conferência visual.

Documentação atualizada:

- `design-system.md`;
- `component-inventory.md`;
- `COMPONENT_ARCHITECTURE.md`;
- `DESIGN_SYSTEM_FINAL_HANDOFF.md`;
- `FIGMA_STORYBOOK_SYNC_MAP.md`;
- `qa-checklist.md`;
- `DESIGN_SYSTEM_AUDIT_REPORT.md`.

Inconsistências remanescentes:

| Inconsistência | Impacto | Recomendação |
|---|---|---|
| Alguns frames internos de componentes continuam com nomes genéricos como `Header` e `Content` | Baixo; são subframes estruturais internos e não afetam consulta da biblioteca | Renomear gradualmente apenas quando esses subframes virarem API visual ou slot documentado |
| Componentes de Fase 2 ainda não têm stories React | Figma segue à frente da implementação | Usar o mapa Figma/Storybook como backlog de implementação |
| Collections legadas de tokens ainda aparecem no arquivo | Pode haver escolha acidental de tokens antigos | Consolidar ou prefixar como `Legacy / ...` antes de remover |
