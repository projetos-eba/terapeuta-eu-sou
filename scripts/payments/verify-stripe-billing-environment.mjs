#!/usr/bin/env node

import Stripe from "stripe";

import { getStripeMode, getStripeSecretKey } from "./env-utils.mjs";

const targetArgument = process.argv.find((value) =>
  value.startsWith("--target="),
);
const target = targetArgument?.split("=")[1];
if (target !== "test" && target !== "live") {
  throw new Error("Use --target=test or --target=live.");
}

const stripeSecretKey = getStripeSecretKey();
if (!stripeSecretKey || getStripeMode(stripeSecretKey) !== target) {
  throw new Error(`Stripe key does not match requested ${target} target.`);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});
const desired = [
  ["tes_premium_brl_monthly_v2", 7990, "premium"],
  ["tes_premium_plus_brl_monthly_v2", 12990, "premium_plus"],
  ["tes_premium_plus_founder_brl_monthly_v1", 7990, "premium_plus"],
];
const verifiedPrices = [];
let premiumPlusProductId = null;

for (const [lookupKey, amount, planCode] of desired) {
  const page = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = page.data[0];
  if (
    !price?.active ||
    price.currency !== "brl" ||
    price.unit_amount !== amount ||
    price.recurring?.interval !== "month" ||
    (price.recurring?.interval_count ?? 1) !== 1 ||
    price.metadata?.plan_code !== planCode
  ) {
    throw new Error(`Price contract failed for ${lookupKey}.`);
  }
  const productId =
    typeof price.product === "string" ? price.product : price.product?.id;
  if (planCode === "premium_plus") {
    premiumPlusProductId ??= productId;
    if (premiumPlusProductId !== productId) {
      throw new Error(
        "Premium Plus public and founder Prices must share one Product.",
      );
    }
  }
  verifiedPrices.push({ amountCents: amount, lookupKey });
}

for (const lookupKey of [
  "tes_premium_brl_monthly_v1",
  "tes_premium_plus_brl_monthly_v1",
  "tes_premium_brl_6months_v1",
  "tes_premium_plus_brl_6months_v1",
]) {
  const page = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (page.data[0]?.active)
    throw new Error(`Retired Price is active: ${lookupKey}.`);
}

const codePage = await stripe.promotionCodes.list({
  code: "TERAPEUTAFUNDADOR",
  limit: 100,
});
const promotionCode = codePage.data.find(
  (item) => item.metadata?.offer_key === "therapist_founder",
);
if (!promotionCode) throw new Error("TERAPEUTAFUNDADOR is missing.");
if (promotionCode.active !== (target === "test")) {
  throw new Error("TERAPEUTAFUNDADOR active state diverges.");
}
if (
  promotionCode.expires_at !== Date.parse("2026-09-11T03:00:00.000Z") / 1000 ||
  promotionCode.restrictions?.first_time_transaction !== true
) {
  throw new Error("TERAPEUTAFUNDADOR restrictions diverge.");
}

const coupon = await stripe.coupons.retrieve(
  typeof promotionCode.promotion.coupon === "string"
    ? promotionCode.promotion.coupon
    : promotionCode.promotion.coupon.id,
  { expand: ["applies_to"] },
);
if (
  "deleted" in coupon ||
  coupon.percent_off !== 100 ||
  coupon.duration !== "repeating" ||
  coupon.duration_in_months !== 3 ||
  !(coupon.applies_to?.products ?? []).includes(premiumPlusProductId)
) {
  throw new Error("Founder Coupon contract diverges.");
}

console.log(
  JSON.stringify({
    founder: {
      active: promotionCode.active,
      expiresAt: "2026-09-11T03:00:00.000Z",
      firstTransactionOnly: true,
      recurringAfterPromotionCents: 7990,
      zeroInvoiceCount: 3,
    },
    prices: verifiedPrices,
    target,
    verified: true,
  }),
);
