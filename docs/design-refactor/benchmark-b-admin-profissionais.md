# Benchmark B — Admin / Profissionais

Status: `DESIGN READY — BENCHMARK B`  
Rota: `/admin/profissionais`  
Figma principal: `13425:1020`  
Atualização: 2026-08-14

Este documento registra a definição A–C do benchmark antes da implementação.
O objetivo não é copiar a Agenda nem o frame atual do Figma; é validar a
linguagem TES em uma experiência administrativa de alta densidade, preservando
read models, rotas, permissões e estados reais.

## Agent A — Product / UX Architect

### Primary task

Ao abrir `/admin/profissionais`, o Admin precisa responder rapidamente:

> Quais profissionais deste recorte exigem atenção operacional agora, e qual
> detalhe preciso abrir para decidir o próximo passo?

A tarefa dominante não é “gerir profissionais” genericamente. É triagem
operacional com drill-down seguro para detalhe e verificação.

### Secondary tasks

1. Encontrar um profissional conhecido por nome, slug ou identificador.
2. Reduzir o conjunto por estado administrativo.
3. Comparar situação do cadastro sem abrir cada detalhe.
4. Entender se o perfil está público e recebendo reservas.
5. Identificar rapidamente cadastros em análise, aguardando análise, com ajustes
   solicitados ou suspensos.
6. Abrir o detalhe do profissional para leitura operacional.
7. Ir para a fila de verificações quando o fluxo exigir revisão.
8. Navegar por paginação preservando filtros e ordenação.

### Information hierarchy

#### Primary

- Identidade do profissional.
- Estado administrativo principal.
- Sinais que mudam decisão imediata: perfil público, recebendo reservas,
  serviços, atualização recente e link para detalhe.
- Busca/filtro para localizar ou priorizar o recorte.

#### Secondary

- Plano.
- Próxima sessão quando disponível.
- Conta de recebimento/Stripe Connect quando já vier no DTO.
- Resumos reais do recorte atual e da atenção administrativa.

#### On-demand

- Métricas agregadas reais do módulo.
- Notas de guardrail.
- Distribuição resumida por status no recorte.

#### Detail-only

- Identificadores internos completos.
- Cidade, idiomas, histórico administrativo, conta vinculada, Stripe Connect
  detalhado, rastreabilidade ampla e demais campos do detalhe.

### Entity anatomy

Cada linha/registro precisa expor:

1. **Identity:** nome público + slug ou identificador curto.
2. **Operational state:** status administrativo canônico.
3. **Public posture:** situação pública do perfil.
4. **Commercial readiness:** plano, reservas, serviços.
5. **Freshness:** atualizado em / próxima sessão quando houver.
6. **Action:** abrir profissional.

### Operational exceptions

O Admin trabalha por exceção. As exceções reais deste módulo são:

- `submitted` — Aguardando análise.
- `in_review` — Em análise.
- `changes_requested` — Ajustes solicitados.
- `suspended` — Suspenso.
- `rejected` — Não aprovado.

Estados estáveis de menor urgência:

- `approved`.
- `draft`.

Observação: `public_status` é contexto secundário da visibilidade pública, não
substitui o status administrativo.

### Search/filter model

- **Busca:** encontrar entidade conhecida; persiste na URL em `q`.
- **Filtro:** reduzir por status administrativo; persiste em `status`.
- **Ordenação:** reorganizar o recorte; persiste em `sort`.
- **View/segment:** não há contrato real para múltiplas views operacionais nesta
  fase. O benchmark não inventa tabs nem bulk selection.

### Detail transition

- A listagem continua sendo a superfície de triagem.
- O detalhe do profissional permanece em rota dedicada.
- Verificações continuam em rota dedicada própria.
- A listagem deve sugerir o próximo drill-down, não absorver o conteúdo do
  detalhe nem a revisão.

### Critical states

- Loading.
- Erro de leitura.
- Acesso restrito.
- Lista populada.
- Lista vazia real.
- Zero resultados após filtro/busca.
- Registros com status de atenção.
- Registros sem alguns campos operacionais opcionais.

### Responsive transformation

- **Desktop:** tabela operacional para comparação rápida.
- **Tablet:** tabela simplificada com menos colunas e hierarquia preservada.
- **Mobile:** entity list vertical; cada registro vira bloco de triagem com
  identidade, status, sinais principais e CTA direto. Sem horizontal page
  scrolling.

### UX risks

- Transformar todo dado disponível em coluna.
- Analytics placeholder competir com a tarefa principal.
- Filtros dominarem a primeira dobra.
- Misturar status administrativo e visibilidade pública.
- Esconder a ação primária em affordance fraca.
- Tabela grande demais no tablet/mobile.
- Mobile virar versão comprimida da tabela desktop.

### Capacidades funcionais atuais

- Buscar por `q`.
- Filtrar por `status`.
- Ordenar por `sort`.
- Paginar via URL.
- Navegar para detalhe do profissional.
- Navegar para `/admin/profissionais/verificacoes`.
- Exibir métricas reais do módulo.
- Exibir estados honestos `available`, `forbidden`, `unavailable` e vazio.

### Gate A

- A página ajuda o Admin a decidir ou só lista dados?  
  Ajuda a decidir quando a listagem prioriza exceções e CTA claro para detalhe.

- Alguma coluna existe apenas porque o dado está disponível?  
  Sim, no baseline atual há excesso visual em analytics e parte da metadata pode
  ser rebaixada para secondary/detail-only.

- Existe excesso de informação simultânea?  
  Sim, principalmente pela combinação de cards analíticos, gráfico placeholder e
  tabela com badges.

- Status importantes possuem prioridade suficiente?  
  Não no baseline; precisam ganhar centralidade na linha.

- Ações são claras?  
  Parcialmente. O ícone isolado é funcional, mas discreto demais.

- Mobile possui experiência legítima?  
  Parcialmente. Há cards, mas ainda muito próximos de “tabela comprimida”.

- O fluxo para detalhe está claro?  
  Sim, e deve continuar.

`GATE A: PASS`

## Agent B — Visual Director

### Admin visual character

A página deve transmitir:

- controle;
- precisão;
- serenidade;
- confiança;
- maturidade operacional.

Evitar:

- dashboard SaaS genérico;
- ERP pesado;
- health admin frio;
- analytics ornamental.

### Composition

- Header editorial mais compacto que o da Agenda.
- First fold: título/contexto curto, resumo operacional leve, busca/filtros,
  início da tabela.
- O conteúdo principal ocupa largura total; não há ContextRail dominante nesta
  página.
- A comparação precisa da tabela vale mais que side panels ou grids de cards.

### Header

- Mantém identidade editorial TES com display serif no título.
- Reduz altura, peso de supporting copy e competição visual.
- CTA secundário legítimo: abrir verificações.
- Timestamp vira metadata discreta, não bloco elevado.

### Operational summary

- Substituir KPI cards grandes por uma faixa compacta com:
  - métricas reais do módulo;
  - resumo de atenção no recorte atual.
- Não usar gráfico de crescimento fake nem donut decorativo.
- O resumo deve explicar o recorte, não simular BI.

### Search/filter treatment

- Busca persistente como controle principal.
- Filtro por status e ordenação como suportes diretos.
- Estado ativo e “Limpar” visíveis, mas sem virar a superfície dominante.
- Mobile usa disclosure recolhido com resumo do estado ativo.

### Table/entity-list treatment

- **Desktop:** tabela refinada, com coluna primária forte e metadata agrupada.
- **Tablet:** esconder colunas secundárias e preservar leitura comparativa.
- **Mobile:** entity list com blocos de triagem e CTA textual claro.

### Status treatment

- Um único status principal recebe pill/cápsula semântica.
- Estados auxiliares usam texto, dot ou metadata curta.
- Plano não precisa competir como badge chamativo.
- “Perfil público” e “Reservas” devem ser scannables sem excesso de cor.

### Actions

- Ação primária por linha: ver profissional.
- Overflow menu não é necessário porque não há múltiplas ações operacionais
  reais nesta listagem.
- Verificações fica como CTA de contexto do módulo, não por linha.

### Surfaces

- Reduzir cardification.
- Uma única surface principal para filtros + tabela é legítima.
- Summary strip pode usar surface leve ou hairline separators.
- Evitar múltiplos cards equivalentes no topo.

### Typography

- Título editorial TES.
- Texto funcional mínimo 14px.
- Metadata 11px desktop / 10px mobile.
- Headers de tabela/section em uppercase pequeno, mas acima do mínimo de
  legibilidade.

### Density

`Operational`

Sem microtexto, sem excesso de colunas e sem bordas competindo entre si.

### Responsive behavior

- Desktop: full-width operational table.
- Tablet: simplified table.
- Mobile: stacked entities com filtros recolhidos.

### Benchmark A candidate evaluation

| Candidate                  | Verdict            | Nota                                                                 |
| -------------------------- | ------------------ | -------------------------------------------------------------------- |
| Open PageHeader            | Needs variant      | a lógica transfere, mas o Admin exige header mais compacto           |
| Light PageSection          | Promising          | a necessidade transfere; implementação ainda deve permanecer local   |
| CommandBar                 | Agenda-specific    | o Admin não tem comandos de tempo nem ações em lote reais            |
| FilterBar                  | Needs variant      | a lógica transfere, a anatomia precisa ser mais densa e compacta     |
| ContextRail                | Reject             | para esta página ele reduz throughput e induz layout SaaS genérico   |
| Hairline token             | Promising          | a tabela se beneficiaria de uma semântica oficial de divisória leve  |
| Semantic therapy colors    | Domain-specific    | não se aplicam a este benchmark                                      |

### SaaS-generic risks

- Tabela muito neutra sem hierarquia.
- Summary strip parecer “mini KPI dashboard”.
- Inputs e selects com excesso de contorno decorativo.
- Header grande demais para tarefa densa.

### Gate B

Partes que poderiam pertencer a qualquer SaaS Admin:

1. **Busca + select + paginação**  
   Aceitável como primitive neutro; a identidade vem da composição.

2. **Tabela operacional**  
   Aceitável como primitive, desde que a hierarquia, ritmo e linguagem TES não
   pareçam template.

3. **Status pill principal**  
   Aceitável, mas precisa ser econômica e não multiplicada indiscriminadamente.

`GATE B: PASS`

## Agent C — Design System Guardian

### Reuse decisions

| Elemento                               | Classificação | Decisão                                                                 |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `AdminProfessionalsPage`               | existing      | refatorar incrementalmente                                              |
| `EditorialHeader`                      | existing      | reutilizar com variante local de composição                             |
| `ProductBackLink` / breadcrumbs        | existing      | manter                                                                  |
| `AdminListQuery`                       | existing      | preservar URL contract                                                  |
| `AdminOperationPageData`               | existing      | preservar                                                               |
| table/list local da página             | local         | refinar localmente                                                      |
| summary strip do benchmark             | local         | não promover                                                            |
| status cluster de linha                | candidate     | observar repetição em Benchmark C antes de promover                     |
| operational table refinada             | candidate     | ainda não promover para shared                                          |
| mobile entity row                      | candidate     | manter local                                                            |

### Benchmark A candidate verdicts

- Variante aberta de `AppPageHeader`: `Variant needed`
- Variante leve de `AppPageSection`: `Still candidate`
- `CommandBar`: `Rejected` para este benchmark
- `FilterBar`: `Variant needed`
- `ContextRail`: `Rejected`
- Hairline token: `Still candidate`
- Semantic therapy colors: `Rejected` aqui / `Domain-specific`

### New candidates

- `OperationalTable`
- `EntityRow`
- `StatusCluster`
- `MetricStrip`
- `AdminFilterBar`

Todos permanecem `candidate` até Calibration.

### Variants

- Header administrativo compacto usando composição local.
- FilterBar administrativa compacta.
- Table row com status cluster leve.

### Local components

- Summary strip do módulo.
- Active filters summary.
- Mobile professional entity card refinado.

### Token gaps

- Semântica oficial de hairline/table divider continua ausente.
- Falta API de surface “leve sem elevação” nos wrappers globais.

### Duplicate findings

- Repetição de filtros locais entre Admin, Agenda, Sessões e busca pública.
- Repetição de métricas/card summaries com pesos visuais diferentes.
- Repetição de status pills/badges em múltiplos módulos.

### System risks

- Promover abstrações cedo demais por causa de dois benchmarks operacionais.
- Refatorar `AppPageHeader`/`AppPageSection` globalmente agora.
- Tentar resolver toda a dívida admin em `/admin/profissionais`.

### Calibration notes

- Verificar no Benchmark C quais decisões são TES-wide e quais eram apenas
  corretas para experiências densas.
- Reavaliar `MetricStrip`, `FilterBar` e `OperationalTable` somente após o caso
  balanced do paciente.

`DESIGN READY — BENCHMARK B`
