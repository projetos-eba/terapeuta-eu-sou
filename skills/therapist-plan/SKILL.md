---
name: therapist-plan
description: Use when working on the therapist plan center, plan entitlements, subscription upgrade, scheduled downgrade, cancellation, or plan-aware shell UI under /terapeuta/plano and /terapeuta/configuracoes.
---

# Therapist Plan And Subscription

## Required Sources

Read `AGENTS.md`, `docs/product/sitemap.md`,
`docs/product/routes-map.md`, `docs/design-system/design-system.md`,
`docs/payments/architecture.md`, `skills/payments-billing/SKILL.md`,
`src/domain/tes/plan-definitions.ts`, `src/domain/tes/plans.ts`,
`src/lib/permissions.ts` and `src/lib/routes.ts` before editing this area.

## Visual Reference

- Primary supplied reference:
  `/Users/antoniofelipe/Downloads/ChatGPT Image Aug 11, 2026, 03_05_21 PM.png`.
- Figma file: `Projeto Terapeuta Eu Sou Atualizado`.
- Exact node for this authenticated plan center: not identified in the files
  analyzed. Preserve the shared therapist shell and `AppPage*` contract rather
  than creating a parallel visual system.

## Routes And Responsibilities

- `/terapeuta/plano` is the acquisition and upgrade center.
- Allowed there: Free to Premium, Free to Premium Plus, and Premium to Premium
  Plus.
- `/terapeuta/configuracoes#plano-assinatura` owns scheduled downgrade,
  cancellation and cancellation reversal.
- Do not create `/upgrade` or plan-specific authenticated pages.
- The Upgrade sidebar item is visible for Free and Premium and hidden for
  Premium Plus.

## Sources Of Truth

- Effective access plan: `therapist_profiles.plan`, loaded by the authenticated
  therapist session.
- Catalog and real prices: `billing_plans` plus active
  `billing_plan_prices`.
- Subscription lifecycle: `therapist_subscriptions` and Stripe Billing.
- Features and entitlements: `src/domain/tes/plan-definitions.ts`,
  `src/domain/tes/plans.ts`, `src/domain/tes/permissions.ts` and
  `src/lib/permissions.ts`.
- The browser never sends a therapist or customer identifier for a financial
  command. Edge Functions derive the therapist from the authenticated token.

## Billing Contract

- Free to paid uses the existing authenticated Checkout flow.
- Premium to Premium Plus is immediate with proration and preserves the old
  plan if payment confirmation is incomplete.
- Premium Plus to Premium uses a Subscription Schedule and takes effect at the
  current period end.
- Cancellation uses `cancel_at_period_end`; benefits remain active until the
  paid period ends.
- Cancellation reversal sets `cancel_at_period_end = false`.
- Redirect query strings never activate a plan. Webhook or authenticated
  reconciliation is authoritative.
- UI refresh uses the authenticated projection; never require logout/login.

## UI States

- Loading must not flash Free before the effective plan is known.
- Paid plan without a confirmed subscription is an unavailable state, not
  “sem cobrança”.
- Scheduled downgrade and cancellation show the effective date while retaining
  the current plan.
- Past due, unpaid and incomplete subscriptions block competing plan changes.
- Unknown or incomplete catalog data fails closed and never invents a price.
- Frontend copy must not mention tables, webhooks, read models, environment,
  secrets or internal failures.

## QA

- Unit coverage: Free, Premium, Premium Plus, active cancellation, scheduled
  downgrade, catalog failure, Upgrade visibility and header badge.
- Billing integration: checkout, immediate prorated upgrade, scheduled
  downgrade, cancellation and cancellation reversal in Stripe test mode.
- Visual QA: compare desktop hierarchy with the supplied image, then validate
  mobile cards, horizontal comparison-table scroll, keyboard focus and dialogs.
- Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`.
- Run payment E2E headed when Stripe/Supabase local services and test-mode
  credentials are available.

## Known Limits

- Payment method summary is not exposed by the current safe subscription
  projection and must not be inferred.
- HML financial mutations require a controlled test subscription and cleanup;
  do not alter a legitimate therapist subscription for visual QA.
