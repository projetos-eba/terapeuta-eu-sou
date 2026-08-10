import { describe, expect, it } from "vitest";

import {
  assertAmountWithinCap,
  assertLiveMoneyGuard,
  assertLiveStripeMode,
  assertProductionSupabaseUrl,
  estimateDiscountedAmountCents,
  LIVE_CONFIRMATION_VALUE,
  shouldUseLiveSmokeCoupon,
} from "./stripe-phase3-live-smoke-core.mjs";

describe("stripe phase 3B live smoke guards", () => {
  it("requires a live Stripe key", () => {
    expect(() => assertLiveStripeMode("sk_test_123")).toThrow(
      "live_stripe_key_required",
    );
    expect(assertLiveStripeMode("rk_live_123")).toBe("live");
  });

  it("rejects local and HML Supabase URLs for live smoke", () => {
    expect(() =>
      assertProductionSupabaseUrl("http://127.0.0.1:54321", {
        hmlRef: "emzwqkmrryuqvqiohqnu",
      }),
    ).toThrow("production_supabase_required");
    expect(() =>
      assertProductionSupabaseUrl(
        "https://emzwqkmrryuqvqiohqnu.supabase.co",
        {
          hmlRef: "emzwqkmrryuqvqiohqnu",
        },
      ),
    ).toThrow("hml_supabase_not_allowed_for_live");
    expect(
      assertProductionSupabaseUrl("https://abcdefghijklmnopqrst.supabase.co", {
        hmlRef: "emzwqkmrryuqvqiohqnu",
      }),
    ).toBe("abcdefghijklmnopqrst");
  });

  it("requires both CLI and environment confirmations before live money", () => {
    expect(() =>
      assertLiveMoneyGuard({
        args: [],
        env: { TES_LIVE_SMOKE_CONFIRM: LIVE_CONFIRMATION_VALUE },
        maxAmountCents: 500,
        plannedAmountCents: 500,
      }),
    ).toThrow("live_money_cli_confirmation_required");
    expect(() =>
      assertLiveMoneyGuard({
        args: ["--confirm-live-money"],
        env: { TES_LIVE_SMOKE_CONFIRM: "wrong" },
        maxAmountCents: 500,
        plannedAmountCents: 500,
      }),
    ).toThrow("live_money_env_confirmation_required");
  });

  it("blocks charges and transfers above the live smoke cap", () => {
    expect(() =>
      assertAmountWithinCap({ amountCents: 501, maxAmountCents: 500 }),
    ).toThrow("live_amount_cap_exceeded");
    expect(
      assertAmountWithinCap({ amountCents: 500, maxAmountCents: 500 }),
    ).toBe(500);
  });

  it("estimates discounted billing amounts for cap checks", () => {
    expect(
      estimateDiscountedAmountCents({
        coupon: { amount_off: 9_500 },
        unitAmountCents: 10_000,
      }),
    ).toBe(500);
    expect(
      estimateDiscountedAmountCents({
        coupon: { percent_off: 95 },
        unitAmountCents: 10_000,
      }),
    ).toBe(500);
  });

  it("only enables smoke coupon for the allowlisted therapist", () => {
    expect(
      shouldUseLiveSmokeCoupon({
        couponId: "coupon_live_smoke",
        enabled: "true",
        therapistProfileId: "therapist-a",
        therapistProfileIdAllowlist: "therapist-a",
      }),
    ).toBe(true);
    expect(
      shouldUseLiveSmokeCoupon({
        couponId: "coupon_live_smoke",
        enabled: "true",
        therapistProfileId: "therapist-a",
        therapistProfileIdAllowlist: "therapist-b",
      }),
    ).toBe(false);
  });
});
