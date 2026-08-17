# Therapist Metrics And Reports

Use esta skill ao alterar Métricas & Relatórios no shell do terapeuta.

## Fontes Obrigatórias

1. `AGENTS.md`.
2. Figma `OSXJi8tknHHCj82MTY2NbG`, nodes `13366:3628`, `13366:4259` e
   `13366:4896`.
3. `docs/architecture/metricas-tes-LEIAME.md`.
4. `docs/architecture/adr/ADR-011-therapist-metrics-contracts-and-decisions.md`.
5. `docs/architecture/therapist-metrics-reports-strategy.md`.
6. `docs/product/routes-map.md`.
7. `docs/product/page-inventory.md`.
8. `docs/product/integration-map.md`.
9. `docs/design-system/design-system.md`.

## Rotas

- Canônica: `/terapeuta/insights`.
- Compatibilidade: `/terapeuta/metricas` redireciona para a rota canônica.
- Não criar uma segunda implementação para abas ou planos.

## Estado Atual

| Corte                            | Status                              |
| -------------------------------- | ----------------------------------- |
| MTR-0 — contratos                | `accepted`                          |
| MTR-0.1 — read model fundamental | `functional`                        |
| MTR-0.2 — aba Visão geral        | `functional`                        |
| MTR-1 — telemetria               | `functional`, ativação bloqueada    |
| MTR-2 — agregados e read model   | `functional`                        |
| MTR-3 — Visão geral completa     | `functional`                        |
| MTR-4 — Sessões                  | `functional`                        |
| MTR-5 — Interesse                | `functional`, Premium Plus          |
| MTR-6 — Aura                     | `planned`                           |
| MTR-7 — Relatórios               | `functional` no corte CSV           |
| MTR-8 — dashboard e ocupação     | `functional`, histórico em formação |

## Autoridade MTR-0.1

- RPC: `get_therapist_metrics_foundation_v1()`.
- Identidade: sempre `auth.uid()`, nunca `therapist_profile_id` do navegador.
- Capability: `advanced_metrics`.
- Planos: Premium e Premium Plus.
- Timezone: `therapist_schedule_settings.timezone`.
- Período: últimos 30 dias locais completos, sem o dia atual.
- Comparação: 30 dias completos imediatamente anteriores.
- Fonte: `bookings.status = completed` e
  `service_duration_minutes_snapshot`.
- Contadores: pessoas distintas atendidas, sessões realizadas e minutos de
  atendimento.

## Autoridades MTR-1 A MTR-3

- Migration: `20260728200000_therapist_metrics_mtr1_mtr2.sql`.
- Eventos: `therapist_metric_events`, sem leitura direta pública/autenticada.
- Agregado: `therapist_metric_daily_aggregates`, com RLS pelo proprietário.
- Ingestão: `record_public_therapist_metric_events_v1`.
- Read model: `get_therapist_metrics_overview_v1`.
- Períodos: 30 ou 90 dias locais completos.
- Telemetria pública: desativada por padrão em
  `therapist_metrics_runtime_config`; ativação exige validação formal externa.
- Eventos de navegador: impressão de busca, abertura do perfil e início do
  agendamento, preservando a superfície real de origem.
- Evento autoritativo: favorito adicionado ao perfil.
- O contrato `v1` preserva ocupação como `unavailable`; o dashboard `v2`
  expõe `forming`, `empty` ou `ready` conforme a cobertura histórica real.

## Autoridade MTR-8

- Migration: `20260817044010_therapist_metrics_dashboard_v2.sql`.
- Read model agregado: `get_therapist_metrics_dashboard_v2`.
- Contratos `v1` continuam disponíveis e sem alteração.
- Histórico append-only: `availability_rule_history` e
  `availability_exception_history`, sem leitura direta por cliente.
- Cobertura: `therapist_availability_history_coverage`; começa na migration ou
  na primeira escrita observada, nunca é reconstruída com a configuração atual.
- Capacidade ofertada: buckets de 15 minutos cobertos por regra histórica ativa,
  menos exceções históricas indisponíveis.
- Capacidade ocupada: buckets ofertados sobrepostos por reservas confirmadas,
  concluídas ou com ausência registrada.
- 30 e 90 dias só saem de `Histórico em formação` após cobertura integral do
  período solicitado.

## Autoridades MTR-4, MTR-5 E MTR-7

- Migration: `20260728210000_therapist_metrics_mtr4_mtr5.sql`.
- Sessões: `get_therapist_session_metrics_v1`.
- Interesse: `get_therapist_interest_metrics_v1`, exclusivo do Premium Plus.
- Exportação: `/api/therapist/metrics/export`, CSV privado e agregado.
- Períodos: 30 ou 90 dias locais completos.
- Presença: completed dividido por completed + no-show; cancelamentos ficam
  fora do denominador.
- Continuidade: segmentos exclusivos e coortes sem IDs de pacientes.
- Amostra: 10 para percentuais, coortes, segmentos e leituras protegidas.
- Motivos de cancelamento, sentimento, lacuna, temas e motivos de saída ficam
  indisponíveis sem contrato estruturado.
- MTR-6/Aura não faz parte destes read models.

## Contrato De Copy

- Número nunca aparece sozinho.
- Toda métrica deve trazer direção e `directionCopyKey`.
- Direções: `up`, `stable`, `down`.
- Copy descreve mudança sem comemoração automática, culpa ou causalidade.
- Comparação usa somente o próprio terapeuta.
- Não expor ranking, benchmark ou demanda agregada do portal.

## Favoritos

- `favorite_therapists` representa favorito do perfil.
- Favorito nunca pertence a serviço, terapia ou técnica.
- DTOs e cards de serviço não expõem `favoriteCount`.
- O KPI de favoritos do perfil exige trava de 10.

## UI

- Reutilizar `AppPageContainer`, `AppPageSection`, `TESCard` e tokens TES.
- Hero usa o asset local
  `/therapist/dashboard/therapist-hero.png`.
- Referências visuais confirmadas no Figma: Visão geral `13366:3628`, Sessões
  `13366:4259` e Interesse `13366:4896`, complementadas pela captura fornecida
  em 17/08/2026.
- A primeira dobra combina hero editorial, abas, período, exportação CSV e
  seis indicadores em grid responsivo. A Visão geral usa cards abertos em duas
  colunas no desktop e uma coluna para gráficos complexos no mobile.
- Recharts é a biblioteca canônica deste dashboard para sparklines, séries,
  barras e roscas. Mapas de calor usam tabela semântica e tokens TES.
- Todo gráfico deriva apenas do DTO autenticado, usa `ResponsiveContainer`,
  tooltip, foco por teclado, nome acessível e resumo textual.
- Em mobile, KPIs usam duas colunas quando o espaço permitir; o exportador
  vira botão de ícone com nome acessível, e tabelas/grades preservam região
  rolável nomeada em vez de reduzir texto funcional.
- A Visão geral inclui série de atividade, descoberta discriminada, ranking
  das próprias terapias, favoritos do perfil e aviso de ocupação.
- O filtro de período usa URL e aceita somente 30/90 dias.
- Texto funcional mínimo de 14px.
- Touch targets mínimos de 44px.
- Zero legítimo, indisponibilidade e capability negada são estados distintos.
- A aba Interesse mostra capability lock para Premium e dados protegidos para
  Premium Plus; nunca preencher com mock.

## Fallback E Segurança

- Produção não usa dados demonstrativos silenciosos.
- Falha de banco não vira zero.
- DTO não contém IDs de pacientes.
- Next.js usa token autenticado publicável e nunca service role.
- Logs e UI não expõem erro bruto do Supabase.
- Eventos não guardam IP, user agent, query string ou texto livre.
- A UI não expõe tendência agregada do portal nem benchmark de terapeutas.

## QA

- `npm run format:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run test`;
- `npm run build`;
- `npx supabase db reset`;
- `npx supabase db lint --schema public`;
- `npx supabase test db`;
- `PLAYWRIGHT_BASE_URL=<url-local> npx playwright test
tests/e2e/therapist-metrics.spec.ts --project=chromium`.

Para mudanças visuais, validar 320px, 375px, 768px, 1024px e 1440px, teclado e
zoom de 200%.
