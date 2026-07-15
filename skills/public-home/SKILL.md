---
name: public-home
description: >
  Use when implementing, refactoring, auditing, or documenting the public home
  page `/` of Terapeuta Eu Sou. Covers the Figma node `13273:1844`,
  canonical routes, public Supabase views, fallback content, TES public
  components, responsible copy, and QA expectations for this page.
---

# Public Home

## Use This Skill When

- The task touches `src/app/page.tsx`.
- The task changes home copy, sections, CTAs, visual structure, public assets, or dynamic data.
- The task changes the public Supabase views used by the home.
- The task updates documentation for the public home route `/`.

## Sources

Read in this order, only as needed for the task:

1. `AGENTS.md`
2. Figma `Projeto Terapeuta Eu Sou Atualizado`, node `13273:1844` (`Page / Público / Home`)
3. `docs/product/sitemap.md`
4. `docs/product/routes-map.md`
5. `docs/product/page-inventory.md`
6. `docs/design-system/design-system.md`
7. `docs/design-system/tokens.md`
8. `src/lib/routes.ts`
9. `src/app/page.tsx`
10. `src/features/public-home/*`
11. `supabase/migrations/*public_home_views*.sql`

## Route Contract

- Route: `/`
- Canonical source for links: `src/lib/routes.ts`
- Primary public CTAs:
  - `routes.public.howItWorks`
  - `routes.public.therapies`
  - `routes.public.journey`
  - `routes.public.therapists`
  - `routes.public.forTherapists`
  - `routes.public.therapistPlans`
- Do not create placeholder pages only to satisfy home links unless the user explicitly asks.

## Data Contract

The home may read public content through REST Supabase using only public env vars:

- `public_home_therapies`
- `public_home_therapists`
- `public_home_testimonials`

Rules:

- Never expose operational therapist fields, private patient data, payment data, intake data, Zoom links, or secrets.
- Keep local fallback content in `src/features/public-home/content.ts` so `/` renders when Supabase is unconfigured or unavailable.
- Do not add `@supabase/supabase-js` unless the user explicitly approves a dependency change.
- If a public view changes, update docs and this skill in the same task.

## UI Contract

The page should preserve these sections from Figma `13273:1844`:

- Public header
- Hero with human image
- `O que é o TES?`
- `Como funciona`
- Therapy marquee
- Motivations / online session section
- Therapies preview
- Featured therapists
- Testimonials
- Journey CTA
- FAQ
- Public footer

Use existing TES components before creating new equivalents:

- `PublicHeader`
- `PublicFooter`
- `TESButton`
- `TESCard`
- `TESBadge`

Use TES tokens through Tailwind classes and CSS variables. Do not change global tokens for a page-only issue.

## Copy Rules

- Keep language calm, human, premium, and responsible.
- Never promise cure, diagnosis, guaranteed transformation, guaranteed booking, or financial result.
- Therapy descriptions must be informational and should not replace medical, psychological, diagnostic, or professional care.
- If using testimonials, only use published, non-sensitive, non-identifying content.

## QA Checklist

- Compare the page visually with Figma node `13273:1844` on desktop and mobile.
- Check that all CTAs use `routes.public`.
- Check fallback rendering with placeholder or missing Supabase env.
- Check Supabase rendering when local Supabase is available.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- For migration changes, run `npx supabase db lint`; run `npx supabase db reset` only when local data reset is acceptable for the task.
- Report commands actually run and any validation not performed.
