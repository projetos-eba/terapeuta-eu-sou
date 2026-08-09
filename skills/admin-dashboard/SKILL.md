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

## Regras

- Não usar `service_role` no Next.
- Não expor PII em métricas de visão geral.
- Não consultar tabelas canonicas horizontalmente do shell para montar
  contagens do Dashboard; usar read model admin dedicado.
- Cada fonte agregada deve degradar de forma explícita quando falhar.
- Links do shell e do dashboard só devem apontar para rotas com página real.
- Módulos sem página dedicada aparecem como pendentes, sem link clicável.
- Pagamentos, assinaturas, refunds, disputes e repasses permanecem separados.
- Alertas de integrações não podem expor secrets ou payload sensível.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npx supabase db lint`
- `npx supabase test db`
- Playwright em `/admin-login` e `/admin` quando houver sessão admin local.

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
