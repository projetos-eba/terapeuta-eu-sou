---
name: therapist-settings
description: Use when working on the therapist shell settings page, authenticated account settings API, or configuration UI under /terapeuta/configuracoes.
---

# Therapist Settings

## Required Sources

Read `AGENTS.md`, `docs/product/sitemap.md`,
`docs/design-system/design-system.md`, `docs/product/routes-map.md`,
`docs/product/page-inventory.md`, `src/lib/routes.ts` and
`src/lib/auth/therapist-session.ts` before editing this area.

## Figma

- Main reference: `Projeto Terapeuta Eu Sou Atualizado`.
- Node: `13366:6118`.
- The current implementation follows the shared TES shell density, cards,
  typography and purple/lavender tokens. If direct Figma MCP access is not
  available, record the limitation and keep changes aligned to the existing
  `AppPage*` contract.

## Route

Canonical route: `/terapeuta/configuracoes`.

Legacy namespaces `/basico/configuracoes`, `/pro/configuracoes` and
`/plus/configuracoes` are compatibility redirects only.

## Components and Data

- Route: `src/app/(therapist)/terapeuta/configuracoes/page.tsx`.
- UI: `src/features/therapist-settings/components/therapist-settings-page.tsx`.
- API: `src/app/api/therapist/settings/route.ts`.
- Shared feature files: `src/features/therapist-settings/`.
- Source of account settings: `profiles`.
- Source of public profile state: `therapist_profiles`.

Do not use service role in the Next.js app. The route must use the therapist
access token and Supabase RLS.

## Rules

- Editable fields in this page are internal account data only:
  `display_name` and `phone`.
- E-mail is read-only here.
- Public profile content belongs to `/terapeuta/perfil/editar`.
- Availability belongs to `/terapeuta/agenda`.
- Plan and subscription state belong to `/terapeuta/plano`.
- Stripe Connect data belongs to `/terapeuta/financeiro?tab=conta`.
- Password changes use the public reset password flow.
- Never log cookies, Authorization headers, Supabase keys or personal secrets.
- Validation errors must be specific enough for the therapist to correct the
  form, but must not expose internal database details.

## Database

Therapists may update only account-facing columns in `profiles`.

Required grant/policy:

- `update (display_name, phone)` for `authenticated`.
- RLS update policy requiring `auth.uid() = id` and `role = 'therapist'`.

Any broader profile update requires a new security review.

## QA

- Parser rejects invalid names and phone values.
- Mapper accepts Supabase embeds as object or array.
- API rejects unauthenticated and non-therapist users.
- API PATCH sends only `display_name` and `phone`.
- UI disables the main save action until there are changes.
- UI shows success, local validation error and safe remote error states.
- Links point to the canonical shell routes.
- Run `npm run typecheck`, `npm run lint`, `npm run test` and
  `npm run build` for full delivery when the environment permits.

## Known Limitations

- Notification preferences are linked to the messages/support area until a
  dedicated notification-preferences contract exists.
- Public visibility toggles are intentionally read-only here to avoid
  duplicating publication rules from the profile editor.
