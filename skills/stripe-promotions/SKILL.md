---
name: stripe-promotions
description: Use when creating, reviewing, diagnosing, testing, activating, deactivating, or documenting TES Stripe Coupons and Promotion Codes for session payments or Premium/Premium Plus subscriptions, including custom promotion UI, Checkout Session replacement, superseded attempts, pt-BR checkout locale, Stripe Dashboard campaigns, discounts, redemption restrictions, and webhook reconciliation.
---

# Stripe Promotions TES

## Read first

- `AGENTS.md`
- `skills/payments-billing/SKILL.md`
- `skills/public-reservation/SKILL.md` when `/reserva` is involved
- `docs/payments/architecture.md`
- `docs/payments/promotion-codes.md`
- `docs/payments/stripe-phase-3-homologation.md`
- `docs/product/integration-map.md`
- Stripe official docs for Coupons, Promotion Codes and Checkout discounts

For UI changes also read the product, Design System and Figma sources required
by `AGENTS.md`. Reservation reference: Figma `13273:3114`; current screenshots
may supersede its composition and any divergence must be reported.

## Authority model

- Stripe Coupon owns the financial benefit.
- Stripe Promotion Code owns the customer-facing code and TES scope metadata.
- Stripe Checkout Session owns subtotal, discount and total.
- `session_payments` owns the canonical local session payment.
- Stripe webhooks, not redirects, confirm payments and subscriptions.
- Never create a local coupon catalog, seed, allowlist or browser-calculated
  discount.

## Required campaign contract

- Session Promotion Code: `tes_checkout_scope=session` and Coupon
  `duration=once`.
- Subscription Promotion Code: `tes_checkout_scope=subscription`.
- Subscription Coupon: explicit `applies_to.products` containing Premium,
  Premium Plus or both Stripe Product IDs.
- Fixed amounts must be valid for BRL.
- Session total zero is supported by Stripe one-time Checkout Sessions. A 100%
  Coupon or fixed amount exactly equal to the subtotal may complete without a
  PaymentIntent; the signed `checkout.session.completed` webhook still confirms
  the booking. Fixed discounts above the subtotal fail closed.
- Three free months means `percent_off=100`, `duration=repeating`,
  `duration_in_months=3`; it is not a trial.
- Future start uses an inactive Promotion Code activated manually. Do not invent
  `starts_at` or a scheduler.

## Implementation map

- Shared resolution: `supabase/functions/_shared/payments/promotion-codes.ts`
- Attempt policy: `supabase/functions/_shared/payments/session-attempt-policy.ts`
- Session creation/replacement:
  `supabase/functions/stripe-create-session-payment/index.ts`
- Subscription embedded/hosted creation:
  `supabase/functions/stripe-create-subscription-checkout/index.ts`
- Signed event handling: `supabase/functions/stripe-billing-webhook/index.ts`
- Shared UI: `src/features/payments/components/promotion-code-field.tsx`
- Reservation controller:
  `src/features/public-reservation/components/checkout-button.tsx`
- Subscription controller:
  `src/features/therapist-subscription/components/embedded-subscription-checkout.tsx`

Keep Stripe Embedded Checkout. Pass `locale: "pt-BR"` to every Checkout
Session. Do not add `payment_method_types` or a React Stripe dependency solely
for promotions.

## Replacement invariant

Applying, removing or changing a code creates a new Checkout Session using an
idempotency key with context, owner, attempt and resolved Promotion Code ID.
Authenticate the actor and validate the old Stripe Session is open, in the
correct mode/environment, owned by the same Customer and carries matching TES
metadata.

For session payments, update the current checkout with compare-and-swap. Mark
the old attempt `superseded`, expire it, and return a recoverable conflict if
another attempt won. Never let an expired/failed superseded event cancel the
booking. Accept the first real paid attempt and expire open siblings.

## UI contract

- Reservation field: directly below “Código promocional” in the summary.
- Subscription field: immediately before “Pagamento seguro no TES”.
- Include Apply, loading, inline error, “Código aplicado”, Remove, subtotal,
  discount and total.
- Minimum 14px functional text, 44px targets, focus-visible, Enter submit and
  aria-live result.
- Preserve typed input after recoverable errors; block concurrent submits.
- Never display webhook, metadata, API, session IDs, mock, environment or
  provider internals.

## Dashboard runbook

1. Select Stripe Test mode.
2. Create the Coupon with benefit, duration, expiry and Product eligibility.
3. Create the Promotion Code with public code and redemption restrictions.
4. Open the saved Promotion Code details, use **Metadata > Add metadata** (not
   the Code field), and set exactly `tes_checkout_scope=session` or
   `tes_checkout_scope=subscription`. If Dashboard metadata editing is not
   available, use `stripe promotion_codes update promo_xxx -d
   "metadata[tes_checkout_scope]=session"` in Test mode.
5. Test visibly through TES and signed webhook processing.
6. Repeat deliberately in Live mode only after the full release gate.
7. Disable the Promotion Code to stop a campaign; no TES database write is
   required.

## QA gate

Test percentage/fixed session codes; Premium, Premium Plus and both Products;
three months at 100%; invalid, inactive, expired, exhausted, scope/product,
customer, first purchase and minimum restrictions; apply/remove/reapply/change;
idempotent and concurrent replacement; superseded failure/expiration; paid
older attempt; no-discount baseline; financial reconciliation and ledger;
native field absence; pt-BR; responsive UI; hosted fallback; duplicate and
out-of-order webhooks; sanitized logs/evidence.

Run the applicable commands from `package.json`, including Deno tests, typecheck,
lint, build, Supabase reset/pgTAP and visible payment E2E. Never claim a command
or Stripe scenario passed unless it was actually executed.

## Security and pending scope

Never expose Stripe secret keys, client secrets, raw payloads, card data or
financial identifiers in UI/evidence. True trials and automated future
activation remain separate architectural work. Session no-cost checkout is
supported, but must be homologated in Test mode before release.
