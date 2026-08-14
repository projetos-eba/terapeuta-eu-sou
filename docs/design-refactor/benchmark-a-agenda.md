# Benchmark A — Terapeuta / Agenda

Status: `BENCHMARK A APPROVED`  
Rota: `/terapeuta/agenda`  
Figma: `13366:5342`  
Branch de trabalho: `dev-antonio`  
Atualização: 2026-08-14

Este documento registra as decisões A–E do benchmark. O calendário existente é
baseline funcional e visual; domínio, rotas, RPCs, read models, RLS, Stripe e
Zoom permanecem preservados.

## Agent A — Product / UX Architect

### Primary task

Ao abrir Minha Agenda, o terapeuta precisa responder imediatamente:

> Em que momentos tenho sessões, disponibilidade ou bloqueios neste período, e
> qual item exige minha próxima ação?

A Agenda é o mapa temporal da operação. Ela orienta compromissos, estados e
próximas ações permitidas, sem competir com Sessões como central de execução nem
com Horários/Bloqueios como configuração.

### Secondary tasks

1. Identificar a próxima sessão e seu estado.
2. Navegar entre datas e períodos preservando referência temporal.
3. Abrir detalhe ou ação permitida de uma sessão.
4. Reconhecer reagendamento, cancelamento e pagamento pendente.
5. Diferenciar sessão, bloqueio, indisponibilidade e reserva temporária.
6. Ver como a disponibilidade configurada se materializa.
7. Adicionar horários ou bloquear intervalos.
8. Filtrar por paciente, terapia ou estado em agendas densas.
9. Consultar pendências acionáveis.
10. Consultar insights somente como apoio.

### Information hierarchy

1. Orientação temporal: período, hoje, anterior/próximo e modo de visão.
2. Próximo compromisso e atenção imediata.
3. Mapa temporal: sessões, disponibilidade, bloqueios, indisponibilidade e
   reservas temporárias expostas pelo contrato.
4. Ações operacionais: abrir item, adicionar horários e bloquear horário.
5. Contexto complementar: encontros do dia, pendências e legenda necessária.
6. Refinamento: busca, filtros e configuração.
7. Aprendizado: insights e padrões históricos.

Insights não ocupam a primeira dobra quando há agenda ou pendência relevante.

### Critical states

- **Agenda vazia:** distinguir disponibilidade não configurada, período sem
  sessões e filtro sem resultado; cada caso recebe copy e ação próprias.
- **Dia sem sessões:** preservar calendário, disponibilidade e bloqueios.
- **Dia cheio:** manter horário, paciente, terapia e estado legíveis sem
  microtexto ou dependência exclusiva de cor.
- **Pagamento pendente:** não apresentar como confirmado nem liberar ação
  dependente de confirmação financeira.
- **Reagendamento:** mostrar estado atual e ação permitida sem competir com o
  horário vigente.
- **Bloqueio:** distinguir de sessão, disponibilidade e indisponibilidade.
- **Reserva temporária:** usar “Reserva em andamento”; nunca expor `hold`/TTL.
- **Indisponibilidade:** tratamento neutro, não aparência de erro.
- **Múltiplas terapias:** cor apoia, mas texto continua suficiente.
- **Madrugada:** faixa deriva de regras e eventos reais; o primeiro rótulo tem
  padding próprio e não colide com linha/borda.
- **Loading:** manter contexto e identificar conteúdo carregando.
- **Erro:** falha explícita com próximo passo; nunca vazio/sucesso aparente.
- **Intervalo inconsistente:** não sobrepor silenciosamente; falha controlada.

### Interaction model

- Período é o contexto persistente.
- Navegação temporal não altera filtros ou visão silenciosamente.
- Hoje restaura o período atual.
- Evento abre o detalhe/ação já previsto pelo contrato.
- Filtros refinam a visão atual, exibem estado ativo e são limpos sem mudar
  período ou visualização.
- Adicionar horários e Bloquear horário permanecem ações distintas.
- Scroll horizontal, quando necessário, pertence ao calendário, nunca à página.
- Hover, teclado, foco e touch oferecem acesso equivalente.

### Progressive disclosure

**Sempre visível:** título/propósito curto, período, navegação, calendário/lista,
ações operacionais, estado de filtros e situação imediata quando existir.

**Condicional:** pendências acionáveis, legenda necessária, ausência/erro e
indicador de filtros ativos.

**Recolhido:** filtros mobile, lista completa de pendências, detalhes extensos do
ContextRail, insights, legenda extensa e configuração secundária.

Filtros permanecem imediatamente sobre a agenda no desktop, mas compactos. Os
insights ficam depois da operação.

### Responsive transformation

- **Desktop:** calendário dominante e ContextRail secundário; semana completa,
  comandos acima da agenda, filtro compacto e faixa temporal derivada dos dados.
- **Tablet:** calendário continua dominante; ContextRail vira resumo contextual
  em faixa/blocos compactos; comandos ocupam duas linhas deliberadas; scroll da
  semana fica confinado e sinalizado quando necessário.
- **Mobile:** lista cronológica agrupada por dia substitui a grade; filtros
  começam recolhidos e mostram estado ativo; ações preservam hierarquia; rail e
  insights passam para seções posteriores e progressivas; sem scroll horizontal.

### UX risks

- ContextRail competir com o calendário.
- Confundir Agenda, Sessões e configuração.
- Filtros ou insights dominarem a primeira dobra.
- Pagamento/reserva temporária parecerem confirmação.
- Cor ser o único código.
- Faixa fixa ocultar madrugada.
- Confundir vazio, sem resultado e erro.
- Criar scroll interno concorrente.
- Comprimir semana desktop no mobile.
- Expor termos técnicos ou criar ações sem contrato.

### Gate A

- Tarefa principal inequívoca: sim.
- Informação principal primeiro: sim.
- Ruído identificado e subordinado: sim.
- Filtros não dominam: sim.
- Configuração separada da operação: sim.
- Mobile possui experiência própria: sim.
- Conflito de domínio: nenhum.

`GATE A APPROVED`

## Agent B — Visual Director

### Direção

A Agenda deve parecer uma mesa de trabalho serena: o tempo organiza a página, o
calendário domina e o contexto auxilia sem transformar toda informação em card.

- `Operational`: comandos, filtros e calendário.
- `Balanced`: ContextRail, estados vazios e orientação.
- Insights ficam subordinados e fora da primeira dobra.

### Baseline

**Preservar:** título display itálico, copy curta, hierarquia das ações,
Calendário/Horários/Bloqueios, Dia/Semana/Mês, navegação temporal, faixa dinâmica
incluindo madrugada, dia atual, cores com texto, estados de sessão/bloqueio/
reserva, lista mobile, contexto diário, pendências e `TESDialog`.

**Refinar:** peso dos controles, filtros compactos, hierarquia interna dos
eventos, padding do cabeçalho/primeira hora, contraste das grid lines, prioridade
do rail, tablet deliberado e foco sem elevação excessiva.

**Remover:** caixa das tabs, sombras de CommandBar/FilterBar/calendário/rail,
borda da legenda, card elevado do Insight TES, caixas internas em empty states,
codificação numérica do Figma como identificação principal, microtexto funcional,
linha sobre a primeira hora e insights competindo na primeira dobra.

**Reestruturar:** tabs abertas por underline, CommandBar plana, FilterBar como
extensão dos comandos, ContextRail contínuo com dividers, Insight TES como faixa
editorial, heatmap secundário e legenda auxiliar/recolhível.

### Cardification audit

| Região              | Decisão                                                     |
| ------------------- | ----------------------------------------------------------- |
| PageHeader          | aberto, sem card/borda/sombra                               |
| SegmentedNavigation | underline, sem box externo                                  |
| CommandBar          | faixa funcional plana, sem sombra                           |
| FilterBar           | faixa compacta; somente campos preservam bordas             |
| Timeline            | uma borda externa legítima; grid semântico; sem sombra      |
| Encontros de hoje   | surface discreta por ser resumo autônomo acionável          |
| Pendências          | accent surface apenas quando houver atenção; vazio compacto |
| Insights            | seção soft/aberta, após operação                            |
| Legenda             | sem container                                               |
| Insight TES         | faixa lavanda, sem borda/sombra                             |

### Composição

- Canvas acompanha `layout.app.maxWidth`, preservando largura prática próxima de
  `1210px`.
- Desktop `xl`: `minmax(0,1fr) + 320px`, gap `24px`.
- Rail alinha com o topo do calendário.
- First fold: header, tabs, CommandBar, FilterBar compacta e início do calendário/
  resumo prioritário. Heatmap e Insight TES ficam abaixo.
- Ritmo: header→tabs `24px`; tabs→CommandBar `20px`; CommandBar→FilterBar
  `12px`; FilterBar→calendário `20px`; grandes blocos `24–32px`.
- Cabeçalho dos dias usa `20px` acima e `16px` abaixo; primeira hora recebe
  offset próprio e não coincide com borda.

### Hierarquia e tipografia

- `h1`: display itálico `52px` desktop, `42px` tablet, ~`36px` mobile.
- Supporting copy: `16px` desktop/tablet, `14px` mobile.
- Rail: títulos sans `18px` extrabold.
- Texto funcional/evento: mínimo `14px`.
- Metadata: `11px` desktop e `10px` mobile.
- Dia da semana `11px`; número do dia `18px`.
- Display restrita ao título e Insight TES.

### CommandBar, filtros e calendário

- Dia/Semana/Mês à esquerda; anterior–período–próximo formam um grupo; Hoje é
  terciário próximo.
- Desktop: filtros abertos em linha; tablet: duas linhas deliberadas; mobile:
  trigger recolhido, indicador ativo e resumo.
- Timeline: surface branca, radius card, uma borda e nenhuma sombra.
- Linhas de hora/dia permanecem em baixo contraste; não há linha sobre a
  primeira faixa.
- Dia atual mantém círculo brand.
- Sessões usam tonalidade de terapia com texto; bloqueios e reservas usam
  tracejado sem depender apenas de cor.
- Se a hora atual estiver no range, uma linha fina aparece somente na coluna do
  dia atual, com marcador discreto “Agora”.

### ContextRail e conteúdo secundário

Ordem: Encontros de hoje → Pendências → Insights. O rail é contínuo, não pilha de
cards equivalentes. Pendências vazias viram confirmação compacta. Legenda fica
aberta e sem container no desktop; extensa, recolhe no mobile. Insight TES vira
faixa editorial alinhada à esquerda.

### Responsividade

- **Desktop:** calendário + rail; semana completa; comandos em linha; filtros
  abertos; insights após a operação.
- **Tablet:** calendário full-width; encontros/pendências em faixa após ele;
  insights em linha própria; CommandBar em duas linhas; eventual scroll fica
  confinado à timeline.
- **Mobile:** lista cronológica agrupada por dia; filtros recolhidos; ações
  preservam hierarquia e alvo de toque; contexto e insights vêm depois; sem
  scroll horizontal de página.

### Figma

- **Manter:** assimetria, título, CTAs, navegação, dia atual, paleta e relação
  timeline/contexto.
- **Adaptar:** CommandBar/filtros, rail, surface do calendário, Insight TES,
  legenda e densidade.
- **Superar:** mobile/tablet, madrugada, estados reais, mínimos tipográficos,
  acessibilidade e alinhamento da primeira hora.
- **Descartar:** microtexto, números 1–6 como identidade principal, cards/sombras
  em toda região, heatmap concorrente e estados inexistentes.
- **Conflito registrado:** o node `13366:5342` hoje traz a supporting copy
  “Organize seus horários, acompanhe seus encontros e ofereça mais momentos de
  acolhimento.”, enquanto a referência raster anterior usada na Agenda trazia
  “Organize seus horários, acompanhe seus encontros e mantenha sua agenda
  sempre atualizada.”. Pela cadeia atual do benchmark, Figma acessível e skill
  da feature prevalecem; a divergência fica registrada para Calibration.

### Gate B — teste anti-genérico

Tabs, CommandBar, FilterBar e legenda podem ser neutras por serem controles
universais. Timeline é parcialmente universal, mas conteúdo, linguagem e estados
TES a contextualizam. O baseline genérico do ContextRail será corrigido pela
hierarquia contínua. Nenhuma região SaaS genérica permanece com peso suficiente
para definir a página.

`GATE B APPROVED`

## Agent C — Design System Guardian

### Reuse decisions

| Elemento                           | Classificação              | Status      | Decisão                                                                                                               |
| ---------------------------------- | -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `TherapistCalendar`                | `domain` + `page-specific` | `existing`  | permanece owner da composição da Agenda; refatoração incremental, sem reinício da feature                             |
| `TESDialog` para detalhe da sessão | `primitive`                | `existing`  | manter sem criar overlay local                                                                                        |
| `AppPageContainer` grid `1210px`   | `pattern`                  | `variant`   | reusar a largura/cadência como referência, sem forçar troca estrutural imediata da página                             |
| Links/botões existentes do shell   | `primitive`                | `existing`  | reusar classes/tokens do projeto; ajustar peso e agrupamento localmente                                               |
| `TESCard`                          | `primitive`                | `existing`  | usar apenas quando houver entidade/resumo autônomo; não envolver toolbar, tabs, legenda ou insight por padrão         |
| `AppPageHeader`                    | `pattern`                  | `candidate` | não adotar nesta página porque a variante atual é card-heavy; registrar necessidade de versão aberta após Calibration |
| `AppPageSection`                   | `pattern`                  | `candidate` | não aplicar em massa; a API atual induz borda/sombra onde a Agenda precisa respiro e superfícies mais seletivas       |

### Pattern decisions

| Pattern               | Aplicação                                       | Decisão                                                                    |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `PageHeader`          | título, supporting copy e CTAs                  | implementar como composição local aberta; não usar `AppPageHeader` atual   |
| `SegmentedNavigation` | Calendário / Horários / Bloqueios               | manter local com tabs-link underline, sem box pesado                       |
| `CommandBar`          | Dia / Semana / Mês + navegação temporal         | consolidar na mesma região de comando, com agrupamento claro               |
| `FilterBar`           | busca, terapia, estado, contador, limpar        | manter imediatamente acima da agenda; desktop aberto, mobile recolhido     |
| `Timeline`            | grade dia/semana e mês                          | manter como pattern local da Agenda com range derivado do schedule/eventos |
| `ContextRail`         | encontros do dia, pendências, insights          | manter no desktop e tablet; no mobile vira seções posteriores              |
| `InsightPanel`        | Insight TES e heatmap                           | preservar como conteúdo secundário, menos containerizado                   |
| `StatusCluster`       | estado de sessão, pendência, reserva e bloqueio | manter embutido em cards/listas, sem fileira de badges novas               |

### Variant decisions

- `AgendaTabs`: virar tabs abertas com underline, sem wrapper pesado adicional.
- `CalendarFilters`: manter componente local, mas como variante mais plana do
  pattern `FilterBar`; somente inputs/selects preservam borda.
- `TimelineCalendar`: manter borda externa única; remover sombra e a divisória
  horizontal superior que conflita com a primeira hora.
- `TodayCard`, `AttentionCard` e `DemandCard`: tratar como variantes locais do
  `ContextRail`, reduzindo a sensação de pilha de cards equivalentes.
- `TesScheduleTip`: manter como variante local do `InsightPanel`, aberta e
  editorial, não como card isolado elevado.

### Local components

- `TimelineBooking`, `TimelineBlock`, `TimelineHold`: continuam `local` e
  `page-specific`; ainda conhecem demais o domínio temporal da Agenda para
  promoção.
- `MobileChronologicalList`: continua `local`; é a transformação responsiva da
  Timeline, ainda sem repetição fora da Agenda.
- `CalendarLegend`: continua `local`; precisa ser mais leve e talvez recolhível
  no mobile, mas ainda não merece API compartilhada.
- `DemandCard`/heatmap: continua `local`; o benchmark B e C dirão se existe um
  `DemandHeatmap` reutilizável.

### Candidates for Calibration

- Variante aberta de `AppPageHeader` sem borda/sombra.
- Variante mais leve de `AppPageSection` para regiões operacionais que precisam
  apenas de padding e divider.
- Pattern compartilhado de `CommandBar` para período + modo de visualização.
- Pattern compartilhado de `FilterBar` com estado recolhido no mobile.
- Pattern compartilhado de `ContextRail` menos cardificado.
- Mapa semântico oficial de `therapy color key -> surface/text/border`.

### Token gaps

- Não há hoje tokens semânticos nomeados para as seis cores de terapia usadas
  na Agenda; a página depende de hex locais no `colorStyles`.
- Não há token dedicado para hairlines de grid operacional; a Agenda usa opacidade
  de `brand-lavender` para chegar no contraste correto.
- O sistema não expõe hoje uma variante de shadow “none” para wrappers
  `AppPage*`; a remoção precisa ser local, não global.

### System risks

- Refatorar `AppPageHeader`/`AppPageSection` globalmente por causa da Agenda
  causaria regressão em páginas que ainda dependem do contrato atual.
- Promover `Timeline`, `FilterBar` ou `ContextRail` a componentes globais agora
  cristalizaria APIs antes de Benchmark B e C.
- Manter hex locais indefinidamente para terapias aumentaria divergência visual;
  por enquanto isso é dívida aceita, não motivo para mudar tokens globais sem
  Calibration.
- Há conflito documentado de supporting copy entre o Figma atual e a referência
  raster anterior; implementação precisa seguir uma única autoridade e registrar
  a divergência no handoff.

### Gate C

- Busca por componente/pattern existente: concluída.
- Reuso, variantes e elementos locais: classificados.
- Abstração prematura: bloqueada.
- Conflito de domínio pendente: nenhum.
- Decisão arquitetural sem owner: nenhuma.

`DESIGN READY`

## Agent D — Implementer

### Alterações implementadas

- `TherapistCalendar` passou a usar um header aberto, com CTAs preservados e
  título responsivo (`36px` mobile, `42px` tablet, `52px` desktop).
- `AgendaTabs` saiu do wrapper card-heavy e virou navegação aberta por
  underline.
- A `CommandBar` foi achatada para uma faixa funcional com agrupamento claro de
  visualização, navegação temporal e ação “Hoje”.
- `CalendarFilters` permanece imediatamente acima da agenda, ganhou contador de
  filtros ativos, resumo `resultado/total` no trigger e estado recolhido no
  mobile.
- A `Timeline` perdeu sombra, manteve borda externa única, passou a aplicar
  offset explícito no primeiro marcador de hora e preserva faixa derivada do
  schedule/eventos.
- O range dinâmico continua cobrindo madrugada quando as regras ou eventos
  exigem isso; o teste unitário valida a presença de `00:00` e a ausência de
  `08:00` no cenário de disponibilidade `00:00–06:00`.
- O `ContextRail` ficou menos cardificado no desktop `xl`, com divisões mais
  contínuas entre Encontros de hoje, Pendências e Insights.
- `TesScheduleTip` saiu do rail e virou faixa editorial separada, abaixo da
  operação principal.
- A legenda virou `details` recolhível no mobile e seção aberta no desktop.
- O heatmap permanece aberto em desktop/tablet e passou a progressive disclosure
  recolhido no mobile, depois da operação principal.
- O painel de filtros mobile agora alterna `hidden`/`flex` de forma explícita;
  isso evita que a classe utilitária sobrescreva o atributo `hidden`.
- A copy de hold foi ajustada para “Reserva em andamento”.
- Ao salvar Horários, regras ligadas a terapias que já não fazem parte do read
  model editável (por exemplo, terapia arquivada) não são reenviadas ao comando.
  A autorização server-side e o contrato versionado permanecem inalterados.

### Restrições preservadas

- Nenhum contrato de domínio, rota, read model, RPC, RLS, Stripe ou Zoom foi
  alterado neste benchmark.
- Os componentes continuam locais à Agenda; nenhum candidate foi promovido a
  pattern global antes da Calibration.

## Agent E — Gate provisório interrompido (histórico)

> Este registro preserva a primeira tentativa de QA, executada enquanto Docker,
> build e browser ainda estavam instáveis. Seus bloqueios foram superados na
> repetição final documentada na seção seguinte e não representam o estado final.

### Evidências analisadas em 2026-08-14

- Desktop `1440`: `test-results/therapist-agenda-sessions--640f1-ens-an-owned-session-detail-chromium/agenda-calendario-desktop.png`
- Tablet `820`: `test-results/therapist-agenda-sessions--640f1-ens-an-owned-session-detail-chromium/agenda-calendario-tablet.png`
- Mobile `390`: `test-results/therapist-agenda-sessions--640f1-ens-an-owned-session-detail-chromium/agenda-calendario-mobile.png`

### Gates executados

- `npm run lint`: aprovado.
- `npx vitest run src/features/therapist-agenda/components/therapist-calendar.test.tsx`: aprovado.
- `npm run typecheck`: bloqueado por `ENOSPC` ao escrever
  `tsconfig.tsbuildinfo` e por ausência de `.next/types` válidos no momento da
  execução.
- `npm run build`: falhou em `/_not-found` durante `Collecting page data`.
- `npx playwright test tests/e2e/therapist-agenda-sessions.spec.ts --grep "uses the real calendar and opens an owned session detail" --headed`:
  falhou.
  - projeto `msedge`: browser channel não instalado no host;
  - projeto `chromium`: login não passou de `/terapeuta/login`, portanto a
    captura headed não foi reproduzida no estado atual.
- Browser MCP: indisponível no momento do gate; o Firefox interno encerrou ao
  iniciar e não permitiu inspeção visual interativa adicional.

### Findings

#### P1 — Gate integrado bloqueado por build

- Evidência: `npm run build` falha em `Failed to collect page data for /_not-found`.
- Impacto: a branch não atende o pré-requisito mínimo do `RELEASE_GATE.md`; o
  QA final não pode aprovar a Agenda enquanto o app não compilar.
- Owner sugerido: `D` (Implementer) com revisão do owner da infraestrutura
  Next/build.

#### P1 — E2E headed da Agenda não está reproduzível no estado atual

- Evidência: o Playwright local em `chromium` permaneceu em
  `http://localhost:3000/terapeuta/login` após o submit; a spec não alcançou a
  rota `/terapeuta`.
- Impacto: o benchmark perde repetibilidade local no fluxo autenticado que gera
  as evidências desktop/tablet/mobile.
- Owner sugerido: `D` (Implementer/harness) com revisão de domínio para login,
  seed e credenciais de fixture.

#### P2 — Projeto `msedge` falha por dependência de navegador ausente

- Evidência: `browserType.launch` não encontrou
  `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`.
- Impacto: o suite headed falha parcialmente por configuração do host, gerando
  ruído no gate.
- Owner sugerido: `D` (harness) ou QA para condicionar o projeto ao ambiente.

#### P2 — Evidência mobile atual contradiz o comportamento esperado do filtro

- Evidência: a screenshot mobile existente mostra o painel de filtros aberto,
  enquanto o benchmark aprovado exige filtro recolhido por padrão no mobile e o
  teste unitário/local espera `aria-expanded="false"` na carga inicial.
- Impacto: não está claro se o problema é regressão real de transformação ou
  screenshot stale; sem captura fresca, a responsividade permanece parcialmente
  inconclusiva.
- Owner sugerido: `D` para reprodução/correção, `E` para recaptura.

#### P2 — Heatmap e legenda ainda consomem muito peso no mobile

- Evidência: na captura `390px`, “Insights para sua agenda” ainda ocupa grande
  extensão vertical antes de `Insight TES`, apesar de ambos serem conteúdo
  secundário.
- Impacto: a operação principal continua acessível, mas a segunda metade da
  tela mobile ainda se aproxima de dashboard informacional em vez de agenda
  progressiva.
- Owner sugerido: `B` (Visual) para recalibrar a hierarquia móvel, depois `D`.

### Visual Quality Score provisório

Pontuação provisória baseada nas capturas disponíveis e limitada pelos gates
quebrados acima.

| Dimensão                   | Nota | Peso | Parcial |
| -------------------------- | ---: | ---: | ------: |
| Hierarquia de informação   |  4.0 |   20 |    16.0 |
| Composição e ritmo         |  3.5 |   15 |    10.5 |
| Clareza operacional        |  4.0 |   15 |    12.0 |
| Consistência TES           |  4.0 |   15 |    12.0 |
| Sofisticação visual        |  4.0 |   10 |     8.0 |
| Responsividade             |  2.5 |   10 |     5.0 |
| Acessibilidade             |  3.0 |   10 |     6.0 |
| Microinterações e feedback |  2.5 |    5 |     2.5 |

**Total provisório:** `72 / 100`

### Eliminatórios

- `FAIL` — build quebrado.
- `FAIL` — QA visual não reproduzível em fluxo headed autenticado.
- `INCONCLUSIVE` — transformação mobile do filtro precisa de captura fresca.

### Teste anti-genérico

- A primeira dobra desktop já parece TES.
- As regiões ainda mais próximas de um dashboard genérico são o heatmap/legenda
  e, em menor grau, a `FilterBar`; isso é aceitável apenas parcialmente porque
  continuam claramente secundárias, mas ainda precisam de calibração no mobile.

`GATE PROVISÓRIO SUPERADO`

## Learnings, gaps e Calibration

### Learnings

- A nova fundação A/B/C conseguiu orientar uma implementação coerente sem
  mexer no domínio.
- O flattening de tabs, command bar e rail melhorou a leitura da primeira dobra
  com pouca mudança estrutural.
- O teste unitário cobrindo madrugada evita regressão direta para o range fixo
  `08:00–22:00`.

### System gaps

- O gate local depende de um build hoje quebrado fora da captura visual.
- O harness E2E depende de credenciais/seed que não ficaram reprodutíveis no
  estado atual do branch.
- O Browser MCP não estava operacional no host durante este gate.

### Candidates for Calibration

- Variante aberta de `AppPageHeader`.
- Variante leve de `AppPageSection`.
- `CommandBar` compartilhado para período + modo de visualização.
- `FilterBar` com trigger recolhido no mobile e resumo de estado.
- `ContextRail` menos cardificado.
- Semântica oficial para o heatmap/legenda de demanda.

### Anti-pattern occurrences

- O heatmap ainda flerta com cardification informacional no mobile.
- A evidência mobile atual não garante transformação deliberada do filtro.

### Status

`GATE PROVISÓRIO SUPERADO`

## Agent E — Visual QA / Critic final

### Evidências finais de 2026-08-14

As capturas frescas e versionadas estão em
`docs/design-refactor/evidence/benchmark-a/`:

- Calendário: desktop `1440px`, tablet `820px` e mobile `390px`.
- Horários: desktop, tablet e mobile.
- Bloqueios: desktop, tablet, mobile e modal com overlay.

O indicador circular preto presente em algumas capturas é o indicador de
desenvolvimento do Next.js, não pertence à interface TES.

### Gates executados

- `npx vitest run` nos componentes/parsers afetados: `14/14` testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, incluindo visual policy, online-only e ESLint.
- `npm run build`: aprovado, `103/103` páginas estáticas geradas.
- Playwright E2E da Agenda em Chromium: `5/5` cenários aprovados.
- Playwright visível: fluxo autenticado, abertura de sessão e capturas nos três
  viewports aprovados.
- Playwright MCP visível: `page overflow = 0`; timeline desktop com
  `scrollWidth = clientWidth`; filtro desktop aberto; inspeção sem erros de
  console da aplicação.

A primeira tentativa da suíte completa dentro do sandbox falhou ao iniciar o
Chromium por permissão Mach port. A repetição autorizada fora do sandbox abriu o
browser normalmente. Na primeira repetição funcional, o gate encontrou uma
regra órfã de terapia arquivada no payload de Horários e uma asserção temporal
stale; ambos foram corrigidos e a suíte completa passou na repetição final.

### Crítica adversarial

- A primeira dobra deixa inequívocos período, agenda e ações; Insights não
  compete mais com a operação.
- A Timeline preserva uma única surface legítima, sem linha sobre a primeira
  hora; o range acompanha regras/eventos e cobre madrugada em teste dedicado.
- Desktop e tablet mantêm comparação semanal; mobile troca a grade por lista
  cronológica e não produz scroll horizontal de página.
- Filtro, legenda e heatmap iniciam recolhidos no mobile; o estado ativo
  continua disponível no trigger.
- O ContextRail desktop é mais contínuo e subordinado; Horários e Bloqueios
  ainda preservam mais containers do baseline, mas as surfaces comunicam
  configuração, resumo ou entidade e não impedem a tarefa.
- Bloqueios mobile mantém os chips de modo em uma faixa interna rolável. Não há
  overflow da página, mas a affordance dessa rolagem merece comparação no
  Benchmark B.
- Textos funcionais e metadata respeitam o gate mínimo; controles mantêm alvo de
  toque e nomes acessíveis.
- `TESDialog` permanece a autoridade de modal; o E2E confirmou overlay, bloqueio
  de scroll e fechamento por `Escape`.

### Visual Quality Score final

| Dimensão                   | Nota | Peso | Parcial |
| -------------------------- | ---: | ---: | ------: |
| Hierarquia de informação   |  4.5 |   20 |    18.0 |
| Composição e ritmo         |  4.0 |   15 |    12.0 |
| Clareza operacional        |  4.6 |   15 |    13.8 |
| Consistência TES           |  4.4 |   15 |    13.2 |
| Sofisticação visual        |  3.9 |   10 |     7.8 |
| Responsividade             |  4.6 |   10 |     9.2 |
| Acessibilidade             |  4.3 |   10 |     8.6 |
| Microinterações e feedback |  4.1 |    5 |     4.1 |

**Total final:** `86.7 / 100`

Todos os mínimos individuais obrigatórios são `>= 3.5/5`.

### Eliminatórios

- Overflow horizontal da página: não identificado.
- Ação principal ambígua: não.
- Contraste/conteúdo ilegível: não identificado.
- Quebra funcional ou regressão de domínio: não.
- Operação essencial sem teclado: não identificada.
- Informação crítica escondida: não.
- Falha de dialog: não identificada.
- Erro apresentado como vazio/sucesso: não.
- Microtexto abaixo do mínimo: visual policy aprovada.
- Inconsistência severa com TES: não.

**Nenhum eliminatório ativo.**

### Teste anti-genérico

Timeline, inputs e filtros são primitives operacionais que poderiam existir em
outros produtos e essa neutralidade é aceitável. O que não é genérico é a
composição: header editorial, linguagem responsável, hierarquia temporal,
tratamento de pendências, ContextRail sereno e Insight TES subordinado. Os rails
de Horários/Bloqueios ainda podem lembrar SaaS quando vistos isoladamente; isso
fica como dívida de Calibration, sem definir a identidade da experiência.

## Learnings finais, gaps e Calibration

### Learnings

- A cadeia A–C reduziu decisões improvisadas durante React e permitiu refatoração
  incremental sem alterar RPC, RLS ou fonte de verdade.
- Flattening seletivo melhora a leitura; remover todo container não é objetivo.
- Responsive transformation deliberada foi mais valiosa do que apenas reduzir
  spacing: a lista mobile é uma Agenda própria.
- `aria-expanded` sozinho não comprova recolhimento visual; screenshot review
  encontrou a colisão entre `hidden` e a classe `flex`.
- Faixa temporal derivada e teste de madrugada evitam regressão para um default
  fixo de `08:00`.
- Fixtures E2E com datas relativas precisam aceitar o empty state real ou criar
  o estado crítico no próprio teste.

### System gaps

- Não há tokens semânticos oficiais para cores de terapias nem hairline da grade.
- `AppPageHeader` e `AppPageSection` não oferecem variantes abertas/leves.
- Filtros e CommandBar ainda não possuem API compartilhada comprovada.
- A affordance de faixas roláveis de chips no mobile precisa ser comparada em um
  segundo domínio Operational.

### Candidates for Calibration

- Variante aberta de `AppPageHeader`.
- Variante leve de `AppPageSection`.
- `CommandBar` compartilhado para período + modo de visualização.
- `FilterBar` com trigger recolhido no mobile e resumo de estado.
- `ContextRail` menos cardificado.
- Semântica oficial para therapy colors, heatmap e hairlines operacionais.

### Anti-pattern occurrences e dívida aceita

- Horários e Bloqueios ainda usam mais surfaces do que o Calendário; preservados
  por risco e escopo, para comparação durante Calibration.
- A faixa de chips em Bloqueios mobile depende de rolagem interna.
- Hex locais de therapy colors permanecem allowlisted; não houve mudança global
  de tokens por evidência de uma única página.
- Nenhum candidate foi promovido antes dos três benchmarks.

### Status

`BENCHMARK A APPROVED`
