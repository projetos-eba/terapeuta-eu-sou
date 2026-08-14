# Plano de páginas benchmark

Status: Benchmarks A, B e C aprovados; Calibration pendente  
Versão: 2026-08-14

Os benchmarks validam o sistema em três problemas diferentes antes de qualquer
rollout amplo.

## Benchmark A — Terapeuta / Agenda

Status: `BENCHMARK A APPROVED` em 2026-08-14. Evidências, score e handoff estão
em `docs/design-refactor/benchmark-a-agenda.md` e
`docs/design-refactor/benchmark-b-handoff.md`.

- **Rota:** `/terapeuta/agenda`.
- **Densidade:** Operational na agenda; Balanced no ContextRail.
- **Patterns:** PageHeader, SegmentedNavigation, CommandBar, FilterBar, Timeline,
  ContextRail, InsightPanel e StatusCluster.
- **Por que:** é a primeira experiência de redesign e contém spatial complexity,
  range temporal dinâmico, filtros, três visões, right rail e transformação mobile.
- **Hipótese:** reduzir limites visuais e organizar comandos pode melhorar
  escaneabilidade sem reduzir throughput nem fidelidade temporal.
- **Guardrails:** preservar RPCs, bookings, holds, blocks, schedule, timezone,
  madrugada, copy e `TESDialog`.

## Benchmark B — Admin / Profissionais

Status: `BENCHMARK B APPROVED` em 2026-08-14, com score `86,5/100`.
Decisões, evidências e comparação de candidates estão em
`docs/design-refactor/benchmark-b-admin-professionals.md`; o handoff do próximo
benchmark está em `docs/design-refactor/benchmark-c-handoff.md`.

- **Rota:** `/admin/profissionais` e detalhe apenas quando necessário ao fluxo.
- **Densidade:** Operational.
- **Patterns:** PageHeader compacto, MetricStrip, FilterBar, OperationalTable,
  EntitySummary, DetailPanel e StatusCluster.
- **Por que:** reúne alta densidade, filtros, tabela larga, status, verificação e
  ações administrativas. É o melhor teste para evitar ERP genérico.
- **Hipótese:** comparação e prioridade podem depender mais de alinhamento,
  tabela e command bar do que de KPI cards e surfaces repetidas.
- **Guardrails:** preservar permissões, auditoria, estados e read models.

## Benchmark C — Paciente / Encontros

Status: `BENCHMARK C APPROVED` em 2026-08-14, com score `87,3/100`.
Decisões, evidências e comparação final estão em
`docs/design-refactor/benchmark-c-patient-encounters.md`; o handoff consolidado
está em `docs/design-refactor/calibration-handoff.md`.

- **Rota:** `/app/encontros`.
- **Densidade:** Balanced.
- **Patterns:** PageHeader humano, EntityList, EntitySummary, StatusCluster,
  EmptyState e ActionCluster.
- **Por que:** testa humanização em uma experiência autenticada e transacional,
  com próximos encontros, histórico, estados e entrada no encontro.
- **Hipótese:** orientação e voz TES podem substituir parte dos KPI cards sem
  infantilizar nem esconder informação operacional.
- **Guardrails:** preservar elegibilidade, estados de booking/pagamento, Zoom,
  nomenclatura “Encontro” e ausência de promessas.

## Por que não Match no primeiro trio

Match é um excelente benchmark Comfortable, mas Encontros cobre melhor a lacuna
de identidade do produto Paciente dentro do shell autenticado e permite comparar
o mesmo sistema com Terapeuta/Admin. Match entra na primeira onda pós-calibração.

## Evidência e ordem

1. Agenda, aproveitando o aprendizado existente.
2. Admin / Profissionais, para estressar densidade e components.
3. Paciente / Encontros, para calibrar humanidade e clareza.

Cada benchmark exige intent, mapa de patterns, screenshots dos três viewports,
states mínimos, Visual Quality Score e handoff de dívida.

## Calibration obrigatória

Depois dos três, suspender rollout e responder:

- os três produtos parecem pertencer ao TES?
- Paciente ficou humano sem infantilização?
- Admin ficou denso sem virar ERP genérico?
- Terapeuta ficou profissional sem parecer health SaaS?
- tokens foram suficientes?
- quais patterns funcionaram e quais APIs emergiram?
- quais anti-patterns reapareceram?
- quais componentes devem ser compartilhados?
- quais regras das skills precisam mudar?

Saída: versão calibrada das skills/docs, decisão de components, backlog priorizado
e autorização explícita para a próxima onda. A Calibration não foi iniciada;
sem essa saída, rollout continua reprovado.
