---
name: public-about
description: >
  Use when implementing, refactoring, auditing, or documenting the public
  `/sobre-nos` institutional page of Terapeuta Eu Sou.
---

# Public About

## Use This Skill When

- The task touches `src/app/sobre-nos/page.tsx`.
- The task changes institutional copy, CTAs, route links, metadata, or footer/header behavior for `/sobre-nos`.
- The task updates documentation for the replacement of the legacy `/como-funciona` route.

## Sources

Read in this order, only as needed:

1. `AGENTS.md`
2. `docs/product/sitemap.md`
3. `docs/product/routes-map.md`
4. `docs/product/page-inventory.md`
5. `docs/design-system/design-system.md`
6. `src/lib/routes.ts`
7. `src/app/sobre-nos/page.tsx`

## Route Contract

- Canonical route: `/sobre-nos`.
- Legacy redirect: `/como-funciona` -> `/sobre-nos`.
- Links must use `routes.public.about`.
- Do not recreate `/como-funciona` as a separate public page.

## Copy Contract

- Explain the TES as an online platform connecting people and therapists.
- Preserve responsible language: no cure promises, diagnosis claims, guaranteed results, or clinical certainty.
- Keep patient and therapist paths distinct with CTAs to `routes.public.journey` and `routes.public.forTherapists`.

## UI Contract

- Use the public header and footer.
- Use TES tokens for text, surfaces, borders, focus states and CTAs.
- Keep content readable on mobile and desktop without dense legal copy.

## QA

- Validate `/sobre-nos` renders with public header and footer.
- Validate `/como-funciona` redirects to `/sobre-nos`.
- Validate CTAs by real click when Playwright/browser is available.
- Validate there are no links to `/entrar`, `/cadastro` or `/para-terapeutas/planos`.
