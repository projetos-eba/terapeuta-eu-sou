import Stripe from "stripe";

import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeMode,
  getStripeSecretKey,
  getSupabaseUrl,
  loadEnvFiles,
  requireSupabaseServiceRoleKey,
} from "./env-utils.mjs";

loadEnvFiles();

const stripeSecretKey = getStripeSecretKey();

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});
const stripeMode = getStripeMode(stripeSecretKey);
const supabaseUrl = getSupabaseUrl();
assertStripeModeAllowedForSupabaseUrl({ stripeMode, supabaseUrl });
const serviceRoleKey = requireSupabaseServiceRoleKey();
const rows = await supabaseJson(
  "/rest/v1/billing_plan_prices?select=id,unit_amount_cents,interval,stripe_lookup_key,billing_plans!inner(code,name)&unit_amount_cents=gt.0&is_active=eq.true",
);
const synced = [];

for (const row of rows) {
  const plan = row.billing_plans;

  if (!plan?.code || !row.stripe_lookup_key || !row.interval) continue;

  const existingPrices = await stripe.prices.list({
    active: true,
    limit: 1,
    lookup_keys: [row.stripe_lookup_key],
  });
  let price = existingPrices.data[0];
  let productId = typeof price?.product === "string" ? price.product : null;

  if (price) {
    assertPriceMatches(row, price);
  } else {
    const product = await findOrCreateProduct(plan);
    productId = product.id;
    price = await stripe.prices.create({
      currency: "brl",
      lookup_key: row.stripe_lookup_key,
      metadata: {
        entity: "therapist_plan_price",
        environment: stripeMode,
        plan_code: plan.code,
        stripe_mode: stripeMode,
        system: "tes",
      },
      product: product.id,
      recurring: { interval: row.interval },
      unit_amount: row.unit_amount_cents,
    });
  }

  await supabaseJson(
    `/rest/v1/billing_plan_prices?id=eq.${encodeURIComponent(row.id)}`,
    {
      body: JSON.stringify({
        environment: stripeMode,
        stripe_livemode: price.livemode,
        stripe_price_id: price.id,
        stripe_product_id: productId,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
      method: "PATCH",
    },
  );
  synced.push({
    planCode: plan.code,
    priceId: price.id,
    productId,
    reused: Boolean(existingPrices.data[0]),
  });
}

console.log(`Stripe billing catalog sync complete (${stripeMode}).`);
for (const item of synced) {
  console.log(
    `- ${item.planCode}: product=${item.productId ?? "missing"} price=${item.priceId} reused=${item.reused}`,
  );
}

async function findOrCreateProduct(plan) {
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['system']:'tes' AND metadata['entity']:'therapist_plan' AND metadata['plan_code']:'${plan.code}'`,
  });

  if (products.data[0]) return products.data[0];

  return stripe.products.create({
    metadata: {
      entity: "therapist_plan",
      environment: stripeMode,
      plan_code: plan.code,
      stripe_mode: stripeMode,
      system: "tes",
    },
    name: `TES ${plan.name}`,
  });
}

function assertPriceMatches(row, price) {
  const mismatches = [];

  if (price.currency !== "brl") mismatches.push("currency");
  if (price.unit_amount !== row.unit_amount_cents)
    mismatches.push("unit_amount");
  if (price.recurring?.interval !== row.interval)
    mismatches.push("recurring.interval");
  if ((price.livemode ? "live" : "test") !== stripeMode)
    mismatches.push("livemode");

  if (mismatches.length > 0) {
    throw new Error(
      `Stripe price ${price.id} diverges from ${row.billing_plans?.code}: ${mismatches.join(", ")}.`,
    );
  }
}

async function supabaseJson(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error(JSON.stringify(payload, null, 2));
    throw new Error(`Supabase request failed with HTTP ${response.status}.`);
  }

  return payload;
}
