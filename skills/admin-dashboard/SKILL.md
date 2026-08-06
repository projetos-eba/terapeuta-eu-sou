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

## Componentes e dados

- Página: `src/app/(admin)/admin/page.tsx`
- UI: `src/features/admin-dashboard/components/admin-dashboard-page.tsx`
- Consulta: `src/features/admin-dashboard/admin-dashboard.queries.ts`
- Dados: REST Supabase autenticado com token admin e
  `admin-therapy-catalog-command`.

## Regras

- Não usar `service_role` no Next.
- Não expor PII em métricas de visão geral.
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

- `/admin/profissionais`, `/admin/sessoes`, `/admin/pagamentos`,
  `/admin/integracoes`, `/admin/seguranca` e demais módulos dedicados ainda
  precisam de confirmação para criação de rotas/páginas.
- O dashboard usa contagens agregadas; ações críticas continuam pendentes de
  contratos com permissão, motivo, confirmação, `requestId`, versão esperada e
  auditoria.
