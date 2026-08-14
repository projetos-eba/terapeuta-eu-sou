# Benchmark B — Admin / Profissionais

Status: `BENCHMARK B APPROVED`  
Rota: `/admin/profissionais`  
Figma: `13425:1020`  
Branch de trabalho: `dev-antonio`  
Atualização: 2026-08-14

Este documento registra o workflow A–E do Benchmark B. A listagem existente,
seus read models, filtros, paginação, permissões, rotas e transições
administrativas permanecem como baseline funcional. A Agenda é evidência de
sistema, não template para esta página.

## Agent A — Product / UX Architect

### Primary task

Ao abrir Profissionais, o administrador precisa:

> Identificar rapidamente quais profissionais exigem acompanhamento
> administrativo e abrir o contexto correto — detalhe operacional ou fila de
> verificação — sem perder a capacidade de localizar uma pessoa conhecida.

A listagem apoia triagem e encaminhamento. Ela não aprova, publica, altera plano
nem executa mutações críticas diretamente.

### Secondary tasks

1. Localizar um profissional por nome, estado ou identificador já exposto pelo
   contrato seguro.
2. Reduzir o conjunto por estado cadastral real e ordenar por recência, nome,
   estado ou antiguidade.
3. Distinguir perfis que aguardam análise, estão em análise, precisam de ajustes,
   foram aprovados, não aprovados ou suspensos.
4. Verificar se o perfil está público e recebendo reservas.
5. Consultar plano, quantidade de serviços e data de atualização como contexto
   secundário.
6. Abrir o detalhe operacional do profissional.
7. Acessar a fila de verificações para iniciar análise ou registrar decisão no
   fluxo autorizado.
8. Navegar entre páginas preservando busca, filtro e ordenação na URL.

Não existe contrato de seleção ou operação em lote; checkbox e bulk actions
permanecem fora do escopo.

### Information hierarchy

1. **Contexto e propósito:** Profissionais, orientação curta e atualização do
   recorte.
2. **Exceções operacionais:** estados que indicam análise, ajuste, não aprovação
   ou suspensão.
3. **Descoberta:** busca persistente, estado e ordenação.
4. **Comparação:** identidade, situação cadastral, disponibilidade pública e
   contexto operacional essencial.
5. **Encaminhamento:** detalhe do profissional e fila de verificações.
6. **Continuidade:** quantidade exibida e paginação.

Classificação da informação:

| Nível         | Informação                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Primary`     | nome, situação cadastral, próximo destino/ação                                                                          |
| `Secondary`   | perfil público, recebe reservas, plano, última atualização                                                              |
| `On-demand`   | serviços, conta de recebimento e próxima sessão quando úteis ao detalhe                                                 |
| `Detail-only` | IDs completos, dados cadastrais ampliados, atividade detalhada, histórico, auditoria e comandos de suspensão/reativação |

### Entity anatomy

Cada profissional é apresentado como uma entidade comparável:

1. monograma + nome público;
2. slug/identificador curto como metadata, quando disponível;
3. situação cadastral principal em texto e tratamento semântico;
4. qualificadores compactos de publicação e reservas;
5. plano e atualização como contexto secundário;
6. ação explícita `Ver profissional`.

No desktop essa anatomia ocupa uma linha da `OperationalTable`. No mobile ela
vira `EntityList` estruturada, sem caixas internas para cada campo.

### Operational exceptions

Somente estados canônicos do contrato são utilizados:

- `draft` → Perfil em construção;
- `submitted` → Aguardando análise;
- `in_review` → Em análise;
- `changes_requested` → Ajustes solicitados;
- `approved` → Aprovado;
- `rejected` → Não aprovado;
- `suspended` → Suspenso.

`submitted`, `in_review`, `changes_requested`, `rejected` e `suspended` recebem
prioridade de varredura por representarem acompanhamento ou exceção. A
prioridade é visual e não altera ordenação, status ou regra de negócio.

### Search / filter model

- **Busca:** localiza entidade conhecida por texto. Continua no parâmetro `q`.
- **Filtro:** reduz por um único estado cadastral real. Continua em `status`.
- **Ordenação:** muda sequência por recência, antiguidade, estado ou nome.
- **View/segment:** não é criada; o domínio não oferece modos operacionais
  independentes nesta listagem.
- **Limpar:** aparece somente quando busca, estado ou ordenação não padrão estão
  ativos e restaura a rota canônica.
- **Contagem:** comunica o recorte retornado e os filtros ativos sem sugerir que
  métricas derivadas da página representam toda a base.

### Detail transition

- A linha conduz para `/admin/profissionais/[professionalId]`, rota própria
  adequada para inspeção, histórico e eventual suspensão/reativação.
- `Ver verificações` conduz para `/admin/profissionais/verificacoes`, onde
  `submitted → in_review → decisão` permanece protegido por comandos auditados.
- A listagem não duplica campos ampliados do detalhe e não abre painel lateral
  sem contrato.
- A ação de detalhe permanece textual e visível; não fica escondida em menu de
  overflow nem depende apenas de ícone.

### Critical states

- **Populated:** tabela/lista com identidade, estado e ação.
- **Empty real:** nenhum profissional acessível para a sessão atual.
- **Zero results:** nenhum profissional corresponde à busca/filtros; oferecer
  limpar filtros.
- **Unavailable:** falha de leitura explícita; nunca aparentar lista vazia.
- **Forbidden:** acesso insuficiente explicitado em linguagem de produto.
- **Loading:** preservar header e anatomia provável da operação sem inventar
  linhas.
- **Long content:** nome e slug longos não podem deslocar estado ou ação.
- **Unavailable metrics:** nunca desenhar gráfico, tendência ou comparação falsa.

### Responsive transformation

- **Desktop (≥ 1200px):** `OperationalTable` full-width, sem ContextRail; cinco
  agrupamentos legíveis — identidade, situação, disponibilidade, contexto e
  ação. Busca e filtros permanecem visíveis acima da tabela.
- **Tablet (768–1199px):** lista operacional de linhas adaptadas substitui a
  tabela larga; identidade e situação ficam na primeira linha, qualificadores e
  ação na segunda. Filtros usam duas linhas deliberadas, sem compressão extrema.
- **Mobile (375–430px):** `EntityList` vertical com divisores; busca persiste,
  filtros secundários começam recolhidos e resumem estado ativo; ação ocupa alvo
  de toque claro. Não existe scroll horizontal da página.

### UX risks

- Tratar métricas disponíveis como KPIs decisórios quando elas apenas descrevem
  a base.
- Confundir cadastro do profissional com fila de verificação.
- Usar plano ou publicação como proxy de risco.
- Dar mesma ênfase a sete estados distintos e perder operação por exceção.
- Expor ações críticas na listagem sem contexto ou contrato.
- Transformar todos os atributos disponíveis em colunas.
- Perder filtros ao paginar ou abrir/voltar do detalhe.
- Representar falha de backend como zero resultados.
- Confundir o total filtrável da janela sanitizada com cobertura irrestrita da
  base; a v2 atualmente processa até 50 registros do read model minimizado.

### Functional baseline

Capacidades preservadas antes da implementação:

- autenticação e permissão Admin server-side;
- leitura por `admin_get_operation_module_v2` sem `service_role` no cliente;
- busca, filtro, ordenação, paginação e `pageSize` na URL;
- métricas reais de total, aprovados, publicados e recebendo reservas;
- estados `available`, `unavailable` e `forbidden` distintos;
- acesso ao detalhe do profissional;
- acesso à fila de verificações;
- DTO minimizado sem documentos privados, conteúdo clínico ou dados sensíveis;
- suspensão/reativação somente no detalhe, quando permitida;
- aprovação e decisões somente no fluxo de verificação auditado.

### Gate A

- A página ajuda o Admin a decidir ou só lista dados? **Ajuda a priorizar
  acompanhamento e escolher o próximo contexto.**
- Alguma coluna existe apenas porque o dado está disponível? **Sim no baseline:
  serviços e atualização competem com situação; foram reclassificados como
  contexto secundário/on-demand.**
- Existe excesso de informação simultânea? **Sim no baseline por KPIs, três
  painéis analíticos e oito colunas; a proposta reduz a primeira dobra.**
- Status importantes possuem prioridade suficiente? **Na proposta, sim; estado
  acompanha a identidade e exceções recebem sinal semântico discreto.**
- Ações são claras? **Sim; `Ver profissional` e `Ver verificações` têm destinos
  distintos e explícitos.**
- Mobile possui experiência legítima? **Sim; EntityList substitui a tabela.**
- O fluxo para detalhe está claro? **Sim; rota própria preservada, sem painel ou
  mutação inventada.**
- Há conflito de domínio? **Não.**

`GATE A APPROVED`

## Agent B — Visual Director

### Admin visual character

A página deve transmitir **controle + precisão + serenidade + confiança**. A
identidade TES surge do título editorial contido, da linguagem de
acompanhamento, do respiro entre grupos e de uma tabela cuidadosamente
hierarquizada — não de decorar cada primitive.

O nível é `Operational`: alta capacidade de comparação com texto funcional de
14px, metadata nunca abaixo de 11px no desktop/10px no mobile, alvos de 44px e
espaçamento suficiente para evitar aparência de ERP comprimido.

### Baseline

**Preservar**

- título display itálico e copy curta;
- métricas autoritativas existentes, quando apresentadas como contexto e não
  como tendência;
- busca, estado, ordenação, paginação e atualização do recorte;
- tabela no desktop e estrutura responsiva por entidade;
- monograma, estado textual e link de detalhe;
- acesso separado à fila de verificações.

**Refinar**

- header para uma variante Admin mais compacta;
- métricas para `MetricStrip` sem cards, ícones ou sombras;
- identidade de linha e prioridade do status;
- filtros com labels visíveis, contador e estado ativo;
- ação textual em lugar do icon-only button;
- estados honestos com título, explicação e próximo passo;
- ritmo tablet e mobile.

**Remover**

- quatro KPI cards elevados;
- três cards analíticos derivados da página;
- gráfico de crescimento sem dados;
- donut e barras que sugerem distribuição da base usando somente as linhas da
  página atual;
- badge `Real/Indisp.` em toda métrica;
- pills para plano e todo status por convenção;
- caixas internas para cada atributo no mobile;
- sombras decorativas e radius grandes em toda região.

**Reestruturar**

- KPIs viram uma faixa contextual compacta;
- exceções da página atual viram uma mensagem operacional próxima da lista;
- tabela passa de oito colunas para cinco agrupamentos de decisão;
- filtros deixam de ser o header do card e se tornam controle diretamente
  associado à lista;
- mobile vira lista contínua por entidade, não conjunto de cards.

### Composition

- Canvas operacional: `max-width` próximo de `1280px`, condicionado à largura
  real disponível após o sidebar Admin.
- Header aberto e compacto; strip de métricas; bloco de operação com
  `SectionHeader`, busca/filtros e tabela/lista.
- First fold em 1440×900: título, contexto, `MetricStrip`, filtros e primeiras
  linhas da lista.
- Ritmo vertical: header→strip `24px`; strip→operação `24px`; header interno→
  filtros `20px`; filtros→resultado `16px`; seções maiores `24–32px`.
- A lista usa uma única superfície branca com hairline externa e divisores de
  linha. Sem sombra.
- Não há `ContextRail`; a tarefa depende de largura e comparação.

### Header

- Eyebrow `Admin`, 11–12px, uppercase com tracking moderado.
- `h1` display itálico de aproximadamente 46px no desktop, 38px no tablet e
  34px no mobile; menor que a Agenda por causa da densidade operacional.
- Supporting copy de 16px desktop e 14px mobile, com linha curta e orientada à
  tarefa.
- `Ver verificações` é ação secundária explícita e fica alinhada ao contexto,
  sem competir com busca ou parecer CTA comercial.
- Atualização é metadata textual, sem pill, card ou sombra.

### Operational summary

- Os quatro números existentes podem permanecer somente como `MetricStrip`:
  Profissionais, Aprovados, Publicados e Recebendo reservas.
- Células são separadas por spacing/hairline; não recebem ícone, card, badge,
  tendência ou cor promocional.
- Indisponibilidade usa `—` e explicação única, nunca quatro avisos repetidos.
- Uma frase junto à lista comunica quantos registros do recorte atual exigem
  acompanhamento, explicitamente limitada à página exibida.

### Search and filters

- Busca permanece sempre visível e recebe label persistente.
- Estado e ordenação ficam visíveis no desktop; no mobile começam recolhidos em
  disclosure nativo, com resumo de filtros ativos.
- Botão principal é `Aplicar filtros`; `Limpar` aparece somente com estado
  ativo.
- Resultado/paginação ficam associados semanticamente ao formulário.
- Inputs são primitives neutras; borda e foco têm função, não identidade
  decorativa.

### OperationalTable / EntityList

Desktop usa tabela porque a tarefa exige comparação. Agrupamentos:

1. **Profissional:** monograma, nome e slug/identificador curto;
2. **Situação:** estado principal + orientação curta quando exigir análise;
3. **Disponibilidade:** perfil público e reservas em duas linhas compactas;
4. **Contexto:** plano + atualização;
5. **Ação:** `Ver profissional` com seta.

Headers usam 11px, sem tracking extremo. Linhas usam altura aproximada de
72–80px, hover de surface soft, hairlines de baixo contraste e nenhum zebra.
Identity e status dominam; plano e data são secundários. Tablet/mobile usam
`EntityList` com a mesma ordem semântica, separada por dividers e sem card por
linha.

### Status treatment

- Estado principal usa ponto/ícone semântico + texto; não depende de cor.
- `Aprovado` permanece discreto; `Aguardando análise`, `Em análise`, `Ajustes
solicitados`, `Não aprovado` e `Suspenso` recebem surface sutil somente quando
  necessário para scan.
- Plano é texto; não pill.
- Publicação e reservas são pares label/valor compactos ou ícone + texto, não
  badges.
- Unknown mantém `Status não identificado`, sem inventar fallback positivo.

### Actions

- `Ver profissional` permanece visível em cada entidade e operável por teclado.
- `Ver verificações` é ação contextual do header/lista.
- Não há overflow menu, seleção, bulk action ou mutação na listagem.
- A linha inteira não vira link quando isso prejudicar foco e semântica da
  tabela.

### Surfaces, typography and density

- Background TES existente.
- Header e MetricStrip são abertos.
- Tabela/lista recebe uma única surface branca e border hairline legítima.
- Campos preservam border; filtros, métricas e status não ganham containers
  extras.
- Sem sombras; radius de card apenas no limite da região operacional.
- Display typography apenas no `h1`; operação usa sans.
- Texto funcional: 14–16px. Metadata: 11–12px desktop, 10–12px mobile.
- Números da faixa: 24–30px, tabulares quando aplicável.

### Responsive behavior

- **Desktop:** header compacto com ação lateral; MetricStrip em quatro células;
  filtros em linha; tabela sem scroll horizontal da página.
- **Tablet:** ação abaixo do header; MetricStrip em duas colunas abertas;
  busca ocupa linha própria; estado/ordenação ficam na linha seguinte;
  `EntityList` substitui tabela.
- **Mobile:** header e ação em fluxo; MetricStrip vira pares 2×2; busca
  persistente; filtros secundários recolhidos; entidade em bloco contínuo com
  ação full-width ou alinhada ao fim; sem overflow.

### Benchmark A candidate evaluation

| Candidate da Agenda     | Veredito visual   | Decisão no Admin                                                           |
| ----------------------- | ----------------- | -------------------------------------------------------------------------- |
| Open PageHeader         | `Needs variant`   | manter composição aberta, mas reduzir escala e altura para densidade Admin |
| Light PageSection       | `Transfers well`  | uma surface leve é adequada à região operacional comparável; sem sombra    |
| CommandBar              | `Agenda-specific` | navegação temporal/modo não existe; não renomear FilterBar como CommandBar |
| FilterBar               | `Needs variant`   | busca persistente + estado/ordenação; disclosure mobile e contagem Admin   |
| ContextRail             | `Reject`          | reduz largura e não contém decisão complementar necessária nesta listagem  |
| Hairline token          | `Transfers well`  | necessário para headers, rows e agrupamento sem border pesada              |
| Semantic therapy colors | `Agenda-specific` | terapias não participam desta listagem e não devem colorir estados Admin   |

### Figma `13425:1020`

- **Manter:** presença editorial do título, tabela como núcleo e paleta TES.
- **Adaptar:** largura, métricas, header, filtros e agrupamento das colunas.
- **Superar:** estados reais, mínimo tipográfico, mobile/tablet, clareza da ação,
  tratamento de falha e ausência de dados inventados.
- **Descartar:** gráficos/tendências sem contrato, microtexto, cards e badges em
  excesso, colunas inexistentes no DTO seguro e estética de dashboard genérico.

### Gate B — generic SaaS audit

| Região potencialmente genérica | Decisão                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| inputs/selects                 | neutralidade aceitável de primitive; TES aparece no foco, copy e composição                                     |
| tabela                         | neutralidade funcional aceitável; identidade vem da anatomia da entidade, hierarquia, ritmo e estados canônicos |
| MetricStrip                    | corrigir qualquer aparência de KPI dashboard removendo cards, ícones, tendências e decoração                    |
| header                         | corrigido por tipografia editorial contida, copy operacional TES e whitespace deliberado                        |
| status                         | corrigido pela linguagem canônica, operação por exceção e redução de pills                                      |
| paginação                      | primitive necessariamente neutra; preservar clareza e foco                                                      |

Nenhuma região genérica recebe peso suficiente para definir a página. O first
fold deixa de ser um dashboard analítico e passa a enquadrar pessoas, exceções e
próximo passo.

`GATE B APPROVED`

## Agent C — Design System Guardian

### Reuse decisions

| Elemento                                         | Classificação                   | Decisão                                                             |
| ------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------- |
| `AdminOperationPage` e dispatch                  | `existing/shared`               | preservar                                                           |
| `AdminOperationPageData`, rows, metrics e states | `existing/domain`               | reutilizar sem expandir DTO por visual                              |
| `buildAdminListHref`                             | `existing/shared`               | autoridade para estado da URL                                       |
| `routes.admin.*`                                 | `existing/shared`               | preservar rotas canônicas                                           |
| `formatPlanLabel`                                | `existing/domain`               | reutilizar nomenclatura canônica                                    |
| PageHeader                                       | `variant/local`                 | composição aberta `admin-compact-open`; não alterar `AppPageHeader` |
| MetricStrip                                      | `candidate/local`               | compor métricas autoritativas, sem componente global                |
| FilterBar                                        | `variant/local`                 | busca persistente + filtros/disclosure Admin                        |
| OperationalTable                                 | `candidate/local`               | tabela semântica desktop                                            |
| EntityList                                       | `candidate/local`               | transformação tablet/mobile                                         |
| EmptyState                                       | `pattern/local`                 | distinguir empty, zero result, unavailable e forbidden              |
| StatusCluster                                    | `pattern/local`                 | estado + qualificadores; sem fileira de badges                      |
| inputs/selects nativos                           | `existing/primitive`            | semântica nativa + tokens TES                                       |
| `TESInput`                                       | `rejected for this use`         | altura, radius e elevação não atendem Operational                   |
| `FilterButton`                                   | `rejected for this use`         | API não cobre disclosure/estado ativo sem sombra                    |
| `TESBadge`                                       | `rejected for status treatment` | induz pill e microtexto abaixo do mínimo                            |
| `TESCard`                                        | `rejected for wrappers`         | borda + sombra padrão reintroduzem cardification                    |

### Benchmark A candidate verdicts

| Candidate               | Veredito C          | Justificativa                                                                |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Open `AppPageHeader`    | `Variant needed`    | princípio transfere; escala e ritmo Admin são próprios                       |
| Light `AppPageSection`  | `Confirmed`         | princípio de uma surface funcional sem sombra; API React ainda candidate     |
| CommandBar              | `Rejected`          | agrupamento temporal/modo é específico da Agenda                             |
| FilterBar               | `Variant needed`    | anatomia transfere; busca, status, ordenação e disclosure são Admin          |
| ContextRail             | `Rejected`          | compromete largura comparativa sem contexto indispensável                    |
| Hairline token          | `Still candidate`   | border TES cobre cor; token operacional dedicado ainda carece de Benchmark C |
| Semantic therapy colors | `Rejected` no Admin | não aplicável a estados administrativos                                      |

### New candidates

Permanecem locais até Calibration:

- `OperationalTable`;
- `ResponsiveEntityList`;
- `MetricStrip`;
- `OperationalFilterBar`;
- `EntityIdentity`;
- `OperationalStatus`;
- `OperationalPagination`;
- `ExceptionSummary`.

### Local variants and components

- header `admin-compact-open`;
- FilterBar `operational-admin`;
- MetricStrip `admin-summary`;
- status `neutral`, `attention`, `critical`, sempre textual;
- surface branca, hairline única e `shadow-none`;
- `ProfessionalsMetricStrip`, `ProfessionalsFilters`,
  `ProfessionalsTable`, `ProfessionalsEntityList`, `ProfessionalIdentity`,
  `ProfessionalStatus`, paginação e estados permanecem locais.

Nenhuma pasta ou primitive global será criada neste benchmark.

### Token gaps

- wrappers `AppPage*`/`TESCard` não possuem variante oficial sem sombra;
- não existe mapa canônico `professional status → tone`;
- border TES cobre cor, mas não há token component-level de hairline operacional;
- falta primitive de input/select compacta Operational;
- falta button/link secundário compacto sem pill/sombra.

Usar tokens existentes localmente e registrar lacunas; nenhuma mudança global é
necessária antes do Benchmark C.

### Duplicate findings

O benchmark confirma duplicações de `MetricCard`, status, filtros, paginação,
empty/error states, tabelas/listas responsivas e métrica indisponível. As APIs
ainda divergem e consolidá-las agora cristalizaria versões card-heavy. Registrar,
não resolver.

### Wrappers and system risks

- não alterar globalmente `AppPageHeader`, `AppPageSection` ou `TESCard`;
- métricas derivadas das rows visíveis não podem parecer distribuição global;
- exceção visual não altera ordenação ou regra de negócio;
- usar a copy canônica `Não aprovado` para `rejected`;
- não produzir overflow horizontal da página;
- não expor campos detail-only ou comandos críticos;
- não transformar falha em empty state;
- o arquivo da página apareceu removido durante o handoff entre agentes; Agent D
  deve recriá-lo de modo rastreável sem tocar no domínio.

### Calibration notes

- header aberto é sustentado por dois benchmarks, mas não há ainda escala/API
  universal;
- surface leve é promissora e precisa do Benchmark C em densidade Balanced;
- FilterBar é o candidate mais forte, já com variants de domínio;
- CommandBar e ContextRail são soluções corretas para Agenda, não universais;
- OperationalTable/EntityList e MetricStrip precisam da comparação com
  `/app/encontros` antes de promoção.

Não há conflito de domínio, rota, contrato ou decisão arquitetural pendente.

`DESIGN READY — BENCHMARK B`

## Agent D — Implementer

### Implementation

`/admin/profissionais` foi refatorada incrementalmente sobre os mesmos DTOs,
queries e rotas.

- header aberto e compacto com supporting copy orientada à triagem;
- `Ver verificações` preservado como destino separado;
- quatro métricas autoritativas convertidas de KPI cards em `MetricStrip` sem
  ícones, badges, tendências ou sombras;
- métricas omitidas no mobile para colocar a primeira entidade na primeira
  dobra; o total do recorte permanece junto à lista;
- sete surfaces analíticas do baseline removidas, inclusive o gráfico sem série
  consolidada e distribuições derivadas somente da página;
- uma única surface operacional reúne SectionHeader, filtros, resultados e
  paginação;
- busca persistente, labels visíveis, status e ordenação em desktop/tablet;
- status e ordenação recolhidos em disclosure nativo no mobile;
- `OperationalTable` desktop com cinco agrupamentos: profissional, situação,
  disponibilidade, contexto e ação;
- `ResponsiveEntityList` no tablet/mobile, sem card ou box por atributo;
- estado textual + ponto semântico, sem pills de plano/status;
- ação icon-only substituída por `Ver profissional` textual;
- empty real, zero result, unavailable e forbidden possuem título/copy próprios;
- loading route-level reflete header, filtros e linhas sem inventar conteúdo;
- paginação continua preservando busca, status, sort, page e pageSize na URL.

### Functional parity

Preservados:

- autenticação/permissionamento Admin;
- `admin_get_operation_module_v2` e DTO minimizado;
- busca, filtro, ordenação, paginação e recarga por URL;
- métricas reais;
- estados `available`, `unavailable` e `forbidden`;
- rota de detalhe do profissional;
- fila de verificações;
- comandos de suspensão/reativação somente no detalhe;
- decisões de aprovação somente no fluxo auditado de verificações;
- ausência de documentos privados, conteúdo clínico e payload bruto.

Não houve mudança em schema, RLS, RPC, API, rota canônica, autenticação,
permissão, Stripe, Zoom ou dependência.

### Files

- `src/features/admin-operations/components/admin-professionals-page.tsx`;
- `src/features/admin-operations/components/admin-professionals-page.test.tsx`;
- `src/app/(admin)/admin/profissionais/loading.tsx`;
- `tests/e2e/admin-operations.spec.ts`;
- `skills/admin-people-operations/SKILL.md`;
- documentação e evidências do benchmark.

### Validation

- 26 testes direcionados em 6 arquivos: aprovados;
- `npm run typecheck`: aprovado;
- `npm run lint`: aprovado, incluindo visual policy e online-only;
- `npm run build`: aprovado após implementação e documentação finais;
- Playwright Chromium `--headed`: 3/3 cenários Admin aprovados;
- desktop 1440×900, tablet 1024×768 e mobile 390×844: sem overflow de página;
- busca, filtro sem resultado, limpar, disclosure mobile e detalhe: aprovados;
- execução multi-project inicial: projeto Chromium funcional; três jobs `msedge`
  não iniciaram porque Microsoft Edge não está instalado. Isso é limitação do
  ambiente, não regressão da página.
- a primeira repetição isolada do cenário final encontrou o servidor local
  encerrado (`ERR_CONNECTION_REFUSED`); após iniciar o runtime, o mesmo cenário
  headed passou integralmente.

## Agent E — Visual QA / Critic

### Evidence reviewed

- desktop `1440×900`: header, MetricStrip, filtros, tabela e primeiras linhas;
- tablet `1024×768`: header, resumo e `ResponsiveEntityList`;
- mobile `390×844`: busca e primeira entidade na primeira dobra;
- mobile `390×844`, filtros abertos: disclosure, estado, ordenação e ação;
- nos três viewports, `documentElement.scrollWidth <= innerWidth`.

Evidências:

- `docs/design-refactor/evidence/benchmark-b/admin-professionals-desktop.png`;
- `docs/design-refactor/evidence/benchmark-b/admin-professionals-tablet.png`;
- `docs/design-refactor/evidence/benchmark-b/admin-professionals-mobile.png`;
- `docs/design-refactor/evidence/benchmark-b/admin-professionals-mobile-filters.png`.

### Visual Quality Score

| Dimensão                   | Nota base | Peso | Resultado |
| -------------------------- | --------: | ---: | --------: |
| Hierarquia de informação   |       4,5 |   20 |      18,0 |
| Composição e ritmo         |       4,3 |   15 |      12,9 |
| Clareza operacional        |       4,5 |   15 |      13,5 |
| Consistência TES           |       4,3 |   15 |      12,9 |
| Sofisticação visual        |       4,1 |   10 |       8,2 |
| Responsividade             |       4,5 |   10 |       9,0 |
| Acessibilidade             |       4,1 |   10 |       8,2 |
| Microinterações e feedback |       3,8 |    5 |       3,8 |
| **Total**                  |           |  100 |  **86,5** |

Mínimos individuais atendidos e nenhum critério eliminatório identificado.

### Adversarial review

- **Primeira dobra:** comunica contexto, quatro números reais, busca, recorte e
  primeiras entidades no desktop; no mobile a faixa de métricas é removida para
  manter a operação antes da dobra.
- **Operational scan test:** em aproximadamente cinco segundos, nome, situação
  e orientação de acompanhamento formam o caminho visual dominante. Exceções
  não competem com plano ou metadata.
- **Table scan test:** identidade é a primeira coluna, status é textual,
  disponibilidade e contexto estão agrupados, e `Ver profissional` permanece
  localizável. Hairlines organizam sem zebra, shadow ou caixa por campo.
- **Cardification:** restrita a uma única surface operacional legítima; header e
  métricas permanecem abertos.
- **Generic SaaS audit:** tabela, selects e paginação são primitives
  deliberadamente neutros. A tela deixa de parecer template pela composição
  editorial compacta, linguagem de acompanhamento, operação por exceção,
  status canônicos, ritmo e transformação responsiva — não por decoração.
- **Tablet:** a tabela não é apenas comprimida; transforma-se em lista
  deliberada com a mesma hierarquia decisória.
- **Mobile:** busca persiste, filtros secundários recolhem, primeira entidade
  permanece visível e não há scroll horizontal da página.
- **Teclado/foco:** disclosure mobile abre por teclado; a sequência de Tab leva
  busca a status e o foco visual do select foi verificado no navegador.

### Eliminators

| Critério                      | Resultado |
| ----------------------------- | --------- |
| overflow horizontal de página | `PASS`    |
| quebra funcional              | `PASS`    |
| ação principal ambígua        | `PASS`    |
| contraste crítico             | `PASS`    |
| operação por teclado          | `PASS`    |
| microtexto abaixo do mínimo   | `PASS`    |
| feedback enganoso             | `PASS`    |
| falha responsiva              | `PASS`    |

### Accepted debt and system gaps

- não há evidência visual capturada com profissionais reais em cada estado de
  exceção; copy e tratamentos foram exercitados por unitário e pelo estado
  disponível do seed;
- a tabela permanece visualmente neutra por intenção; a identidade TES depende
  da composição ao redor e deve ser reavaliada na Calibration;
- `MetricStrip`, `OperationalTable`, `ResponsiveEntityList` e FilterBar Admin
  continuam locais até o Benchmark C;
- não existe ainda primitive Operational canônica para input/select ou link
  secundário compacto;
- o projeto `msedge` não iniciou no ambiente local porque o Microsoft Edge não
  está instalado; Chromium headed concluiu os cenários funcionais e
  responsivos.

### Benchmark A × B candidate comparison

| Candidate               | Agenda                                      | Admin                                           | Status              |
| ----------------------- | ------------------------------------------- | ----------------------------------------------- | ------------------- |
| Open PageHeader         | variante aberta e editorial local           | variante aberta, mais compacta e operacional    | `Needs variant`     |
| Light PageSection       | regiões planas para calendário e apoio      | uma surface operacional sem sombra              | `Promising`         |
| CommandBar              | modos e navegação temporal                  | não existe tarefa equivalente                   | `Domain-specific`   |
| FilterBar               | filtros da agenda + disclosure mobile       | busca, status, sort + disclosure mobile         | `Needs variant`     |
| ContextRail             | contexto temporal complementar              | reduz largura comparativa sem decisão adicional | `Domain-specific`   |
| Hairline token          | grid temporal e divisões sutis              | headers, rows e agrupamentos com token atual    | `Await Benchmark C` |
| Semantic therapy colors | eventos e terapias da Agenda                | não aplicável a estados administrativos         | `Domain-specific`   |
| MetricStrip             | não utilizado como summary operacional      | candidate local para números reais              | `Await Benchmark C` |
| OperationalTable        | não aplicável ao núcleo temporal            | candidate local de comparação desktop           | `Await Benchmark C` |
| ResponsiveEntityList    | listas contextuais, não substituto da grade | transformação deliberada de tablet/mobile       | `Await Benchmark C` |

Mesmo os candidates observados duas vezes não são promovidos antes do Benchmark
C e da Calibration.

### Learnings and calibration notes

- composição aberta transfere entre domínios, mas sua escala precisa variar por
  densidade e tarefa;
- uma única surface funcional pode sustentar densidade sem retornar a cards
  aninhados;
- FilterBar é uma anatomia promissora, não uma implementação universal;
- CommandBar e ContextRail foram decisões fortes da Agenda, não autoridades
  globais;
- operações por exceção e transformação Table→EntityList são hipóteses próprias
  do Admin a testar contra a experiência humana/balanced;
- o Design System atual foi suficiente sem hex, token global ou wrapper global
  novo.

`BENCHMARK B APPROVED`
