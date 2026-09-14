import {
  calculateSessionPromotionAmounts,
  getSessionChargeTiming,
} from "./session-financial-flow-v10.ts";

Deno.test("schedules only sessions more than 24 hours away", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  if (getSessionChargeTiming("2026-09-13T12:00:00.000Z", now) !== "immediate") {
    throw new Error("exact_boundary_must_charge_immediately");
  }
  if (getSessionChargeTiming("2026-09-13T12:00:00.001Z", now) !== "scheduled") {
    throw new Error("future_booking_not_scheduled");
  }
});

Deno.test("freezes fixed and percentage promotion amounts in cents", () => {
  const fixed = calculateSessionPromotionAmounts({
    originalAmountCents: 12_300,
    promotion: {
      amountOffCents: 2_300,
      code: "TESTE",
      couponId: "coupon_fixed",
      duration: "once",
      promotionCodeId: "promo_fixed",
    },
  });
  const percent = calculateSessionPromotionAmounts({
    originalAmountCents: 12_300,
    promotion: {
      code: "METADE",
      couponId: "coupon_percent",
      duration: "once",
      percentOff: 50,
      promotionCodeId: "promo_percent",
    },
  });

  if (fixed.chargedAmountCents !== 10_000 || fixed.discountValue !== 2_300) {
    throw new Error("fixed_discount_invalid");
  }
  if (percent.chargedAmountCents !== 6_150 || percent.discountValue !== 5_000) {
    throw new Error("percent_discount_invalid");
  }
});

Deno.test("keeps a full discount at zero without a negative charge", () => {
  const amounts = calculateSessionPromotionAmounts({
    originalAmountCents: 12_300,
    promotion: {
      code: "GRATIS",
      couponId: "coupon_free",
      duration: "once",
      percentOff: 100,
      promotionCodeId: "promo_free",
    },
  });

  if (
    amounts.chargedAmountCents !== 0 ||
    amounts.discountAmountCents !== 12_300
  ) {
    throw new Error("full_discount_invalid");
  }
});
