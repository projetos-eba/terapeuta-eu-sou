# Handoff — Benchmark C / Paciente / Encontros

Status: consumido pelo Benchmark C; Calibration pendente  
Rota: `/app/encontros`  
Data: 2026-08-14

Este handoff reuniu evidências dos Benchmarks A e B para iniciar o Agent A do
Benchmark C. Agenda e Admin não são templates. O Benchmark C foi concluído em
2026-08-14; seu registro final está em
`docs/design-refactor/benchmark-c-patient-encounters.md` e o próximo handoff em
`docs/design-refactor/calibration-handoff.md`. Este documento permanece como
registro da hipótese de entrada.

## Evidência consolidada

### Benchmark A — Agenda

- score `86,7/100`;
- composição aberta, prioridade temporal, CommandBar, FilterBar responsivo e
  ContextRail ajudaram a tarefa espacial;
- timeline, cores semânticas de terapia, ContextRail e CommandBar são fortemente
  dependentes do domínio;
- controles e contexto secundário precisam de progressive disclosure real no
  mobile.

### Benchmark B — Admin / Profissionais

- score `86,5/100`;
- operação por exceção, uma única surface funcional, MetricStrip discreto,
  OperationalTable desktop e EntityList responsiva sustentaram alta densidade;
- filtros foram importantes, mas não dominaram a primeira dobra;
- tabela e inputs puderam permanecer neutros porque identidade TES emergiu da
  composição, voz, hierarquia e comportamento;
- nenhuma regra de domínio, read model, rota ou token global precisou mudar.

## Candidates a testar, não copiar

| Candidate               | Estado após A+B     | Pergunta para Encontros                                                  |
| ----------------------- | ------------------- | ------------------------------------------------------------------------ |
| Open PageHeader         | `Needs variant`     | qual escala e voz orientam sem tornar a experiência promocional?         |
| Light PageSection       | `Promising`         | spacing e dividers bastam ou encontros exigem surface por estado/ação?   |
| FilterBar               | `Needs variant`     | filtros são necessários ou tabs/segmentos representam melhor a jornada?  |
| Hairline token          | `Await Benchmark C` | a densidade Balanced precisa de hairline dedicada ou só de spacing?      |
| MetricStrip             | `Await Benchmark C` | algum número muda uma decisão do paciente? Se não, rejeitar.             |
| ResponsiveEntityList    | `Await Benchmark C` | uma lista pode equilibrar contexto emocional e operação sem virar cards? |
| StatusCluster           | `Await Benchmark C` | como comunicar elegibilidade, pagamento e tempo com calma e precisão?    |
| CommandBar              | `Domain-specific`   | não transferir sem comando temporal/modo equivalente.                    |
| ContextRail             | `Domain-specific`   | não criar rail se não houver contexto complementar indispensável.        |
| Semantic therapy colors | `Domain-specific`   | usar somente se terapia realmente orientar reconhecimento do encontro.   |
| OperationalTable        | `Admin candidate`   | não transferir para a experiência paciente Balanced.                     |

## Hipóteses do Benchmark C

1. A tarefa dominante deve orientar o próximo encontro elegível e explicar com
   segurança o que acontece antes, durante e depois, sem transformar a página
   em dashboard.
2. Próximos encontros e histórico provavelmente exigem hierarquias diferentes,
   não apenas tabs visualmente equivalentes.
3. Status deve combinar texto canônico, tempo e ação; badges não devem carregar
   toda a semântica.
4. O mobile é o contexto primário provável: a próxima ação precisa aparecer na
   primeira dobra sem esconder elegibilidade, pagamento ou indisponibilidade.
5. Empty, loading, erro, encontro futuro, encontro iniciado, cancelado e
   histórico precisam continuar honestos e distintos.
6. Humanidade deve vir de voz, pacing, prioridade e supporting copy; ilustração,
   gradiente e card não substituem orientação.

## Perguntas para Agents A–C

- Qual é a tarefa primária real: entender o próximo encontro, entrar nele,
  resolver uma pendência ou navegar o histórico?
- Quais estados de booking, pagamento e Zoom mudam a ação disponível?
- Quais informações são sempre visíveis e quais pertencem ao detalhe?
- A separação próximos/histórico é SegmentedNavigation, filtro, seção ou rota?
- O que distingue uma experiência TES humana de um portal de telemedicina?
- Qual informação operacional pode ser removida da primeira dobra sem criar
  ansiedade ou ambiguidade?
- O `ResponsiveEntityList` do Admin transfere como anatomia ou precisa de uma
  variante narrativa específica?

## Comparações obrigatórias

- paciente humano sem infantilização versus Admin preciso sem frieza;
- próximo encontro versus status de exceção do Admin;
- ação de entrar no encontro versus ação de inspeção administrativa;
- densidade Balanced versus Operational;
- surface por entidade versus lista contínua;
- contexto temporal da Agenda versus orientação temporal do paciente;
- linguagem TES transversal versus soluções próprias de cada domínio.

## Guardrails

- usar `Encontro` na interface do paciente e preservar `session`/`booking` no
  código e banco;
- preservar elegibilidade, pagamento, Zoom, host-first e rotas canônicas;
- não inventar terapeuta, sessão, link, status, conteúdo clínico ou sucesso;
- falha não vira empty e dados demonstrativos exigem ativação explícita;
- não promover candidates nem iniciar rollout antes da Calibration;
- executar Agents A, B e C e declarar `DESIGN READY — BENCHMARK C` antes de
  alterar React.

## Próximo passo autorizado

Iniciar somente o Agent A de `/app/encontros`, ler a skill de domínio aplicável,
mapear read models/estados reais e produzir a UX Specification. Este handoff não
autoriza implementação nem rollout.
