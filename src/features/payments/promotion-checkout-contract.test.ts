import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Stripe promotion checkout contract", () => {
  it("keeps the native field disabled and localizes every checkout", () => {
    const session = read(
      "supabase/functions/stripe-create-session-payment/index.ts",
    );
    const subscription = read(
      "supabase/functions/stripe-create-subscription-checkout/index.ts",
    );

    expect(session).not.toContain("allow_promotion_codes");
    expect(session).toContain('locale: "pt-BR"');
    expect(subscription).toContain('locale: "pt-BR"');
    expect(session).toContain("promotion_code: promotion.promotionCodeId");
    expect(subscription).toContain("promotion_code: promotion.promotionCodeId");
  });

  it("renders one TES domain field in both checkout journeys", () => {
    const reservation = read(
      "src/features/public-reservation/components/reservation-page.tsx",
    );
    const subscription = read(
      "src/features/therapist-subscription/components/embedded-subscription-checkout.tsx",
    );

    expect(reservation).toContain("<PromotionCodeField");
    expect(subscription).toContain("<PromotionCodeField");
    expect(subscription.indexOf("<PromotionCodeField")).toBeLessThan(
      subscription.indexOf("Pagamento seguro no TES"),
    );
  });

  it("keeps the therapist checkout summary separate from the payment column", () => {
    const checkout = read("src/app/terapeuta/checkout/page.tsx");

    expect(checkout).not.toContain("<TherapistAuthShell");
    expect(checkout).toContain("function TherapistCheckoutFrame");
    expect(checkout).toContain(
      "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]",
    );
    expect(checkout.indexOf("checkout-plan-title")).toBeLessThan(
      checkout.indexOf("<EmbeddedSubscriptionCheckout"),
    );
  });

  it("keeps the founder price selection server-side and collects a card", () => {
    const subscription = read(
      "supabase/functions/stripe-create-subscription-checkout/index.ts",
    );
    const founderOffer = read(
      "supabase/functions/_shared/payments/founder-offer.ts",
    );

    expect(founderOffer).toContain('"TERAPEUTAFUNDADOR"');
    expect(founderOffer).toContain('"therapist_founder"');
    expect(subscription).toContain('payment_method_collection: "always"');
    expect(subscription).toContain("is_public=eq.true&offer_key=is.null");
    expect(subscription).toContain("assertFounderOfferEligibility");
    expect(subscription).toContain("checkout_replacement_conflict");
    expect(subscription).toContain("billing_plan_price_id");
  });
});
