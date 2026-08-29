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
12. Public assets in `public/home/`, `public/therapies/`, and `public/therapists/`

## Route Contract

- Route: `/`
- Canonical source for links: `src/lib/routes.ts`
- Primary public CTAs:
  - `routes.public.about`
  - `routes.public.therapies`
  - `routes.public.journey`
  - `routes.public.therapists`
  - `routes.public.forTherapists`
- Do not create placeholder pages only to satisfy home links unless the user explicitly asks.

## Data Contract

The home may read public content through REST Supabase using only public env vars:

- `public_home_therapies`
- `public_home_therapists`
- `public_home_testimonials`
- `public_therapist_profile_content_v` for published `Como posso te guiar` guide chips
- `public_therapist_profile_services_v` for the public therapy/technique names shown under the therapist name
- `public_therapist_profile_reviews_v_internal` as the canonical source of
  aggregate rating and review count in `public_home_therapists`

Rules:

- A prateleira de terapias consome `public_therapies_v.theme_names`, uma lista
  ordenada; o primeiro tema é o rótulo resumido do card. Não consultar o campo
  singular legado `theme_name` nesse contrato.

- Never expose operational therapist fields, private patient data, payment data, intake data, Zoom links, or secrets.
- Keep local demo content in `src/features/public-home/content.ts`, but never
  activate it silently. Demo data requires `TES_ENABLE_DEMO_DATA=true` on the
  server and must be visible in the UI.
- Therapy fallback content must stay aligned with the current public catalog phase: `reiki`, `taro` and `constelacao-familiar`. Do not link fallback cards to therapy slugs that are `draft`, not visible, or missing public detail content.
- Featured therapist photos must use the stable local assets in `public/therapists/`, shared with `/terapeutas`, `/terapeutas/:slug`, therapy detail cards and patient session cards.
- The featured therapists carousel should show five real profiles on desktop
  when possible. If the public view returns zero rows, show an honest empty
  state; do not complete the shelf with local profiles unless demo is explicitly
  enabled.
- Featured therapist cards must not invent guide-theme chips. Show chips only from published `public_therapist_profile_content_v.guide_items`, with a minimum of 3 and maximum of 6 visible items. Therapists without published guide items should render without this chip row.
- The small line under the therapist name should show public therapies/techniques from `public_therapist_profile_services_v`, with at most two names plus `e +N` when there are more.
- Therapy preview cards should use editorial therapy photos, not generic icons. Use `image_url` from `public_therapies_v` when present and the stable local images for Reiki, Tarô and Constelação Familiar as fallback.
- Do not add `@supabase/supabase-js` unless the user explicitly approves a dependency change.
- If a public view changes, update docs and this skill in the same task.
- Rating and review count include only canonical reviews with `status =
published` and no replacement. Their visibility does not subsequently depend
  on the booking or payment that originally qualified the patient relationship.

## UI Contract

The page should preserve these sections from Figma `13273:1844`:

- Public header
- Responsive public header with logo and a sidebar menu below the large-layout
  breakpoint. When the sidebar is active, show only the logo and menu control
  in the header; the authenticated account identity and its three actions stay
  above the navigation inside the sidebar. Show profile-specific login links
  only for guests. After a confirmed logout, update the authenticated/guest
  state immediately in both desktop and mobile header instances without
  requiring a full page reload. Keep the large "Começar minha jornada" CTA in
  the header only on large layouts.
- Hero with human image
- `O que é o TES?` with the Figma-style supporting purple shape behind the trust cards
  - On large layouts the shape is capped at 50% of the viewport width; the trust
    cards use two columns until the extra-wide breakpoint so this composition
    does not overflow on smaller desktop/tablet widths.
- `Como funciona` with large editorial step images
- Therapy marquee
- Motivations / online session section
- Therapies preview
- Featured therapists as a horizontal carousel on all viewports, without directional controls. It advances automatically only when the unique cards exceed the available viewport width; when they do not, do not duplicate cards or start horizontal movement. It pauses while hovered, focused or directly interacted with and loops without a visible gap after the final paginated result. The initial server page and subsequent client pages prioritize `premium` and `premium_plus`; while fewer than five paid public profiles exist, each page is completed with `free` profiles. Do not render repeated presentation identities (same public name and photo), even when separate public records originate from technical homologation. Cards should avoid long descriptions and prioritize therapist photo, name, public therapies/techniques, published guide-theme chips, rating/reviews and profile CTA. Do not show availability badges or verification icons over photos unless the public Home data contract exposes the corresponding real state. Do not render the section when no real profile is returned.
- Testimonials remain implemented but are intentionally hidden from the public
  Home until a new product decision re-enables their rendering.
- Journey CTA using `platformAssets.publicJourneyCta`; keep the CTA below the text and do not add the old `Sessão online` hat. On mobile, reserve a dedicated lower media region inside the banner so the editorial subject remains visible after the copy and CTA; do not reduce the image to a thin strip.
- FAQ
- FAQ cards use native independent disclosure. At the two-column tablet and
  desktop breakpoints, an expanded answer must not stretch a neighboring closed
  card or expose an empty surface.
- Public footer

Use existing TES components before creating new equivalents:

- `PublicHeader`
- `PublicFooter`
- `TESButton`
- `TESCard`
- `TESBadge`

Use TES tokens through Tailwind classes and CSS variables. Do not change global tokens for a page-only issue.

The motivations / online session section uses the supplied platform visual at
`public/home/tablet-video-session-2026-08-26-transparent.png`; keep the legacy
asset preserved for compatibility with other surfaces.

## Copy Rules

- Keep language calm, human, premium, and responsible.
- Never promise cure, diagnosis, guaranteed transformation, guaranteed booking, or financial result.
- Therapy descriptions must be informational and should not replace medical, psychological, diagnostic, or professional care.
- If using testimonials, only use published, non-sensitive, non-identifying content.

## QA Checklist

- Compare the page visually with Figma node `13273:1844` on desktop and mobile.
- Open a FAQ on tablet and desktop and verify its neighbor remains closed at
  its intrinsic height.
- Validate authenticated header logout on desktop and mobile, including the
  immediate return of the profile-specific login actions without a reload.
- Check that all CTAs use `routes.public`.
- Check unavailable rendering with missing Supabase env, and demo rendering only
  with `TES_ENABLE_DEMO_DATA=true` outside production.
- Check Supabase rendering when local Supabase is available.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- For migration changes, run `npx supabase db lint`; run `npx supabase db reset` only when local data reset is acceptable for the task.
- Report commands actually run and any validation not performed.

## Assets da plataforma

- O CTA de jornada usa `platformAssets.publicJourneyCta` ancorado à direita,
  com fade curto apenas na borda esquerda de transição para a copy.
- Consulte `docs/design-system/platform-assets.md` antes de substituir esse asset.
