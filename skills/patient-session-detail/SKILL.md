# Patient Session Detail Page

Use this skill when implementing or refactoring the authenticated client/patient booking detail page.

## Sources

- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:6713`.
- Route source: `src/lib/routes.ts`.
- Authenticated shell: `src/app/(authenticated)/layout.tsx`.
- Booking list: `src/features/patient-encounters/`.
- Shared booking detail domain: `src/features/booking-detail/`.
- Design tokens: `src/app/globals.css` and `docs/design-system/design-system.md`.
- Route docs: `docs/product/routes-map.md` and `docs/product/sitemap.md`.

## Route

- Canonical route: `/app/encontros/[bookingId]`.
- Dedicated video route: `/app/encontros/[bookingId]/video`.
- Legacy route: `/app/sessoes/[bookingId]` redirects to `/app/encontros/[bookingId]`.
- `routes.patient.encounterDetail(bookingId)` is the canonical detail helper.
- Keep `routes.patient.sessionDetail(bookingId)` only as legacy.

## Domain

- Product copy can say "sessão" or "encontro".
- Technical domain must remain `bookings`.
- Do not create tables named `sessions`, `encounters`, or `patient_encounters`.
- Detail query entry point: `getPatientSessionDetailPage({ profileId, bookingId })`.
- Query files must use `import "server-only"`.

## Data And Security

- Validate ownership through `patient_profiles.user_id = profileId` and `bookings.patient_profile_id`.
- Return `notFound()` for unknown bookings or bookings outside the logged-in patient.
- For Zoom, do not select or expose `meeting_url`; use
  `/api/zoom/video-session-access` to request a backend-signed Video SDK
  payload.
- Do not expose `meeting_url` for non-Zoom providers unless payment is paid and booking status is allowed.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components.
- Demo data belongs in `supabase/seed.sql`, not migrations.

## Supporting Tables

Use these support tables when needed:

- `booking_intake_responses`
- `booking_payment_receipts`
- `therapist_service_cancellation_policies`
- `booking_events`
- `booking_session_summaries`

## UI Rules

- Reuse authenticated shell.
- Main layout: primary content and right rail on desktop; stacked cards on tablet/mobile.
- Use TES Tailwind tokens: `brand`, `surface`, `tesText`, `status`, `shadow-card`, `rounded-card`, `font-display`, `font-sans`.
- Therapist avatars shown in patient session cards/details must come from the same stable `public/therapists/*.png` assets used by public therapist pages and seed data.
- Use real buttons and links.
- O detalhe deve direcionar para a sala dedicada; não montar o Video SDK no
  card de acesso.
- Video session entry must be a client component with visible or aria-live feedback.
- Zoom join must be a client component that dynamic-imports `@zoom/videosdk` and never trusts a browser-provided role.
- Use local assets or token-based placeholders only; do not commit temporary Figma asset URLs.

## QA

- Run `npm run typecheck`, `npm run lint`, `npm run build`.
- Run Supabase validation when possible: `npx supabase db reset`.
- Test:
  - `/app/encontros/96000000-0000-4000-8000-000000000001`
  - `/app/sessoes/96000000-0000-4000-8000-000000000001`
  - click "Ver detalhes" from `/app/encontros`.

## Copy Safety

- Keep language supportive and responsible.
- Do not promise cure, diagnosis, or guaranteed outcomes.
- Do not mention implementation details in user-facing UI.
