# Patient Session Detail Page

Use this skill when implementing or refactoring the authenticated client/patient booking detail page.

## Sources

- Figma: `Projeto Terapeuta Eu Sou Atualizado`, node `13366:6713`.
- Referências visuais complementares anexadas em 2026-08-23: detalhe desktop e
  sequência mobile do encontro. Elas orientam composição e responsividade; os
  contratos reais do TES continuam sendo a autoridade para dados e ações.
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

- Product copy for patient-facing UI must say "encontro".
- Technical domain must remain `bookings`.
- Do not create tables named `sessions`, `encounters`, or `patient_encounters`.
- Detail query entry point: `getPatientSessionDetailPage({ profileId, bookingId })`.
- Query files must use `import "server-only"`.

## Data And Security

- Validate ownership through `patient_profiles.user_id = profileId` and `bookings.patient_profile_id`.
- Return `notFound()` for unknown bookings or bookings outside the logged-in patient.
- For Zoom and legacy providers, do not select or expose `meeting_url`; use
  `/api/zoom/video-session-access` to request a backend-signed Video SDK
  payload for the canonical room flow.
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
- Density: `Balanced`, with `Comfortable` only in the primary context region.
- First fold must answer: therapist, date/time, booking state and next authorized step.
- Main layout: breadcrumb/header editorial + hero dominante + faixa de três
  estados + contexto principal e rail contextual em desktop; fluxo linear de
  prioridade no mobile.
- Em tablet, manter a sequência de prioridade antes de promover a grade de
  contexto e as seções auxiliares para o arranjo desktop; a promoção de três
  colunas só ocorre em largura ampla. Em 1440x900, 1024x768 e 390x844, texto,
  estado e ações devem caber no próprio bloco, sem sobreposição nem scroll
  horizontal.
- The content order is: identity/status, payment/room/encounter state, about
  and shared context, secure online access, management actions, support and
  reminder, preparation and cancellation policy.
- Use only the existing journey count/start date when continuity is shown; do
  not create a fictional timeline, milestones or therapeutic claims.
- Prefer one dominant encounter context, then `rounded-card`, `border-border`, `shadow-card` and restrained `surface-soft` interiors for supporting sections.
- Do not replicate a right rail only to fill width. Support and reminder are contextual, not mandatory.
- Use TES Tailwind tokens: `brand`, `surface`, `tesText`, `status`, `shadow-card`, `rounded-card`, `font-display`, `font-sans`.
- Therapist avatars shown in patient session cards/details must come from the same stable `public/therapists/*.png` assets used by public therapist pages and seed data.
- Use real buttons and links.
- O detalhe deve direcionar para a sala dedicada; não montar o Video SDK no
  card de acesso.
- Do not expose or render raw Zoom/meeting URLs, copy-link controls, tokens, host data or technical roles in patient UI.
- Video session entry must be a client component with visible or aria-live feedback.
- Zoom join must be a client component that dynamic-imports `@zoom/videosdk` and never trusts a browser-provided role.
- Use local assets or token-based placeholders only; do not commit temporary Figma asset URLs. The approved decorative lotus asset is `public/patient/encounters/lotus-detail.png`, exported from the Figma node above; it is permitted only as a low-opacity, empty-alt decoration in the shared-intake field that describes what the patient shared when booking.
- Questions in "Informações úteis" open a local `TESDialog` with the canonical operational answer; they do not redirect to the message center.
- No hero do detalhe, o próximo passo é a ação principal de entrada; os atalhos
  redundantes “Testar dispositivos” e “Falar com suporte” não devem ser
  repetidos nesse bloco. A preparação técnica permanece na seção dedicada
  quando existir.
- Quando o pagamento está confirmado e o horário está dentro da janela ativa,
  o CTA principal deve abrir a sala dedicada mesmo que a presença do terapeuta
  ainda não tenha sido confirmada. A sala de espera aplica o host-first e
  bloqueia o join do paciente até a presença confiável do terapeuta; o detalhe
  não deve transformar essa espera em uma ação desabilitada.
- Encontros confirmados usam a semântica verde do TES no status e no destaque
  contextual do hero, sem alterar a autorização real de entrada na sala.
- Cancellation and refund copy follows `POLÍTICA DE CANCELAMENTO - OPERACIONAL.docx`: at least 24 hours may allow rescheduling or refund when applicable; under 24 hours and no-show do not create an obligation to refund; exceptional cases are individually reviewed.
- Do not invent testimonials, therapeutic journey claims, images or summaries that are not present in the canonical detail data.
- Datas e horários do encontro devem ser formatados no `booking.timezone` do
  registro. Instantes persistidos continuam em UTC e não podem ser deslocados
  para corrigir apresentação.

## QA

- Run `npm run typecheck`, `npm run lint`, `npm run build`.
- Run focused tests for patient detail components when changing access or state presentation.
- Run Supabase validation when possible: `npx supabase db reset`.
- Test:
  - `/app/encontros/96000000-0000-4000-8000-000000000001`
  - `/app/sessoes/96000000-0000-4000-8000-000000000001`
  - click "Ver detalhes" from `/app/encontros`.
- Validate desktop, tablet and mobile before approval; the page cannot depend on horizontal scrolling or on an always-visible rail.
- Verify the notification popover renders above page content without text bleed or stacking overlap.

## Copy Safety

- Keep language supportive and responsible.
- Do not promise cure, diagnosis, or guaranteed outcomes.
- Do not mention implementation details in user-facing UI.
- Payment, cancellation and access statuses must use human TES language; never
  expose terms such as backend, webhook or provider to the patient.
