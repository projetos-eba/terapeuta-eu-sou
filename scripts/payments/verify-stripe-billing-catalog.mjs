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
  "/rest/v1/billing_plan_prices?select=unit_amount_cents,interval,stripe_price_id,stripe_lookup_key,billing_plans!inner(code,name)&unit_amount_cents=gt.0&is_active=eq.true",
);
const failures = [];

for (const row of rows) {
  const planCode = row.billing_plans?.code ?? "unknown";

  if (!row.stripe_price_id) {
    failures.push(`${planCode}: missing stripe_price_id`);
    continue;
  }

  try {
    const price = await stripe.prices.retrieve(row.stripe_price_id);
    const mismatches = [];

    if (!price.active) mismatches.push("inactive");
    if (price.currency !== "brl") mismatches.push("currency");
    if (price.unit_amount !== row.unit_amount_cents)
      mismatches.push("unit_amount");
    if (price.recurring?.interval !== row.interval)
      mismatches.push("recurring.interval");
    if (price.lookup_key !== row.stripe_lookup_key)
      mismatches.push("lookup_key");
    if ((price.livemode ? "live" : "test") !== stripeMode)
      mismatches.push("livemode");

    console.log(
      `- ${planCode}: ${row.unit_amount_cents} cents, stripe_price_id=${row.stripe_price_id}`,
    );

    if (mismatches.length > 0) {
      failures.push(`${planCode}: ${mismatches.join(", ")}`);
    }
  } catch (error) {
    failures.push(
      `${planCode}: ${error instanceof Error ? error.message : "Stripe lookup failed"}`,
    );
  }
}

if (failures.length > 0) {
  console.error("Stripe billing catalog verification failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Stripe billing catalog is valid (${stripeMode}).`);
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
