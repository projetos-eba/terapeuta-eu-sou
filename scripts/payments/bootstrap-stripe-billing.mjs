#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import Stripe from "stripe";

import { getStripeMode, getStripeSecretKey } from "./env-utils.mjs";

const target = readTarget();
const expectedMode = target === "live" ? "live" : "test";
const stripeSecretKey = getStripeSecretKey();

if (!stripeSecretKey || getStripeMode(stripeSecretKey) !== expectedMode) {
  throw new Error(`Stripe key does not match requested ${target} target.`);
}
if (target === "live" && !process.argv.includes("--confirm-live-config")) {
  throw new Error(
    "Live configuration requires --confirm-live-config. This command never creates transactions.",
  );
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});
const expiresAt = Date.parse("2026-09-11T03:00:00.000Z") / 1000;
const offerKey = "therapist_founder";
const promotionCodeValue = "TERAPEUTAFUNDADOR";

const products = {
  premium: await findOrCreateProduct("premium", "Premium"),
  premium_plus: await findOrCreateProduct("premium_plus", "Premium Plus"),
};

const definitions = [
  {
    lookupKey: "tes_premium_brl_monthly_v2",
    planCode: "premium",
    productId: products.premium.id,
    unitAmount: 7990,
  },
  {
    lookupKey: "tes_premium_plus_brl_monthly_v2",
    planCode: "premium_plus",
    productId: products.premium_plus.id,
    unitAmount: 12990,
  },
  {
    lookupKey: "tes_premium_plus_founder_brl_monthly_v1",
    offerKey,
    planCode: "premium_plus",
    productId: products.premium_plus.id,
    unitAmount: 7990,
  },
];

for (const definition of definitions) {
  await findOrCreatePrice(definition);
}

for (const lookupKey of [
  "tes_premium_brl_monthly_v1",
  "tes_premium_plus_brl_monthly_v1",
  "tes_premium_brl_6months_v1",
  "tes_premium_plus_brl_6months_v1",
]) {
  await deactivatePrice(lookupKey);
}

const coupon = await findOrCreateCoupon(products.premium_plus.id);
const promotionCode = await findOrCreatePromotionCode(coupon.id);
const shouldBeActive = target === "test";

if (promotionCode.active !== shouldBeActive) {
  await stripe.promotionCodes.update(promotionCode.id, {
    active: shouldBeActive,
  });
}

runScript("configure-stripe-webhook-destinations.mjs");

if (target === "test") {
  runScript("sync-stripe-billing-catalog.mjs");
  runScript("verify-stripe-billing-catalog.mjs");
}

runScript("verify-stripe-billing-environment.mjs");
runScript("verify-stripe-webhook-destinations.mjs");

console.log(
  JSON.stringify({
    billingCatalog: {
      founderRecurringAmountCents: 7990,
      premiumAmountCents: 7990,
      premiumPlusAmountCents: 12990,
      recurringInterval: "month",
    },
    liveTransactionsCreated: false,
    promotionCode: {
      active: shouldBeActive,
      expiresAt: "2026-09-11T03:00:00.000Z",
      firstTransactionOnly: true,
      value: promotionCodeValue,
      zeroInvoiceCount: 3,
    },
    target,
    verified: true,
  }),
);

function readTarget() {
  const argument = process.argv.find((value) => value.startsWith("--target="));
  const value = argument?.split("=")[1];
  if (value === "test" || value === "live") return value;
  throw new Error("Use --target=test or --target=live.");
}

function runScript(filename) {
  execFileSync(
    process.execPath,
    [`scripts/payments/${filename}`, `--target=${target}`],
    {
      env: process.env,
      stdio: "inherit",
    },
  );
}

async function findOrCreateProduct(planCode, name) {
  for (const lookupKey of preferredLookupKeys(planCode)) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    const productId = stripeObjectId(prices.data[0]?.product);
    if (productId) return stripe.products.retrieve(productId);
  }

  const page = await stripe.products.search({
    query: `active:'true' AND metadata['system']:'tes' AND metadata['entity']:'therapist_plan' AND metadata['plan_code']:'${planCode}'`,
  });
  const existing = page.data.sort(
    (left, right) => left.created - right.created,
  )[0];
  if (existing) return existing;

  return stripe.products.create({
    metadata: {
      entity: "therapist_plan",
      environment: target,
      plan_code: planCode,
      stripe_mode: expectedMode,
      system: "tes",
    },
    name: `TES ${name}`,
  });
}

function preferredLookupKeys(planCode) {
  return planCode === "premium_plus"
    ? [
        "tes_premium_plus_brl_monthly_v2",
        "tes_premium_plus_founder_brl_monthly_v1",
        "tes_premium_plus_brl_monthly_v1",
      ]
    : ["tes_premium_brl_monthly_v2", "tes_premium_brl_monthly_v1"];
}

async function findOrCreatePrice(definition) {
  const page = await stripe.prices.list({
    lookup_keys: [definition.lookupKey],
    limit: 1,
  });
  const existing = page.data[0];

  if (existing) {
    assertPrice(existing, definition);
    return existing.active
      ? existing
      : stripe.prices.update(existing.id, { active: true });
  }

  return stripe.prices.create({
    currency: "brl",
    lookup_key: definition.lookupKey,
    metadata: {
      entity: "therapist_plan_price",
      environment: target,
      ...(definition.offerKey ? { offer_key: definition.offerKey } : {}),
      plan_code: definition.planCode,
      stripe_mode: expectedMode,
      system: "tes",
    },
    product: definition.productId,
    recurring: { interval: "month" },
    unit_amount: definition.unitAmount,
  });
}

function assertPrice(price, definition) {
  const mismatches = [];
  if (price.livemode !== (target === "live")) mismatches.push("livemode");
  if (price.currency !== "brl") mismatches.push("currency");
  if (price.unit_amount !== definition.unitAmount) mismatches.push("amount");
  if (price.recurring?.interval !== "month") mismatches.push("interval");
  if ((price.recurring?.interval_count ?? 1) !== 1)
    mismatches.push("interval_count");
  if (stripeObjectId(price.product) !== definition.productId)
    mismatches.push("product");
  if (mismatches.length > 0) {
    throw new Error(
      `Existing Price ${definition.lookupKey} diverges: ${mismatches.join(", ")}.`,
    );
  }
}

async function deactivatePrice(lookupKey) {
  const page = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (page.data[0]?.active) {
    await stripe.prices.update(page.data[0].id, { active: false });
  }
}

async function findOrCreateCoupon(productId) {
  const couponId = `tes_therapist_founder_2026_${target}`;
  try {
    const existing = await stripe.coupons.retrieve(couponId, {
      expand: ["applies_to"],
    });
    if (!("deleted" in existing)) {
      const mismatches = [];
      if (!existing.valid) mismatches.push("valid");
      if (existing.percent_off !== 100) mismatches.push("percent_off");
      if (existing.duration !== "repeating") mismatches.push("duration");
      if (existing.duration_in_months !== 3)
        mismatches.push("duration_in_months");
      if (existing.redeem_by !== expiresAt) mismatches.push("redeem_by");
      if (!(existing.applies_to?.products ?? []).includes(productId)) {
        mismatches.push("applies_to.products");
      }
      if (mismatches.length > 0) {
        throw new Error(`Founder Coupon diverges: ${mismatches.join(", ")}.`);
      }
      return existing;
    }
  } catch (error) {
    if (!isStripeResourceMissing(error)) throw error;
  }

  return stripe.coupons.create({
    applies_to: { products: [productId] },
    duration: "repeating",
    duration_in_months: 3,
    id: couponId,
    metadata: {
      environment: target,
      offer_key: offerKey,
      promotion_code: promotionCodeValue,
      stripe_mode: expectedMode,
      system: "tes",
    },
    name: "TES Terapeuta Fundador — 3 meses grátis",
    percent_off: 100,
    redeem_by: expiresAt,
  });
}

async function findOrCreatePromotionCode(couponId) {
  const page = await stripe.promotionCodes.list({
    code: promotionCodeValue,
    limit: 100,
  });
  const existing = page.data.find(
    (item) => item.metadata?.offer_key === offerKey,
  );
  if (existing) {
    const mismatches = [];
    if (existing.expires_at !== expiresAt) mismatches.push("expires_at");
    if (existing.metadata?.tes_checkout_scope !== "subscription") {
      mismatches.push("tes_checkout_scope");
    }
    if (existing.restrictions?.first_time_transaction !== true) {
      mismatches.push("first_time_transaction");
    }
    if (mismatches.length > 0) {
      throw new Error(`TERAPEUTAFUNDADOR diverges: ${mismatches.join(", ")}.`);
    }
    return existing;
  }

  return stripe.promotionCodes.create({
    active: target === "test",
    code: promotionCodeValue,
    expires_at: expiresAt,
    metadata: {
      environment: target,
      offer_key: offerKey,
      stripe_mode: expectedMode,
      system: "tes",
      tes_checkout_scope: "subscription",
    },
    promotion: { coupon: couponId, type: "coupon" },
    restrictions: { first_time_transaction: true },
  });
}

function stripeObjectId(value) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

function isStripeResourceMissing(error) {
  return (
    error &&
    typeof error === "object" &&
    (error.statusCode === 404 || error.code === "resource_missing")
  );
}
