# Patient Encounters Page

Use this skill when implementing or refactoring the authenticated patient/client encounters page.

## Sources

- Global experience authority: `skills/tes-ui-experience/SKILL.md`.
- Global component authority: `skills/tes-design-system/SKILL.md`.
- Benchmark record: `docs/design-refactor/benchmark-c-patient-encounters.md`.
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
- The open PageHeader uses the local Figma asset
  `public/patient/encounters/hero-acompanhamento.png` (source node
  `13366:3444`) with the editorial copy `Seu espaço de acompanhamento` and
  `Tudo o que faz parte da sua jornada reunido em um único lugar.`. The image
  is decorative; it must not replace the semantic page heading or hide the
  orientation copy on narrow viewports.
- The temporal groups retain their real data and actions while using the
  patient-facing labels `Próximos encontros` and `Histórico de encontros`.
- Experience density: `Balanced`, with a `Comfortable` empty state when useful.
- Information order is: page orientation → next encounter/next action → other
  future encounters → history.
- The next encounter may use one tokenized accent surface because it groups the
  dominant entity, state and action. Do not nest cards inside it.
- Other future encounters and history use open `TemporalGroup`/`EntityList`
  compositions with spacing and hairlines; do not create a card per encounter.
- Do not render the legacy metrics strip, inferred journey topics or discovery
  banner in the populated flow. They do not change the patient's immediate
  decision and must not compete with the next encounter.
- `FilterBar`, `CommandBar`, `ContextRail`, `MetricStrip`, tables and operational
  Admin status treatments do not apply to this page.
- Desktop rows are horizontal; tablet preserves comparable rows; mobile rows
  become stacked open records separated by dividers, never a horizontal table.
- Use TES Tailwind tokens for color, surface, border, typography and state. Do
  not introduce hex colors, arbitrary gradients or arbitrary shadows.
- Functional text is at least 14px. Metadata is at least 11px on desktop and
  10px on mobile. Touch targets are at least 44px.
- Buttons and menus must be real accessible controls.
- The list exposes one state-aware action from the existing `primaryAction`.
  Cancellation and rescheduling remain in the encounter detail; do not render
  the legacy non-state-aware overflow menu in the list.
- Entry link is active only when the booking is paid, confirmed and inside the
  allowed join window. Do not select or expose `meeting_url` in patient lists;
  Zoom access must be requested from the detail page via authenticated backend.

## QA

- Validate `/app/encontros`.
- Validate `/app/sessoes` redirects.
- Check desktop (about 1440px), tablet (768–1024px) and mobile (375–430px).
- Check populated, empty, payment attention, pending reschedule, live entry,
  completed, cancelled, loading and honest error states when fixtures allow.
- Confirm the page has no horizontal overflow, raw `meeting_url`, raw Zoom URL,
  new patient copy using “Sessão”, hidden state-aware CTA or item-level card.
- Confirm keyboard focus reaches the dominant action and every target remains
  at least 44px.
- Visual Quality Score must be at least 85 with no eliminatory failure.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` when environment allows.

## Benchmark C decisions

- `Open PageHeader` transfers as a local `balanced` variant; do not change the
  global `AppPageHeader` before Calibration.
- `Light PageSection`, `EntityList`, status presentation and hairlines remain
  Calibration candidates, not promoted components.
- `NextEncounterSpotlight`, `PatientStatusGuidance` and `TemporalGroup` remain
  local/domain candidates.
- No global token gap was proven. Existing `surface-soft`,
  `brand-lavenderSoft`, semantic status colors and `border` are sufficient.
- The Figma preserves useful human/editorial intent, but its metric grid,
  repeated cards, microtext, excessive pills and copy “Entrar na sessão” are
  not implementation authority for this benchmark.

## Known validation debt

- The local management E2E fixtures can become temporally expired when the
  database is not reseeded. The current future Carlos fixtures also lack a
  canonical paid row in `session_payments`, so they correctly remain blocked by
  the action policy. A disabled cancel/reschedule button is correct domain
  behavior, not proof of the happy-path command. Revalidate the real-click
  happy path after refreshing the documented canonical fixtures; never mutate
  production or ad-hoc local rows to make the test pass.

## Copy Safety

- Keep language supportive and responsible.
- Do not promise cure, diagnosis, or guaranteed outcomes.
- Do not mention implementation, seed data, migrations, or development details in user-facing UI text.
