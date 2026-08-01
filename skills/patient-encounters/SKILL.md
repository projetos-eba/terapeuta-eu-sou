# Patient Encounters Page

Use this skill when implementing or refactoring the authenticated patient/client encounters page.

## Sources

- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:3189`.
- Visible implementation frame: `Body Layout / Paciente Acompanhamento`, node `13366:3444`.
- Route source: `src/lib/routes.ts`.
- Authenticated shell: `src/app/(authenticated)/layout.tsx` and `src/components/authenticated-shell/`.
- Product routes: `docs/product/routes-map.md`.
- Sitemap: `docs/product/sitemap.md`.
- Design tokens: `docs/design-system/design-system.md` and `src/app/globals.css`.

## Route

- Canonical patient namespace: `/app`.
- Page route: `/app/encontros`.
- Legacy alias: `/app/sessoes` redirects to `/app/encontros`.
- Do not introduce `/paciente/encontros` as canonical route.

## Domain

- UX copy uses "Encontros".
- Technical domain remains `bookings` / sessions.
- Do not create tables named `encounters`, `patient_encounters`, or duplicated session domains.
- Query entry point: `getPatientEncountersPage(profileId)` in `src/features/patient-encounters/patient-encounters.queries.ts`.
- Visual components must receive mapped data; do not place demo row data inside components.

## Data

Required payload:

```ts
{
  (patient,
    nextEncounter,
    metrics,
    upcomingEncounters,
    historyEncounters,
    recentJourneyTopics,
    unreadMessagesCount,
    unreadNotificationsCount);
}
```

Use existing tables whenever possible:

- `profiles`
- `patient_profiles`
- `therapist_profiles`
- `therapist_services`
- `therapies`
- `bookings`
- `reviews`
- `favorite_therapists`

Session summaries are stored in `booking_session_summaries`, linked to `bookings`, only when the page needs "Ver resumo".

## UI Rules

- Reuse the authenticated shell.
- Sidebar item "Encontros" points to `routes.patient.encounters`.
- Use TES Tailwind tokens: `brand`, `surface`, `tesText`, `status`, `shadow-card`, `rounded-card`, `font-display`, `font-sans`.
- Desktop rows are horizontal; mobile rows become stacked cards.
- Buttons and menus must be real accessible controls.
- Entry link is active only when the booking is paid, confirmed and inside the
  allowed join window. Do not select or expose `meeting_url` in patient lists;
  Zoom access must be requested from the detail page via authenticated backend.

## QA

- Validate `/app/encontros`.
- Validate `/app/sessoes` redirects.
- Check empty states for upcoming and history.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` when environment allows.

## Copy Safety

- Keep language supportive and responsible.
- Do not promise cure, diagnosis, or guaranteed outcomes.
- Do not mention implementation, seed data, migrations, or development details in user-facing UI text.
