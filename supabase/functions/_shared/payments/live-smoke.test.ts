import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  getLiveSmokeCheckoutDiscounts,
  isLiveSmokeCouponConfigured,
} from "./live-smoke.ts";

const therapistProfileId = "11111111-1111-4111-8111-111111111111";

Deno.test("live smoke coupon is denied in test mode", () => {
  assertEquals(
    getLiveSmokeCheckoutDiscounts({
      couponId: "coupon_live_smoke",
      enabledValue: "true",
      stripeMode: "test",
      therapistProfileId,
      therapistProfileIdAllowlist: therapistProfileId,
    }),
    [],
  );
});

Deno.test("live smoke coupon requires server-side flag and allowlisted therapist", () => {
  assertEquals(
    getLiveSmokeCheckoutDiscounts({
      couponId: "coupon_live_smoke",
      enabledValue: "false",
      stripeMode: "live",
      therapistProfileId,
      therapistProfileIdAllowlist: therapistProfileId,
    }),
    [],
  );
  assertEquals(
    getLiveSmokeCheckoutDiscounts({
      couponId: "coupon_live_smoke",
      enabledValue: "true",
      stripeMode: "live",
      therapistProfileId,
      therapistProfileIdAllowlist:
        "22222222-2222-4222-8222-222222222222",
    }),
    [],
  );
});

Deno.test("live smoke coupon returns a Stripe discounts payload only when all gates pass", () => {
  assertEquals(
    getLiveSmokeCheckoutDiscounts({
      couponId: "coupon_live_smoke",
      enabledValue: "true",
      stripeMode: "live",
      therapistProfileId,
      therapistProfileIdAllowlist: therapistProfileId,
    }),
    [{ coupon: "coupon_live_smoke" }],
  );
});

Deno.test("live smoke coupon configuration helper rejects malformed ids", () => {
  assertEquals(
    isLiveSmokeCouponConfigured({
      couponId: "coupon_live_smoke",
      enabledValue: "true",
      therapistProfileId,
      therapistProfileIdAllowlist: therapistProfileId,
    }),
    true,
  );
  assertEquals(
    isLiveSmokeCouponConfigured({
      couponId: "coupon live smoke",
      enabledValue: "true",
      therapistProfileId,
      therapistProfileIdAllowlist: therapistProfileId,
    }),
    false,
  );
});
