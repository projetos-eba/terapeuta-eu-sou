# Wave 2 — Contratos Premium Plus / TES

Data: 2026-08-22

## Resultado

Wave 2 foi concluída localmente, sem deploy remoto em HML ou produção. O foco
foi fechar os contratos já decididos para temas da nova prática, períodos de
métricas e auditoria do financeiro do terapeuta, sem iniciar os rebuilds
visuais maiores reservados para uma wave posterior.

## Decisões aplicadas

- A solicitação de nova prática usa os temas ativos do Match como taxonomia
  canônica. O terapeuta seleciona de 1 a 3 temas; interesses continuam
  derivados do tema e não são escolhidos nesta jornada.
- `themeIds` é validado no servidor contra `matching_themes`, com rejeição de
  duplicados, temas desconhecidos/inativos, valores malformados, arrays acima
  de três itens e payloads que não sejam arrays.
- `suggested_category_id` e o campo legado `suggestedCategoryId` permanecem
  somente para leitura e compatibilidade de solicitações históricas. O fluxo
  novo persiste também `themeNames` para inspeção administrativa segura.
- Métricas de terapeuta agora oferecem períodos completos de 30, 60, 90 e 120
  dias em overview, sessões, interesse, occupancy, dashboard e exportação. A
  fundação histórica continua com o período fixo de 30 dias quando esse é o
  contrato específico do read model.
- O financeiro continua usando `session_payments` como fonte de pagamentos de
  sessão, `financial_ledger_entries` como ledger e as tabelas de lotes,
  itens e transferências para repasses. A confirmação permanece dependente do
  webhook assinado do Stripe; redirects não são autoridade financeira.

## Implementação

### Temas da nova prática

- `supabase/migrations/20260822153000_wave2_match_themes_and_metrics_periods.sql`
  é a única migration nova desta wave. Ela atualiza as RPCs versionadas de
  submissão/reenvio, normaliza temas e preserva o caminho legado de categoria
  quando não há `themeIds`.
- `therapy-catalog-request-command` lista temas ativos e encaminha apenas o
  payload autorizado para as RPCs. A tela de solicitação mostra os temas do
  Match, contador de seleção e o limite de três.
- A inspeção administrativa passa a exibir os nomes dos temas enviados sem
  misturar a taxonomia histórica com a nova fonte de verdade.

### Métricas

- O seletor, a leitura da rota canônica `/terapeuta/insights`, exportação,
  queries, tipos, mappers, dashboard e agrupamento da evolução foram alinhados
  para 30/60/90/120.
- A migration reemite as cinco funções existentes preservando seus corpos e
  ampliando somente a validação de período; não houve alteração destrutiva de
  tabela, evento ou projeção.

### Financeiro

- A auditoria confirmou a cadeia server-authoritative Stripe →
  `session_payments` → ledger/repasse, Connect v2 e RPCs privadas derivadas da
  sessão autenticada.
- Corrigido o card “Próximo lote” em Repasses: ele passa a mostrar a data/hora
  de `nextBatchAt` no fuso configurado, com “Sem lote” quando não existe lote,
  em vez de repetir um valor monetário.

## Testes e validação

- `npm run typecheck` — PASS.
- `npm run lint` — PASS; políticas visual e online-only sem violações.
- `npm run test` — PASS: 150 arquivos, 587 testes.
- `npm run test:deno` — PASS: 161 testes.
- `npx supabase db reset` — PASS local; toda a sequência de migrations,
  incluindo `20260822153000`, foi aplicada.
- `npx supabase test db` — PASS: 73 arquivos, 1.587 testes.
- `npx supabase db lint` — PASS com warnings preexistentes de imutabilidade,
  parâmetros não utilizados e funções administrativas já existentes; nenhum
  erro novo da Wave 2.
- `npm run build` — PASS; rotas de métricas e solicitação compiladas.
- Prettier focal — PASS nos arquivos de métricas, catálogo, financeiro,
  functions e documentação tocados nesta wave.
- `git diff --check` — PASS.

## Segurança e compatibilidade

- O ator da solicitação continua derivado da sessão autenticada na Edge
  Function; não há confiança em identidade enviada pelo navegador.
- Apenas temas ativos e allowlisted são persistidos; o payload de temas não
  pode causar cast ou erro SQL não controlado.
- Solicitações antigas com `suggested_category_id` continuam legíveis e
  reprocessáveis pelo caminho de compatibilidade. Nenhum backfill destrutivo
  foi feito.
- Nenhuma mudança foi feita em Stripe, Zoom, mensagens estruturadas,
  suporte, RLS de participantes ou secrets de frontend.

## Pendências reais

1. Não houve smoke ou migration remota em HML nesta wave. A promoção deve ser
   coordenada com a aplicação e a migration versionada, após revisão explícita
   e janela de QA.
2. Dados jurídicos oficiais da empresa continuam pendentes por falta de fonte
   aprovada; não foram inventados.
3. Rebuilds visuais maiores de Métricas e Assessora Aura continuam para uma
   wave específica de Figma/QA visual. Ajustes pequenos usam os componentes e
   tokens já existentes.
4. `npm run format:check` global continua com dívida histórica fora do escopo;
   a formatação focal desta wave passou.

## Impacto documental

Documentação atualizada: ADR e estratégia de métricas, skills de métricas e
solicitação de catálogo, além deste relatório. A documentação da Wave 1 segue
histórica; os itens que eram pendências de métricas e taxonomia foram fechados
nesta Wave 2.
