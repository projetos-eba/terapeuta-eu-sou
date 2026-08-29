# Admin Platform Health

Use esta skill ao alterar `/admin/integracoes`, `/admin/seguranca`, health de
provedores externos, findings de segurança, auditoria administrativa inicial ou
o registry de módulos do shell admin.

## Fontes obrigatórias

- `AGENTS.md`
- `docs/architecture/admin-plan.md`
- `docs/product/routes-map.md`
- `docs/product/page-inventory.md`
- `docs/product/integration-map.md`
- `docs/design-system/design-system.md`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-platform/*`
- `src/features/admin-dashboard/*`
- `supabase/config.toml`
- `supabase/migrations/*payments*`
- `supabase/migrations/*zoom*`
- `supabase/migrations/*email*`
- `supabase/migrations/*admin*`

## Rotas

- `/admin/integracoes`
- `/admin/seguranca`

## Componentes e dados

- Páginas:
  - `src/app/(admin)/admin/integracoes/page.tsx`
  - `src/app/(admin)/admin/seguranca/page.tsx`
- UI:
  - `AdminIntegrationsPage`
  - `AdminSecurityPage`
- Consultas:
  - `getAdminIntegrationsPage`
  - `getAdminSecurityPage`
- Mapeadores:
  - `buildIntegrationHealth`
  - `resolveSignalStatus`
  - `getAdminAuditEventLabel`

`/admin/integracoes` usa RPC Supabase autenticado com token admin via
`admin_get_integration_health_v1()`, sem `service_role` no Next. `/admin/seguranca`
mostra exclusivamente a auditoria recente, lendo `admin_audit_events`
sanitizado e normalizando ações, entidades e ator pelo catálogo local em
português.
Leituras bloqueadas por RLS/grants aparecem como `Indisponível`. Erro ou
bloqueio nunca deve ser transformado em zero.

## Regras

- Nunca expor API keys, webhook secrets, service role, tokens, cookies,
  Authorization completo, payload sensível ou dados bancários completos.
- Health de Stripe, Zoom, Connect e E-mail deve ser diagnóstico, não painel de
  segredos.
- Health de integrações não deve consultar tabelas canonicas horizontalmente no
  shell; usar read model admin dedicado e DTO minimo.
- Webhooks continuam autoridade externa e devem depender de assinatura,
  idempotência e proteção contra replay.
- Findings de Supabase Advisor que não são consultáveis em runtime devem
  aparecer como revisão manual, não como dado verificado em tempo real.
- `/admin/seguranca` não substitui auditoria persistente; é uma fundação
  operacional até existir contrato append-only dedicado.
- Módulo só entra como `enabled` em `adminModuleRegistry` depois que a rota
  existe, tem proteção de sessão e possui estado de erro/vazio honesto.

## QA

- `npm run typecheck`
- `npm run lint`
- `npm run test -- admin-platform.mappers admin-shell-config`
- `npm run build`
- Playwright:
  - acessar `/admin/integracoes` sem sessão e confirmar redirect para
    `/admin-login`;
  - autenticar admin local quando houver seed;
  - acessar `/admin/integracoes` e confirmar Stripe, Connect, Zoom, E-mail e
    sinais operacionais;
  - acessar `/admin/seguranca` e confirmar a auditoria recente, sem expor
    identificadores técnicos de ação ou entidade;
  - confirmar que leitura indisponível aparece como `Indisponível`.

## Copy responsável

Use linguagem operacional e clara. Não declarar integração como saudável quando
dados críticos estiverem inacessíveis. Não prometer segurança total sem
evidência de advisors, logs, testes e validação cross-shell.

## Pendências conhecidas

- Segurança ainda pode ganhar read model dedicado se evoluir para filtros,
  detalhes e ações; hoje consome `admin_audit_events` sanitizado.
- Revalidar Supabase Advisor em HML/remoto; a Fase 2 validou localmente.
- Inspecionar o node Figma admin quando o conector estiver disponível.
