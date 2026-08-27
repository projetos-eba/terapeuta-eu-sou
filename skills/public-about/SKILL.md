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
5. `docs/design-system/experience-principles.md`
6. `docs/design-system/density.md`
7. `docs/design-system/anti-patterns.md`
8. `docs/design-refactor/calibration-contract.md`
9. `docs/design-system/design-system.md`
10. `docs/design-system/tokens.md`
11. `src/lib/routes.ts`
12. `src/app/sobre-nos/page.tsx`

## Route Contract

- Canonical route: `/sobre-nos`.
- Legacy redirect: `/como-funciona` -> `/sobre-nos`.
- Links must use `routes.public.about`.
- Do not recreate `/como-funciona` as a separate public page.
- `PublicHeader` and `PublicFooter` expose the label `O que é o TES?` pointing
  to `routes.public.about`.

## Copy Contract

- Explain the TES as an online platform connecting people and therapists.
- Preserve responsible language: no cure promises, diagnosis claims, guaranteed results, or clinical certainty.
- Keep patient and therapist paths distinct with CTAs to `routes.public.journey` and `routes.public.forTherapists`.

## UI Contract

- Use the public header and footer.
- Use TES tokens for text, surfaces, borders, focus states and CTAs.
- Use the registered `font-display` token (`IvyPresto Display`) for editorial
  headings. Italic is an accent for the human proposition and journey labels,
  not the default style of every heading. Keep body/UI type in the TES sans
  token.
- The dominant task is to explain the TES and let the visitor choose a journey.
  The hero has no CTA; preserve the person and therapist CTAs in their
  contextual experience cards and the institutional CTA only in the final banner.
- Use `Comfortable` public density: editorial hierarchy, deliberate whitespace,
  and surfaces only for the two experience choices and the values statement.
- Reuse `PublicHeader`, `PublicFooter`, `TESButton` and the existing
  `lucide-react` glyphs. The page composition is page-specific; do not promote
  a global component from one occurrence.
- Reference screen: Figma `Projeto TES - Copy`, node `14845:668`. The approved
  Figma assets live in `public/about/figma-*.png`; use the original assets and
  preserve their edge fade treatment when they sit against a page surface. The
  legacy platform mockup sources remain preserved; the current platform mockup
  uses the supplied `public/about/platform-dashboard-2026-08-26-transparent.png`
  asset. Set
  `next/image` quality to `95` for these editorial images so the WebP response
  does not introduce visible compression in soft gradients.
- From `xl`, the hero image is clipped by its section, begins at the top of the
  section immediately after the header and extends to the right viewport edge.
  Its left edge remains aligned to the centered editorial grid; never
  reintroduce a capped media column that leaves a blank right margin on wide
  desktop displays.
- Editorial headings on this page use `font-display`, `font-light` and
  `italic`, which selects the IvyPresto Display Light cut rather than a bold
  headline cut or fallback serif. The hero expression “existe um encontro.” is
  the explicit exception: it uses the bold italic display cut for emphasis. Use nonbreaking groups for vulnerable short expressions (for
  example, `a ele`) so a single final word is never orphaned. Keep explicit
  horizontal padding on pills and other bounded controls so labels never
  visually touch rounded edges.
- At `xl`, the hero headline is `56px`; on mobile it reduces to `36px` and the
  supporting copy uses compact leading and nonbreaking groups to protect both
  the headline and subheadline from one-word final lines. The journey heading
  uses IvyPresto Display Light Italic rather than the UI sans token.
- Keep content readable on mobile and desktop without dense legal copy. Mobile
  turns the three-column journey and platform composition into an editorial
  sequence rather than a compressed desktop grid. Keep the platform-media slot
  compact on mobile (`16:10`) so a transparent asset never creates a perceived
  empty section between its editorial heading and the feature pills.

## Data and Fallback

- This is a static institutional surface; it has no runtime data dependency.
- Do not add mock content or a fallback state. A missing local asset is a build
  issue and must not be replaced by a generic image.

## QA

- Validate `/sobre-nos` renders with public header and footer.
- Validate `/como-funciona` redirects to `/sobre-nos`.
- Validate `O que é o TES?` appears in the desktop/mobile header and in the
  institutional footer group, always linking to `/sobre-nos`.
- Validate CTAs by real click when Playwright/browser is available.
- Execute `npx playwright test tests/e2e/public-about.spec.ts --project=chromium`
  to verify responsive overflow, required assets, and the header/footer
  navigation contract.
- Include a 1920px-wide desktop pass to confirm the hero media reaches the
  viewport edge without a residual white area.
- Validate there are no links to `/entrar`, `/cadastro` or `/para-terapeutas/planos`.
- Follow the calibration workflow: inspect, task proposal, Figma interpretation,
  design-system mapping, implementation, visual QA at desktop/tablet/mobile,
  correction, and approval at Visual Quality Score >= 85 without eliminatories.
