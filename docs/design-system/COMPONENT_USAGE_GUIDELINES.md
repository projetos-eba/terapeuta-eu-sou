# Component Usage Guidelines - Terapeuta Eu Sou

Data: 2026-06-14

## Voz do Produto

Usar:

- Pessoas interessadas.
- Caminho até o agendamento.
- Pessoas que quiseram conhecer melhor.
- Algo não carregou como esperado.
- Seu perfil pode ficar mais claro.
- Podemos olhar juntos para o que pode ajudar.

Evitar:

- Lead.
- Funil.
- CTR.
- Conversão.
- Baixa performance.
- Benchmark inferior.
- Erro 500 como texto final.
- Promessa de cura.
- Promessa de ganho financeiro.

## Modal e diálogo

- Usar `TESDialog` para qualquer conteúdo modal.
- O modal deve ser renderizado em portal e cobrir o shell completo.
- Overlay, bloqueio de scroll, foco confinado, retorno de foco e fechamento por
  `Escape` são obrigatórios.
- O backdrop fecha somente quando ele próprio é acionado.
- A ação principal deve ficar visível sem competir com o botão de fechar.
- Em telas pequenas, o conteúdo usa scroll interno e nunca ultrapassa `100dvh`.
- Não implementar `role="dialog"` diretamente dentro de features.

## Base

Nomenclatura atual no Figma:

- `Atoms/Button`
- `Atoms/Form Controls`
- `Atoms/Badge`
- `Atoms/Boolean Control`
- `Molecules/Navigation Item`
- `Molecules/Card`
- `Molecules/Tabs`
- `Organisms/Public Header`
- `Organisms/App Sidebar`
- `Templates/Dashboard Shell`
- `Molecules/FilterBar`
- `Molecules/SearchWithFilters`
- `Molecules/RightRail`
- `Molecules/SupportCard`
- `Molecules/PolicyCard`
- `Molecules/SaveBar`
- `Molecules/FloatingHelpButton`
- `Organisms/AppTopbar`

As ações principais usam `color.primitive.purple.500` (`#6C3D91`) via token semântico. Os acentos de paciente usam `color.primitive.cyan.500` (`#81BAE0`) via token semântico.

### Button

Use para ações claras.

Variants criadas:

- `Primary`
- `Gradient`
- `Secondary`
- `Outline`
- `Ghost`
- `Destructive`

Estados:

- `Default`
- `Hover`
- `Disabled`

Regra: CTA público deve preferir textos como `Começar jornada`, `Ver terapeutas` ou `Conhecer possibilidades`.

Use `Gradient` para CTAs premium ou momentos de maior ênfase visual. O gradiente canônico é `gradient.brand.ctaLinear`: `linear-gradient(135deg, #6C3D91 0%, #AE94C3 100%)`, registrado no Figma como `TES/Gradient/Brand CTA Linear`.

### Badge

Use para status, plano e informação curta.

Intents:

- Neutral
- Success
- Warning
- Error
- Info
- PlanBasic
- PlanPro
- PlanPlus

Regra: status não pode depender apenas de cor. O texto do badge precisa explicar o estado.

### Input

Use sempre com label.

Estados:

- Default
- Focused
- Filled
- Error
- Disabled

Regra: erro deve explicar o próximo passo com calma.

### EmptyState

Use quando uma área ainda não tem dados.

Tons:

- Neutral
- Supportive
- Upgrade
- Error

Exemplos:

- `Você ainda não tem sessões agendadas.`
- `Quando uma pessoa agendar com você, ela aparecerá aqui.`
- `Que tal completar seu perfil para ajudar mais pessoas a conhecerem seu trabalho?`

## Navigation

### Organisms/App Sidebar

Use em áreas logadas.

Perfis:

- Patient
- Basic
- Pro
- Plus
- Admin

Regras:

- Plus não mostra upgrade.
- Básico pode mostrar caminhos de evolução, sem culpa.
- Admin ganha densidade, mas mantém linguagem clara.

### Organisms/Public Header

Use em páginas públicas.

Estados:

- Transparent
- Solid
- Mobile

Regra: o CTA deve guiar, não vender agressivamente.

### Molecules/Tabs

Use para alternar contexto dentro da mesma página.

O estado ativo deve ser indicado por forma e texto, não só cor.

### Molecules/FilterBar

Use em listagens de terapeutas, pacientes, sessões, pagamentos e admin.

Regras:

- busca e filtros precisam caber em uma linha no desktop;
- em mobile, quebrar em coluna ou drawer;
- `Limpar filtros` deve existir quando houver filtros persistentes;
- não usar linguagem de venda ou captação.

### Molecules/RightRail

Use para conteúdo complementar que não deve interromper a tarefa principal.

Pode conter:

- próxima sessão;
- ajuda contextual;
- checklist;
- resumo de segurança;
- sugestão de IA;
- upgrade contextual.

Evite colocar ações críticas apenas no right rail.

### Molecules/SupportCard e PolicyCard

Use quando a interface precisar explicar ajuda, termos, cancelamento, pagamento, segurança ou revisão.

Exemplos de texto:

- `A gente pode olhar junto para o que não ficou claro.`
- `Se algo não parecer certo, fale com suporte antes de concluir.`
- `Revise com calma antes de publicar.`

Evite:

- `Erro 500`;
- `Falha crítica`;
- tom jurídico desnecessariamente frio.

### Organisms/AppTopbar

Use no topo das áreas logadas para título da página, busca e ação contextual.

Regras:

- manter título e subtítulo curtos;
- usar uma ação primária por tela;
- avatar e busca não devem competir com o conteúdo principal.

## Product Cards

### Product/TherapistCard

Purpose: apresentar terapeuta com identidade, abordagem e próximo passo.

When to use: busca, favoritos, recomendações.

When not to use: tabelas densas de admin.

Content guidelines:

- priorizar nome, título, formato e disponibilidade;
- evitar promessa de resultado;
- não transformar terapeuta em vendedor.

#### Product/TherapistCard/Premium

Use quando o card precisa de mais confiança visual e presença editorial, como busca pública, favoritos e recomendações destacadas.

Tokens obrigatórios:

- superfície: `color.semantic.surface.default`;
- CTA: `color.semantic.action.primary.default`;
- textos: `color.semantic.text.primary`, `secondary`, `muted` e `inverse`;
- disponibilidade: `color.semantic.status.success` e `status.success.bg`;
- avaliação: `color.semantic.status.warning`;
- estrutura: `spacing.4`, `radius.panel`, `radius.full`, `shadow.float`.

Regras:

- usar disponibilidade como orientação prática, não como urgência artificial;
- manter preço como informação, sem chamada comercial agressiva;
- usar `verified` apenas quando houver validação real do perfil;
- não prometer resultado terapêutico.

### Product/TherapyCard

Purpose: apresentar uma terapia como possibilidade de cuidado.

When to use: home, jornada, resultado e favoritos.

Content guidelines:

- falar de caminho, tema e possibilidade;
- não diagnosticar;
- não prometer cura.

### Molecules/Card

Purpose: resumir sessão e estado.

When to use: paciente, terapeuta e admin.

Accessibility:

- status textual obrigatório;
- ação principal clara;
- estados críticos com texto de apoio.

### Molecules/FAQAccordion/Premium

Use em páginas públicas, landing de terapeutas, páginas de terapia e central de ajuda quando a FAQ precisa aparecer como seção completa.

Tokens obrigatórios:

- fundo da seção: `color.semantic.background.soft`;
- perguntas: `color.semantic.surface.default`;
- textos: `color.semantic.text.primary`, `secondary`, `muted` e `inverse`;
- ação/ícone expandido: `color.semantic.action.primary.default`;
- estrutura: `spacing.8`, `radius.hero`, `radius.card`, `radius.full`, `shadow.soft`.

Content guidelines:

- perguntas devem ser diretas e tranquilizadoras;
- respostas devem explicar o próximo passo com calma;
- evitar prometer cura, diagnóstico ou segurança absoluta;
- quando houver callout de suporte, usar linguagem como `A gente pode olhar junto para o que não ficou claro.`

### Product/MetricCard

Purpose: mostrar indicadores de forma humana.

Use:

- `Pessoas que viram seu perfil`
- `Pessoas que quiseram conhecer melhor`
- `Horários com maior procura`

## Recent Product Components

Fonte Figma: `Design System / Recent Product Components` (`12829:626`).

Regra geral: use estes componentes quando a tela precisar repetir blocos de produto das páginas recentes. Eles são master components visuais e devem ser preferidos a recriar cards locais com frames soltos.

### Aura IA

Use `Product/AuraPriorityOfDay` para a recomendação ou automação principal do dia. A linguagem deve explicar o impacto em termos humanos, como `Reengajamento concluído automaticamente`, evitando termos frios como `conversão` ou `lead recuperado`.

Use `Data/AuraMonthlyComparison` para comparativos simples de mês atual contra mês anterior. Mantenha no máximo 3 métricas principais para não transformar a área em painel analítico pesado.

Use `Data/ProfileTrafficPaths` para origem de tráfego do perfil. O texto deve falar em `caminhos`, `pessoas` e `interesse`, não em funil de aquisição.

### Histórico de Atendimento

Use `Product/PatientHeroProfile` para abrir uma página de histórico ou gestão de cliente/paciente. Ele deve mostrar identidade, preferência de nome, contexto e métricas de vínculo sem expor informações sensíveis desnecessárias.

Use `Product/SessionMemoryTable` para registrar encontros anteriores, técnica, temas e próximos cuidados. Não usar para prontuário clínico formal; é uma memória operacional e acolhedora.

Use `Product/UpcomingAppointments` para próximos encontros de uma pessoa específica. Status deve ser textual, não apenas cor.

### Financeiro

Use `Data/RevenueEvolutionChart` para evolução de faturamento em leitura mensal.

Use `Product/FinancialTransactionsTable` para transações recentes com valores, taxas, líquido e status.

Use `Product/PayoutCalendar` e `Product/RecentPayouts` para repasses previstos e realizados. O texto deve priorizar clareza de pagamento, evitando promessas de ganho.

### Perfil Público

Use `Product/PublicProfilePreview` quando a tela precisa mostrar como pacientes veem o perfil. Imagens podem ser placeholders estruturados, mas o espaço visual deve continuar intencional.

### Serviços Plus

Use `Product/ServicePlusCard` em páginas de gestão de serviços com métricas Plus. Ele pode receber variações futuras para `Destaque`, `Ativo`, `Pausado` e `Otimização sugerida`, mas a versão atual é master visual sem component properties avançadas.

### Qualidade obrigatória

- Preservar Auto Layout no componente principal.
- Usar estilos `TES/*` para títulos, corpo, captions e microcopy.
- Usar tokens de surface, border, text, spacing, radius e shadow do Figma.
- Não criar card dentro de card ao compor esses blocos em páginas.
- Não substituir esses componentes por screenshots quando houver edição futura.

Avoid:

- `CTR`
- `Conversão`
- `Performance baixa`

### Product/AIRecommendationCard

Purpose: sugerir caminhos, melhorias ou próximos passos sem pressão.

Rules:

- não prometer ganho financeiro;
- não usar urgência artificial;
- explicar o valor do próximo passo com cuidado.

### Product/SessionCard

Purpose: resumir uma sessão com horário, status e ações.

When to use: dashboards de paciente e terapeuta, listas de sessões, próximos atendimentos.

Content guidelines:

- usar status textual, como `Confirmada`, `Aguardando confirmação`, `Remarcada`;
- ação primária deve ser clara, como `Entrar`, `Ver detalhes` ou `Enviar mensagem`;
- não usar urgência artificial em sessões futuras.

### Product/NextSessionBlock

Purpose: destacar a próxima sessão no dashboard.

When to use: primeira dobra de paciente ou terapeuta quando há sessão próxima.

When not to use: listas densas ou admin.

Accessibility:

- data e horário precisam estar em texto;
- não depender só de ícone/calendário.

### Product/PaymentSummary

Purpose: resumir valores, status e ação de pagamento.

Rules:

- mostrar total de forma explícita;
- explicar o próximo passo com calma;
- oferecer suporte quando houver dúvida.

Avoid:

- linguagem de cobrança agressiva;
- estados de erro sem orientação.

### Product/PlanCard e UpgradeBanner

Purpose: apresentar planos e recursos sem prometer ganho financeiro.

Use:

- `Conhecer Plus`;
- `Ver recursos`;
- `Mais clareza para acompanhar seu perfil`;
- `Sinais úteis sobre quem quis conhecer melhor seu trabalho`.

Avoid:

- `Ganhe mais`;
- `Multiplique seus pacientes`;
- `Última chance`;
- métricas como pressão.

### Product/ProfileChecklist

Purpose: orientar terapeuta a deixar o perfil mais claro.

Content guidelines:

- falar de clareza, completude e acolhimento;
- não sugerir que o terapeuta está “performando mal”;
- usar passos curtos e verificáveis.

### Product/VerificationPanel e ModerationQueue

Purpose: apoiar revisão administrativa com contexto.

Rules:

- revisar com linguagem neutra;
- pedir ajustes explicando o motivo;
- evitar `Reprovado` como mensagem isolada;
- manter trilha clara para documentação, segurança e suporte.

### Product/AIInsightPanel

Purpose: trazer sugestão de IA para texto, perfil, reputação ou dados.

Rules:

- apresentar como sugestão, não ordem;
- explicar que o terapeuta pode ignorar ou ajustar;
- não prometer cura, agenda cheia ou ganho financeiro;
- não usar diagnóstico ou inferência clínica sobre pacientes.

### Product/PatientJourneyTimeline

Purpose: mostrar caminho até agendamento ou interesse.

Use:

- `Conheceu seu perfil`;
- `Leu detalhes da terapia`;
- `Enviou mensagem`;
- `Agendou sessão`.

Avoid:

- `funil`;
- `lead`;
- `conversão`.

## Icons e Assets

Use a biblioteca `Icon/*` criada na Fase 2 como padrão visual.

Regras:

- preferir ícones lineares com stroke leve e cantos arredondados;
- tamanhos padrão: `16`, `20`, `24`;
- ícones isolados precisam de label acessível ou tooltip;
- não misturar famílias de ícones sem revisão;
- status nunca deve depender só da cor do ícone.

Assets `Asset/*` são apoio visual suave para cards, hero, sidebar e estados vazios. Não substituir imagens reais quando a pessoa precisa inspecionar um terapeuta, local, produto ou documento.

## Charts & Data Visualization

Componentes disponíveis:

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

Use para Pro, Plus e Admin quando houver dado real ou placeholder honesto.

Linguagem recomendada:

- `Pessoas interessadas`;
- `Pessoas que quiseram conhecer melhor`;
- `Caminhos até o agendamento`;
- `Sinais para observar`;
- `Horários com maior procura`.

Evitar:

- `CTR`;
- `Conversão`;
- `Leads`;
- `Baixa performance`;
- `Ranking`;
- comparação entre terapeutas como competição.

Regras de acessibilidade:

- gráfico precisa de título e resumo textual;
- usar legenda ou rótulo, não só cor;
- empty state deve dizer o que acontecerá quando houver dados;
- loading state não deve bloquear entendimento da página inteira.

## Product Patterns

### Pattern/MatchingQuestionCard

Purpose: capturar escolhas da jornada sem diagnóstico.

Use:

- temas;
- momentos;
- preferências.

Avoid:

- sintomas como sentença;
- diagnóstico;
- linguagem clínica determinista.

### Product/JourneyResultCard

Purpose: mostrar caminhos possíveis.

Content:

- `pode combinar`;
- `pode fazer sentido`;
- `vale conhecer`;
- `caminho possível`.

Avoid:

- `resultado ideal`;
- `tratamento recomendado`;
- `cura garantida`.

### Product/CarefulBenchmark

Purpose: mostrar referência comparativa sem ansiedade.

Use:

- `referência cuidadosa`;
- `sinais para observar`;
- `pode ajudar a orientar`.

Avoid:

- ranking competitivo;
- comparação entre terapeutas;
- linguagem de inferioridade.

### Product/PlanFeatureComparison

Purpose: comparar recursos dos planos Básico, Pro e Plus com clareza.

Use:

- páginas públicas de planos e `/para-terapeutas`;
- upgrade contextual quando a pessoa precisa entender recursos disponíveis;
- Storybook como referência de tabela de comparação cuidadosa.

Content:

- `Recursos por plano`;
- `Compare os recursos disponíveis em cada etapa`;
- nomes de recursos claros, como `Perfil, agenda e mensagens`, `Estatísticas e métricas`, `Badge verificado`.

Avoid:

- pressão de upgrade;
- ranking agressivo;
- promessa de ganho financeiro;
- linguagem como `conversão`, `funil`, `baixa performance`.

Accessibility:

- não comunicar disponibilidade só por cor;
- preservar checks com label contextual;
- usar `TES/Caption` e `TES/Micro` apenas em tabelas e metadados compactos.

## Patterns por Perfil — Fase 2

### Público

Use `Pattern/PublicHero`, `Pattern/TherapistSearchResults` e `Pattern/MatchingQuestionGrid` para páginas de entrada e jornada.

Regras:

- não fazer diagnóstico;
- usar `pode fazer sentido`, `vale conhecer`, `caminhos possíveis`;
- manter CTA como convite, não pressão.

### Paciente

Use `Pattern/PatientOverview`, `Pattern/PatientSessionDetail`, `Pattern/ChatLayout` e `Pattern/SettingsLayout`.

Regras:

- próxima sessão deve aparecer com data, horário e ação clara;
- chat precisa preservar tom humano e direto;
- pagamentos e configurações devem ter suporte visível.

### Terapeuta Básico

Use `Pattern/TherapistDashboard` e `Product/ProfileChecklist`.

Regras:

- foco em rotina, agenda, perfil e pacientes;
- upgrades devem ser contextuais e respeitosos;
- não tratar terapeuta como vendedor.

### Terapeuta Pro e Plus

Use `Pattern/ProMetricsDashboard` e `Pattern/PlusInsightsDashboard`.

Regras:

- dados são sinais para observar, não cobrança;
- IA sugere, não decide;
- benchmark é referência cuidadosa, não competição.

### Admin

Use `Pattern/AdminOverview`, `Pattern/AdminTableWithSidePanel` e `Pattern/VerificationReview`.

Regras:

- permitir densidade maior sem abandonar clareza;
- moderação e verificação precisam de contexto;
- mensagens internas devem evitar julgamento ou punição sem orientação.

## Accessibility

Regras obrigatórias:

- contraste mínimo recomendado de 4.5:1 para texto normal;
- 3:1 para texto grande;
- foco visível;
- touch target mínimo de 44px;
- texto legível em estados de erro;
- status com texto e não apenas cor;
- ícones isolados precisam de label ou tooltip.

## AI Metadata Template

```md
## Component: Nome do componente

### Purpose

Para que serve.

### When to use

Quando usar.

### When not to use

Quando evitar.

### Anatomy

Partes internas do componente.

### Variants

Variants disponíveis.

### Properties

Properties reutilizáveis.

### Accessibility

Regras de acessibilidade.

### Content guidelines

Orientações de texto.

### AI metadata

- Component name:
- Category:
- Intent:
- Related components:
- Common usage:
- Avoid:
- Design tokens used:
- Figma variables used:
- Storybook story:
```

## Component: Product/TherapistResultCard

### Purpose

Apresentar um terapeuta dentro de resultados de busca ou listas públicas com informação suficiente para escolha inicial.

### When to use

Use em `/terapeutas`, favoritos, recomendações de jornada e listagens onde o usuário compara profissionais.

### When not to use

Evite em grids promocionais simples ou em destaques de home; nesses casos, use `Product/TherapistCard`.

### Anatomy

Avatar, conteúdo principal, badges de cuidado, avaliação, próximo horário, preço e ações.

### Variants

`default`, `compact`, `loading` e `unavailable` são previstas para Storybook/código.

### Accessibility

O card não deve depender apenas de cor para status. Ações precisam de foco visível e alvo mínimo confortável.

### Content guidelines

Use linguagem clara e acolhedora. Não prometa resultado terapêutico. Prefira “próximo horário” e “ver perfil” em vez de linguagem comercial agressiva.

### AI metadata

- Component name: `Product/TherapistResultCard`
- Category: Product
- Intent: Therapist search result
- Related components: `Product/TherapistCard`, `Pattern/TherapistSearchResults`, `Atoms/Button`, `Atoms/Badge`
- Common usage: search results and comparison lists
- Avoid: cramped columns, clipped actions, aggressive ranking language
- Design tokens used: surface, border, text, action, spacing, radius, shadow
- Figma variables used: `color/semantic/surface/default`, `color/semantic/border/subtle`, `color/semantic/action/primary/background`, `radius/card`
- Storybook story: `Product/TherapistResultCard`

## Component: Product/TherapyVisualCard

### Purpose

Apresentar uma terapia em grids visuais com imagem ou ilustração, descrição curta e caminho para saber mais.

### When to use

Use em `/terapias`, favoritos de terapias, recomendações da jornada e blocos relacionados onde a terapia precisa ser comparada visualmente.

### When not to use

Evite em listas densas ou tabelas. Para cards textuais compactos, use `Product/TherapyCard`.

### Anatomy

Container, `Visual`, `Icon Slot`, `Content`, `Title`, `Description` e `Action`.

### Variants

Previstas para Storybook/código: `default`, `recommended`, `saved`, `loading` e `unavailable`.

### Accessibility

O card precisa ter nome da terapia legível, ação com foco visível e alvo confortável. A imagem não deve ser a única forma de compreender o tema.

### Content guidelines

Use descrições curtas, acolhedoras e sem promessa de cura. Prefira “Saiba mais” para páginas públicas.

### AI metadata

- Component name: `Product/TherapyVisualCard`
- Category: Product
- Intent: Visual therapy catalog card
- Related components: `Product/TherapyCard`, `Product/JourneyResultCard`, `Atoms/Button`, `Icon/*`
- Common usage: public therapy catalog, therapy favorites, journey recommendations
- Avoid: hardcoded images, cramped text, generic blank placeholders
- Design tokens used: surface, border, text, action, spacing, radius, shadow
- Figma variables used: `color/semantic/background/default`, `color/semantic/border/default`, `color/primitive/purple/500`, `color/primitive/cyan/500`
- Storybook story: `Product/TherapyVisualCard`

## Component: Brand/OfficialLogo

### Purpose

Representar o logotipo oficial do Terapeuta Eu Sou a partir do PNG fornecido.

### When to use

Use em headers, footers, documentos visuais e telas públicas onde a marca precisa aparecer.

### When not to use

Não redesenhe o logo localmente nem substitua por texto quando houver espaço para o lockup oficial.

### AI metadata

- Component name: `Brand/OfficialLogo`
- Figma node: `12548:140`
- Refined size: `220x118`
- Asset: `docs/design-system/assets/logo-oficial-terapeuta-eu-sou.png`
- Related components: `Organisms/Public Header`, `Organisms/Public Footer`
- Avoid: manual wordmark, distorted aspect ratio, unofficial crop

## Component: Organisms/Public Footer

### Purpose

Padronizar o rodapé das páginas públicas com logo oficial, links institucionais e apoio de navegação.

### When to use

Use no final de páginas públicas recriadas e futuras páginas públicas.

### AI metadata

- Component name: `Organisms/Public Footer`
- Figma node: `12548:142`
- Refined size: `1055x236`
- Related components: `Brand/OfficialLogo`, `Atoms/Button`
- Common usage: public pages, landing pages, educational public flows
- Avoid: footer local duplicado, links cortados, colunas com overflow

### Usage notes

- Use como footer padrão em páginas públicas de `1055px`.
- Não redimensione para menos de `236px` de altura; se a página tiver mais links, aumente a altura do frame da página.
- Preserve o logo oficial como instância de `Brand/OfficialLogo`.

## Component: Molecules/FAQAccordion

### Purpose

Representar perguntas frequentes em linhas expansíveis.

### When to use

Use em `/como-funciona`, detalhes de terapia, perfil de terapeuta e páginas de ajuda.

### AI metadata

- Component name: `Molecules/FAQAccordion`
- Figma node: `12548:162`
- Refined size: `620x64`
- Related components: `Icon/chevron-down`, `Molecules/Card`
- Common usage: FAQ lists and support sections
- Avoid: perguntas sem foco visível ou linhas com texto cortado

### Usage notes

- Use a linha colapsada como base.
- Estados `expanded` e `focus` estão documentados em `Design System / Public Reusable Consolidation`.
- Para resposta longa, expanda a altura do wrapper do item em vez de reduzir fonte.

## Component: Product/JourneyStepCard

### Purpose

Mostrar uma etapa da jornada em sequência curta, como o fluxo de 4 passos de `/como-funciona`.

### AI metadata

- Component name: `Product/JourneyStepCard`
- Figma node: `12548:165`
- Refined size: `210x332`
- Related components: `Product/PatientJourneyTimeline`, `Atoms/Badge`
- Common usage: onboarding, journey explanation, public education
- Avoid: promessas terapêuticas ou etapas comerciais agressivas

### Usage notes

- Use em sequências de 3 a 4 passos.
- Preserve número da etapa, slot de ícone, título e descrição com auto-height.
- Se a descrição não couber, aumente o grid ou a seção; não comprima a tipografia.

## Component: Product/JourneyDetailCard

### Purpose

Apoiar páginas educacionais com cards compactos de detalhe e ação.

### AI metadata

- Component name: `Product/JourneyDetailCard`
- Figma node: `12548:170`
- Refined size: `330x170`
- Related components: `Molecules/FAQAccordion`, `Icon/*`
- Common usage: how-it-works detail grids and support topics
- Avoid: card dentro de card e descrições longas

### Usage notes

- Use em grids educacionais e blocos de suporte.
- O card comporta título, descrição curta e ação. Para descrições maiores, prefira uma seção expandida.

## Component: Product/JourneyResultCard/Wide

### Purpose

Apresentar recomendações de caminho terapêutico em layout horizontal amplo.

### When to use

Use em `/sua-jornada/resultado` quando houver terapia, sintonia, descrição, contagem de terapeutas e CTA.

### AI metadata

- Component name: `Product/JourneyResultCard/Wide`
- Figma node: `12548:175`
- Refined size: `923x220`
- Related components: `Product/JourneyResultCard`, `Product/TherapyCard`, `Product/TherapistResultCard`
- Common usage: result page recommendations
- Avoid: comprimir CTA, cortar tags ou prometer cura

### Usage notes

- Use em `/sua-jornada/resultado` e páginas com recomendações horizontais de terapia.
- Preserve badge, título, descrição, tags, contagem de terapeutas e CTAs.
- O tamanho `923x220` é a base validada para páginas públicas de `1055px`.

## Public Component Refinement Notes

Atualização: 2026-06-15

- `Design System / Public Reusable Consolidation` (`12548:136`) contém exemplos reais de collapsed/expanded/focus, jornada de 4 passos e resultados Reiki/Mindfulness/Tarologia Terapêutica.
- `Organisms/Public Header` (`12335:465`) também foi refinado para aplicar estilos `TES/*` aos textos do mestre.
- Antes de desenhar footer, FAQ, cards de etapa, detalhe ou resultado manualmente, use estes mestres e aplique overrides.
- A página `ícones` foi consultada; como alguns ícones renderizaram como glyphs preenchidos/quadrados, os slots refinados usam vetores compatíveis com Lucide até a correção da biblioteca de ícones.
