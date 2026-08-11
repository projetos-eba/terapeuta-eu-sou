# Admin Settings And Release Governance

Use this skill when changing `/admin/configuracoes`, admin release readiness,
admin navigation completion, or settings/governance copy.

## Sources

- `AGENTS.md`
- `docs/architecture/admin-plan.md`
- Figma file `Projeto Terapeuta Eu Sou Atualizado`, admin reference node
  `13425:778`
- Figma administrative patterns node `12857:666`
- Local visual reference:
  `/Users/antoniofelipe/Downloads/ChatGPT Image Aug 10, 2026, 11_25_45 PM (9).png`
- `src/lib/routes.ts`
- `src/features/admin-shell/admin-shell-config.ts`
- `src/features/admin-settings/*`
- `src/app/(admin)/admin/configuracoes/page.tsx`

## Route

- `/admin/configuracoes`

## Purpose

This page is governance, not a secret editor. It summarizes product settings,
operation settings, feature flags, integration readiness and release checks
without mutating production-critical state.

The local raster is a visual direction only. Editable platform name, currency,
notifications, two-factor authentication, branding, integrations and admin
management are not implemented because no safe read/write contracts exist for
them. Do not render controls that imply those mutations are available.

## Never Expose

- Secret values.
- Full Authorization, cookies, JWTs or service-role keys.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`,
  `SUPABASE_JWT_SECRET`, `DATABASE_URL`, Stripe secret keys, webhook secret
  values, Zoom secret values or e-mail provider API keys.
- Bank data, document data or clinical content.

Environment variable names and implementation sources must not be rendered in
the admin UI. They belong in logs, tests and documentation. Values must never
be rendered.

## Guardrails

- Critical changes go through code review, deploy and environment/secret
  management, not direct browser editing.
- Catalog and Match mutations continue through `admin-therapy-catalog-command`.
- Financial mutations remain read-only until there is RBAC, reason,
  idempotency and audit.
- Demo data flags must not be counted as live/homologation success.
- Supabase Data API/RLS/grant failures must be reported as unavailable or
  configuration missing, not as empty success.

## QA

- `npm run test -- admin-settings.queries admin-shell-config`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Browser: navigate `/admin/configuracoes`, verify the settings groups,
  release checklist, anchor navigation, responsive grid and absence of secret
  values, source paths or development terminology.
- Validate at desktop and mobile widths with Playwright MCP and confirm no
  horizontal overflow.
