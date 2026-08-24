# Admin Dashboard

Use esta skill ao alterar `/admin`, a visão geral administrativa, a navegação do
shell admin ou métricas agregadas usadas para priorização operacional.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/architecture/fasel-final.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-dashboard/*`
- `supabase/migrations/*admin*`
- `supabase/migrations/*payments*`
- `supabase/migrations/*zoom*`

## Rota

- `/admin`
- `/admin/integracoes`
- `/admin/seguranca`

## Componentes e dados

- Página: `src/app/(admin)/admin/page.tsx`
- UI: `src/features/admin-dashboard/components/admin-dashboard-page.tsx`
- Consulta: `src/features/admin-dashboard/admin-dashboard.queries.ts`
- Plataforma admin: `src/features/admin-platform/*`
- Dados: RPC Supabase autenticado com token admin via
  `admin_get_dashboard_v1()`. Mutacoes do catalogo continuam em comandos
  especificos como `admin-therapy-catalog-command`.
- Referência visual principal: Figma `Page / Admin Plataforma / Visão geral —
editável` (`13425:778`).
- A tela atual usa apenas contagens agregadas disponíveis. Não exibir receita,
  retenção ou séries temporais do Figma enquanto o contrato não trouxer esses
  dados diretamente.
- Os gráficos da Visão Geral devem buscar fidelidade visual ao Figma usando
  somente agregados reais disponíveis: linha/área para comparação de indicadores
  atuais, donut por área administrativa e funil operacional derivado das
  contagens renderizadas. Não simular histórico, receita, retenção ou
  distribuição por plano sem payload dedicado.
- Gráficos devem oferecer tooltip no elemento gráfico interativo em si
  (pontos, fatias, barras ou camadas), não em textos auxiliares. O tooltip deve
  explicar valor, percentual ou contexto em linguagem de produto. Não depender
  apenas do atributo nativo `title`; usar tooltip visual legível em hover e foco
  quando o gráfico for customizado. Na evolução, cada ponto deve exibir o
  indicador, seu valor atual e uma descrição curta do contexto.

## Regras

- Não usar `service_role` no Next.
- Não expor PII em métricas de visão geral.
- Não consultar tabelas canonicas horizontalmente do shell para montar
  contagens do Dashboard; usar read model admin dedicado.
- Cada fonte agregada deve degradar de forma explícita quando falhar.
- Links do shell e do dashboard só devem apontar para rotas com página real.
- Módulos sem página dedicada aparecem como pendentes, sem link clicável.
- CTAs de cards analíticos só podem existir quando houver fluxo claro e destino
  habilitado. Se o destino for genérico, oculto ou ainda não representar o
  conteúdo do card, usar rodapé informativo sem link.
- Pagamentos, assinaturas, refunds, disputes e repasses permanecem separados.
- Alertas de integrações não podem expor secrets ou payload sensível.
- A UI não deve exibir termos de desenvolvimento. Detalhes técnicos ficam em
  logs, testes e documentação; o front usa linguagem de produto.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npx supabase db lint`
- `npx supabase test db`
- Playwright MCP em `/admin-login` e `/admin` quando houver sessão admin local,
  com screenshots desktop/mobile e checagem de overflow, cortes visuais e
  mensagens de desenvolvimento no front-end.

## Pendências conhecidas

- `/admin/integracoes` e `/admin/relatorios` permanecem ocultos no menu até
  homologação específica, embora as rotas protegidas existam.
- O dashboard usa contagens agregadas via `admin_get_dashboard_v1()`.
- Listas operacionais e financeiras usam RPCs v2 paginadas; a implementação
  interna ainda usa uma janela sanitizada limitada e pode ser substituída por
  SQL indexado por módulo sem alterar o contrato público.
- Ações financeiras, reconciliações Stripe/Zoom e exports reais continuam
  pendentes de comandos dedicados com permissão, motivo, `requestId`,
  idempotência e auditoria.
