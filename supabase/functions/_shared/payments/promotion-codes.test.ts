import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "./http.ts";
import {
  checkoutAmounts,
  mapPromotionStripeError,
  resolvePromotionCode,
} from "./promotion-codes.ts";

const basePromotion = {
  active: true,
  code: "TES20",
  customer: null,
  id: "promo_tes20",
  metadata: { tes_checkout_scope: "session" },
  promotion: { coupon: "coupon_tes20", type: "coupon" },
};

const baseCoupon = {
  amount_off: null,
  applies_to: { products: [] },
  currency: null,
  currency_options: {},
  duration: "once",
  duration_in_months: null,
  id: "coupon_tes20",
  percent_off: 20,
  valid: true,
};

Deno.test("promotion resolver accepts a scoped session percentage code", async () => {
  const result = await resolvePromotionCode({
    checkoutScope: "session",
    code: " tes20 ",
    currency: "BRL",
    customerId: "cus_patient",
    originalAmountCents: 12_000,
    stripe: stripeMock(basePromotion, baseCoupon),
  });

  assertEquals(result.summary.percentOff, 20);
  assertEquals(result.summary.code, "TES20");
});

Deno.test("promotion resolver accepts only an explicitly eligible subscription product", async () => {
  const promotion = {
    ...basePromotion,
    metadata: { tes_checkout_scope: "subscription" },
  };
  const coupon = {
    ...baseCoupon,
    applies_to: { products: ["prod_premium"] },
    duration: "repeating",
    duration_in_months: 3,
    percent_off: 100,
  };
  const result = await resolvePromotionCode({
    checkoutScope: "subscription",
    code: "TES20",
    currency: "brl",
    customerId: "cus_therapist",
    eligibleProductId: "prod_premium",
    originalAmountCents: 6_000,
    stripe: stripeMock(promotion, coupon),
  });

  assertEquals(result.summary.duration, "repeating");
  assertEquals(result.summary.durationInMonths, 3);
  assertEquals(result.summary.percentOff, 100);
});

Deno.test("promotion resolver fails closed for scope and product", async () => {
  await assertDomainCode(
    () =>
      resolvePromotionCode({
        checkoutScope: "subscription",
        code: "TES20",
        currency: "brl",
        customerId: "cus_therapist",
        eligibleProductId: "prod_premium",
        originalAmountCents: 6_000,
        stripe: stripeMock(basePromotion, baseCoupon),
      }),
    "promotion_scope_mismatch",
  );
  await assertDomainCode(
    () =>
      resolvePromotionCode({
        checkoutScope: "subscription",
        code: "TES20",
        currency: "brl",
        customerId: "cus_therapist",
        eligibleProductId: "prod_plus",
        originalAmountCents: 9_000,
        stripe: stripeMock(
          {
            ...basePromotion,
            metadata: { tes_checkout_scope: "subscription" },
          },
          { ...baseCoupon, applies_to: { products: ["prod_premium"] } },
        ),
      }),
    "promotion_product_mismatch",
  );
});

Deno.test("promotion resolver accepts a 100% session discount", async () => {
  const result = await resolvePromotionCode({
    checkoutScope: "session",
    code: "TES20",
    currency: "brl",
    customerId: "cus_patient",
    originalAmountCents: 12_000,
    stripe: stripeMock(basePromotion, { ...baseCoupon, percent_off: 100 }),
  });

  assertEquals(result.summary.percentOff, 100);
});

Deno.test("promotion resolver accepts a fixed discount equal to the session amount", async () => {
  const result = await resolvePromotionCode({
    checkoutScope: "session",
    code: "TES20",
    currency: "brl",
    customerId: "cus_patient",
    originalAmountCents: 12_000,
    stripe: stripeMock(basePromotion, {
      ...baseCoupon,
      amount_off: 12_000,
      currency: "brl",
      percent_off: null,
    }),
  });

  assertEquals(result.summary.amountOffCents, 12_000);
});

Deno.test("promotion resolver rejects a fixed discount that would make a session negative", async () => {
  await assertDomainCode(
    () =>
      resolvePromotionCode({
        checkoutScope: "session",
        code: "TES20",
        currency: "brl",
        customerId: "cus_patient",
        originalAmountCents: 12_000,
        stripe: stripeMock(basePromotion, {
          ...baseCoupon,
          amount_off: 12_001,
          currency: "brl",
          percent_off: null,
        }),
      }),
    "promotion_amount_exceeds_total",
  );
});

Deno.test("checkout amount summary stays authoritative to Stripe values", () => {
  assertEquals(
    checkoutAmounts({
      amount_subtotal: 12_000,
      amount_total: 9_600,
      currency: "brl",
      total_details: { amount_discount: 2_400 },
    }),
    {
      currency: "brl",
      discountAmountCents: 2_400,
      originalAmountCents: 12_000,
      totalAmountCents: 9_600,
    },
  );
});

Deno.test("maps Stripe minimum amount rejections to a safe user error", () => {
  const error = mapPromotionStripeError({
    code: "invalid_request_error",
    message:
      "This promotion code cannot be redeemed because the associated purchase does not meet the minimum amount requirement.",
    param: "discounts[0][promotion_code]",
  });

  assertEquals(error?.code, "promotion_minimum_amount");
  assertEquals(error?.status, 422);
  assertEquals(error?.message, "Este código promocional exige um valor mínimo para esta compra.");
});

Deno.test("maps redemption limits and ignores unrelated provider failures", () => {
  assertEquals(
    mapPromotionStripeError({
      message: "This promotion code has reached its maximum redemptions.",
      param: "discounts[0][promotion_code]",
    })?.code,
    "promotion_redemption_limit",
  );
  assertEquals(mapPromotionStripeError({ message: "network unavailable" }), null);
});

function stripeMock(promotion: unknown, coupon: unknown) {
  return {
    coupons: { retrieve: () => Promise.resolve(coupon) },
    promotionCodes: {
      list: () => Promise.resolve({ data: [promotion] }),
    },
  } as never;
}

async function assertDomainCode(
  action: () => Promise<unknown>,
  expectedCode: string,
) {
  const error = await assertRejects(action, DomainError);
  assertEquals(error.code, expectedCode);
}
