# Benchmark C — Paciente / Encontros

Status: `BENCHMARK C APPROVED`  
Rota: `/app/encontros`  
Figma: página `13366:3189`; frame visível `13366:3444`  
Branch de trabalho: `dev-antonio`  
Atualização: 2026-08-14

Este documento registra o workflow A–E do último benchmark anterior à
Calibration. Booking, pagamento, reagendamento, cancelamento, Zoom, RLS,
autenticação, rotas e read models foram preservados. O redesign altera
apresentação e hierarquia; não cria autoridade paralela de estado.

## Agent A — Product / UX Architect

### Primary task

Ao abrir Encontros, o paciente precisa:

> Identificar em poucos segundos quando e com quem será seu próximo encontro e
> compreender se existe alguma ação necessária agora.

A página não é um ledger de bookings nem um dashboard da jornada. Ela reduz
incerteza temporal e encaminha o próximo passo autorizado.

### Secondary tasks

1. Reconhecer terapeuta, terapia, data e horário do próximo encontro.
2. Entender pagamento ou reagendamento quando exigirem atenção.
3. Entrar no encontro somente quando a elegibilidade real autorizar.
4. Consultar os demais encontros futuros sem competir com o próximo.
5. Abrir o detalhe para pagamento, cancelamento, reagendamento e Zoom.
6. Retomar histórico, resumo, avaliação, reembolso ou suporte conforme estado.
7. Encontrar profissionais ou iniciar o Match TES quando não houver futuro.

### Temporal hierarchy

1. Próximo encontro e ação contextual.
2. Demais encontros futuros.
3. Pendências, somente quando pertencem à entidade afetada.
4. Encontros anteriores.

Estados reais preservados na apresentação:

- `confirmed` → horário confirmado;
- `live` → entrada disponível via detalhe/backend;
- `pending_payment` → pagamento precisa de atenção;
- `reschedule_requested` → solicitação em andamento;
- `completed` → encontro realizado;
- `cancelled` → encontro cancelado e reembolso quando aplicável.

Não foi criado estado visual paralelo para pagamento, sala ou Zoom.

### Information hierarchy

| Nível         | Informação                                                                   |
| ------------- | ---------------------------------------------------------------------------- |
| `Primary`     | proximidade temporal, data/hora, terapeuta, próximo passo autorizado         |
| `Secondary`   | serviço/terapia e orientação do estado                                       |
| `Contextual`  | hint da janela de entrada, pagamento ou reagendamento quando relevante       |
| `On-demand`   | detalhes, resumo, avaliação, suporte e reembolso                             |
| `Detail-only` | cancelamento, reagendamento, recibo, Zoom e demais informações transacionais |

Preço, status financeiro bruto, papel Zoom, token e URL de reunião nunca
aparecem como metadata constante da lista.

### Interaction model

- Uma entidade dominante (`NextEncounterSpotlight`) organiza tempo, relação e
  próximo passo.
- Uma única CTA dominante vem de `primaryAction` existente.
- Ações de gestão permanecem no detalhe; o menu de overflow não condicionado
  deixa de ser renderizado na listagem.
- Futuro e histórico usam listas contínuas com divisores.
- O vazio oferece Match TES e busca de profissionais por rotas existentes.

### Progressive disclosure

- Sempre visíveis: próximo encontro, data/hora, terapeuta, orientação e CTA.
- Visíveis na linha: identidade, tempo, estado relevante e ação disponível.
- No detalhe: pagamento ampliado, cancelamento, reagendamento, preparação e
  autorização de entrada.
- Removidos da composição principal: métricas, tópicos inferidos, banner
  concorrente, filtros sem necessidade e informação técnica.

### Journey framing

A continuidade nasce da sequência próximo → futuros → anteriores e da relação
com o terapeuta. Não há promessa de transformação, interpretação clínica nem
tópicos inferidos ganhando autoridade editorial.

### Empty state model

O vazio comunica que não existem encontros agendados e oferece dois próximos
passos reais:

- `Fazer meu Match TES`;
- `Explorar terapeutas`.

O histórico pode continuar disponível abaixo quando a pessoa não possui futuro,
mas já realizou encontros.

### Responsive transformation

- **Desktop:** header aberto, spotlight assimétrico e listas horizontais
  comparáveis.
- **Tablet:** spotlight linear; tempo, terapeuta, estado e CTA permanecem no
  mesmo contexto; listas preservam a anatomia.
- **Mobile:** título → próximo encontro → CTA → futuros → histórico. Linhas
  viram registros abertos empilhados, sem tabela ou overflow horizontal.

### UX risks

- tornar o próximo encontro um booking card genérico;
- deixar histórico competir com o futuro;
- transformar estado técnico em carga cognitiva;
- mostrar gestão fora do detalhe sem política state-aware;
- ocultar a CTA no mobile;
- usar linguagem emocional artificial;
- representar falha como empty state.

### Gate A

- Próximo passo inequívoco: **sim**.
- Estados traduzidos para produto: **sim**.
- Métricas/pagamento não dominam sem necessidade: **sim**.
- Futuro precede histórico: **sim**.
- Mobile possui estratégia própria: **sim**.
- Contratos de domínio preservados: **sim**.

`GATE A APPROVED`

## Agent B — Visual Director

### Patient visual character

`Serenidade + continuidade + clareza temporal + confiança profissional`.
Humanidade vem de tempo, terapeuta, linguagem e próximo passo; não de
ilustração, misticismo ou decoração suave.

### Composition

- composição aberta e vertical;
- PageHeader local em variante `balanced`;
- uma única accent surface tokenizada para o próximo encontro;
- demais futuros e histórico sem container elevado;
- listas com whitespace e hairlines;
- sem rail, grid de KPI ou card por entidade.

### Typography and rhythm

- display TES no `h1`, títulos temporais e seções;
- sans para operação, orientação e CTA;
- data/hora e terapeuta dominam metadata;
- texto funcional ≥14px;
- metadata ≥11px desktop e ≥10px mobile;
- intervalos de 24–32px dentro do spotlight e 36–44px entre grandes grupos.

### CTA and status

- `Entrar no encontro` domina apenas quando autorizado;
- pagamento e reagendamento usam ações de acompanhamento no detalhe;
- futuro confirmado usa `Ver detalhes` como ação secundária;
- estados comuns usam dot + texto;
- pills/surface semântica ficam reservadas a atenção, entrada ou cancelamento.

### Figma

- **Preservar:** intenção humana/editorial, terapeuta reconhecível e relação com
  o tempo.
- **Adaptar:** destaque do próximo encontro e ritmo confortável.
- **Superar:** cardification, métricas na primeira dobra, microtexto e pills.
- **Descartar:** `Entrar na sessão`, promessas emocionais não sustentadas e
  decoração sem função.

### Humanity and generic-product gates

A página orienta uma pessoa em continuidade terapêutica sem inventar conteúdo
clínico. Removendo logo e roxo, a hierarquia temporal e relacional ainda a
diferencia de um catálogo de reservas. Primitives neutras permanecem
deliberadamente discretas.

`GATE B APPROVED`

## Agent C — Design System Guardian

### Reuse decisions

| Elemento                     | Classificação                  | Decisão                                      |
| ---------------------------- | ------------------------------ | -------------------------------------------- |
| `AppPageContainer`           | `existing/shared`              | reutilizado como canvas                      |
| `AppPageHeader`              | `existing/pattern`             | wrapper card-heavy não usado; variante local |
| `AppPageSection`             | `existing/pattern`             | não usado nas seções abertas                 |
| `TESButton`                  | `existing/shared primitive`    | reutilizado nas CTAs                         |
| `NextEncounterSpotlight`     | `domain/local candidate`       | permanece em Patient                         |
| `EncounterRow`               | `domain/local`                 | anatomia EntityList balanced                 |
| `EncounterStatusBadge`       | `domain/local`                 | semântica de orientação do paciente          |
| `Upcoming/HistorySection`    | `local/candidate`              | TemporalGroup aberto                         |
| métricas/jornada/banner/rail | `existing local, not rendered` | fora da composição benchmark                 |

### Candidate verdicts

- `Open PageHeader`: variante por densidade; API ainda não promovida.
- `Light PageSection`: princípio confirmado, wrapper global ainda inadequado.
- `EntityList`: anatomia promissora, slots e semântica exigem variantes.
- `StatusCluster`: composição transfere; tradução continua no domínio.
- Hairline: técnica confirmada com `border` existente; novo token rejeitado.
- `FilterBar`, `CommandBar`, `ContextRail`, `MetricStrip` e
  `OperationalStatus`: não se aplicam ao Paciente.

### Token gaps and risks

Nenhum gap global comprovado. `surface-soft`, `brand-lavenderSoft`, cores
semânticas, `border`, spacing e tipografia existentes foram suficientes. Não
foram criados tokens, gradientes ou shadows novos.

Riscos explicitamente removidos antes da implementação final:

- gradient/hex/shadow arbitrário;
- card dentro de card no spotlight;
- ContextRail disfarçado;
- linguagem técnica no front-end;
- menu de ações não condicionado;
- pill para todo estado;
- tópicos inferidos com autoridade terapêutica.

`DESIGN READY — BENCHMARK C`

## Agent D — Implementation

### Functional parity preservada

- autenticação e consulta server-side;
- detalhe canônico por booking;
- `primaryAction` state-aware;
- entrada via detalhe e backend, sem URL direta;
- pagamento vindo de `session_payments`;
- cancelamento e reagendamento no detalhe;
- resumo, avaliação, reembolso e suporte conforme estado;
- histórico e futuros reais;
- fallback demonstrativo somente pela regra de desenvolvimento existente.

### Alterações

- header card-heavy substituído por introdução aberta Balanced;
- métricas, tópicos inferidos e banner removidos do fluxo populado;
- próximo encontro ganhou spotlight único com tokens existentes;
- futuros/histórico viraram listas abertas com dividers;
- menu overflow não state-aware deixou de ser renderizado;
- status neutros usam dot/texto; atenção usa surface discreta;
- `pending_payment` usa `Ver pagamento` e reagendamento usa
  `Acompanhar reagendamento`, ambos apontando ao detalhe existente;
- loading e erro acompanham a nova hierarquia sem esconder falha;
- testes unitários e E2E responsivos foram adicionados.

Nenhum arquivo de banco, API, RLS, Auth, Stripe ou Zoom foi alterado.

## Agent E — Visual QA / Critic

### Visual Quality Score

| Dimensão                   | Nota | Peso convertido |
| -------------------------- | ---: | --------------: |
| Hierarquia de informação   |  4,5 |         18,0/20 |
| Composição e ritmo         |  4,4 |         13,2/15 |
| Clareza operacional        |  4,3 |         12,9/15 |
| Consistência TES           |  4,4 |         13,2/15 |
| Sofisticação visual        |  4,2 |          8,4/10 |
| Responsividade             |  4,4 |          8,8/10 |
| Acessibilidade             |  4,2 |          8,4/10 |
| Microinterações e feedback |  4,4 |           4,4/5 |

Total: `87,3/100`.

### Adversarial review

- 5-second comprehension: `PASS`.
- Emotional clarity: `PASS`; tempo e ação reduzem incerteza.
- Human vs decorative: `PASS`; não há ornamento gratuito.
- Cardification: `PASS`; uma surface dominante, nenhum card por encontro.
- Generic product: risco residual baixo nas rows neutras; composição e
  tipografia preservam identidade TES.
- Desktop/tablet/mobile: `PASS`; sem overflow e com CTA alcançável.
- Eliminatórios: nenhum.

## Evidências

- `docs/design-refactor/evidence/benchmark-c/patient-encounters-desktop.png`
- `docs/design-refactor/evidence/benchmark-c/patient-encounters-tablet.png`
- `docs/design-refactor/evidence/benchmark-c/patient-encounters-mobile.png`
- `docs/design-refactor/evidence/benchmark-c/patient-encounters-empty-mobile.png`

As capturas de desenvolvimento contêm o botão circular externo do Next Devtools;
ele não pertence ao produto e deve ser excluído de futuros diffs de produção.

## Estados validados

- populated/confirmed: navegador real nos três viewports;
- empty com histórico: fixture real no mobile;
- live, pending payment e pending reschedule: mapper + renderização de componente
  com CTA correspondente;
- completed e cancelled: mapper/row e ações existentes;
- loading e honest error: código, lint, typecheck e build;
- privacidade Zoom: E2E sem `meeting_url` e sem URL bruta.

Não foi fabricada falha de infraestrutura apenas para obter screenshot.

## Regressão e comandos

- `npm run typecheck`: passou.
- `npm run lint`: passou, incluindo visual policy e online-only policy.
- `npm run build`: passou.
- Vitest de Encontros + políticas de ação + OnlineSessionCard: `16/16` passou.
- Vitest adicional de mapper/page state-aware: `10/10` passou.
- E2E Benchmark C responsivo: `3/3` passou em Chromium visível.
- E2E de privacidade de meeting URL: `3/3` passou.
- E2E de gestão: `0/2`; as fixtures padrão estavam temporalmente vencidas. Uma
  segunda execução com booking futuro existente também foi corretamente
  bloqueada porque ele não possui pagamento canônico confirmado em
  `session_payments`. O happy path por clique deve ser reexecutado após refresh
  documentado de uma fixture simultaneamente futura e paga. Nenhuma regra foi
  relaxada ou dado alterado para mascarar a falha.

## Comparação A × B × C

| Candidate         | Agenda                          | Admin                      | Paciente                        | Veredito                         |
| ----------------- | ------------------------------- | -------------------------- | ------------------------------- | -------------------------------- |
| Open PageHeader   | editorial operational           | compacto operational       | editorial balanced              | `Needs variants`                 |
| Light PageSection | calendário/rail menos elevados  | uma surface comparável     | grupos abertos + accent surface | `Promote candidate`              |
| FilterBar         | agenda + disclosure mobile      | busca/status/sort          | não aplicável                   | `Needs variants`                 |
| EntityList        | listas contextuais              | transformação table→list   | lista temporal balanced         | `Needs variants`                 |
| Status treatment  | sessão/hold/bloqueio            | exceção administrativa     | orientação e próximo passo      | `Needs variants`                 |
| Hairline          | grid e divisões                 | rows e agrupamento         | listas e spotlight              | `Promote candidate` como técnica |
| CommandBar        | tempo/modo                      | não aplicável              | não aplicável                   | `Domain-specific`                |
| ContextRail       | contexto temporal indispensável | rejeitado                  | rejeitado                       | `Domain-specific`                |
| MetricStrip       | não usado                       | summary autoritativo local | rejeitado                       | `Domain-specific`                |
| Accent surface    | apoio contextual                | exceção localizada         | próximo encontro dominante      | `Requires Calibration decision`  |
| TemporalGroup     | calendário domina               | não aplicável              | futuro/histórico                | `Requires Calibration decision`  |

Nenhum candidate foi promovido em código nesta etapa.

## Candidates para Calibration

- PageHeader por densidade;
- Light PageSection;
- EntityList com slots e variantes;
- apresentação visual de status separada da semântica de domínio;
- hairline como técnica, sem token dedicado;
- AccentSemanticSurface;
- TemporalGroup;
- ContextualCTA state-aware;
- estratégia para wrappers card-heavy.

## Candidates rejeitados

- `MetricStrip` universal;
- token dedicado de hairline;
- FilterBar, CommandBar ou ContextRail no Paciente;
- reutilização literal de `OperationalStatus`;
- tabela para encontros;
- badge para todo estado;
- JourneySection genérica baseada em inferência;
- componente global `UpcomingMeeting` antes de repetição.

## Novos candidates Patient

- `NextEncounter / NextActionSpotlight` — domain/local;
- `PatientStatusGuidance` — domain/local;
- `TemporalGroup` — local pattern candidate;
- `ContextualCTA` — regra candidate;
- `PatientEncounterIdentity` — local.

## Dívida aceita e system gaps

- wrappers globais continuam card-heavy até Calibration;
- avatar/identidade ainda possuem duplicação local;
- não existe catálogo isolado/Storybook operacional;
- feedback/microinteração ainda é o menor score;
- screenshot de erro real não foi produzido;
- fixtures E2E de gestão não oferecem hoje um caso que seja simultaneamente
  futuro e pago na autoridade canônica após envelhecimento do reset;
- existe documento duplicado do Benchmark B (`profissionais`/`professionals`)
  que deve ser consolidado de forma segura na Calibration;
- Next Devtools contamina capturas do servidor de desenvolvimento.

## Benchmark status

Score `87,3/100`, mínimos atendidos, nenhum eliminatório, três viewports
aprovados, domínio preservado e gates de build/lint/typecheck aprovados.

`BENCHMARK C APPROVED`

O benchmark visual/UX está aprovado; o release gate integrado permanece
`PARTIAL` até reexecutar o E2E de gestão com fixture canônica válida. Essa dívida
de fixture não é regressão introduzida pelo benchmark e não autoriza relaxar
política de pagamento, cancelamento ou reagendamento.

## Calibration handoff

O handoff consolidado está em
`docs/design-refactor/calibration-handoff.md`. Calibration e promoção de
candidates não foram executadas.

## Documentação

`Documentação atualizada`
