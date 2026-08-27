#!/usr/bin/env node

import Stripe from "stripe";

import { getStripeMode, getStripeSecretKey } from "./env-utils.mjs";

const stripeSecretKey = getStripeSecretKey();
if (!stripeSecretKey || getStripeMode(stripeSecretKey) !== "test") {
  throw new Error("Founder Test Clock verification requires Stripe Test Mode.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});
const frozenAt = Date.parse("2026-08-26T12:00:00.000Z") / 1000;
let clock = null;
let subscription = null;

try {
  const pricePage = await stripe.prices.list({
    lookup_keys: ["tes_premium_plus_founder_brl_monthly_v1"],
    limit: 1,
  });
  const price = pricePage.data[0];
  if (!price?.active || price.unit_amount !== 7_990) {
    throw new Error("Founder Price is unavailable.");
  }

  const promotionPage = await stripe.promotionCodes.list({
    active: true,
    code: "TERAPEUTAFUNDADOR",
    limit: 100,
  });
  const promotionCode = promotionPage.data.find(
    (item) => item.metadata?.offer_key === "therapist_founder",
  );
  if (!promotionCode) throw new Error("Founder Promotion Code is unavailable.");

  clock = await stripe.testHelpers.testClocks.create({
    frozen_time: frozenAt,
    name: "TES founder billing verification",
  });
  const customer = await stripe.customers.create({
    email: `tes-founder-clock-${clock.id}@example.test`,
    metadata: { e2e: "true", system: "tes", test_scope: "founder_clock" },
    test_clock: clock.id,
  });
  const paymentMethod = await stripe.paymentMethods.create({
    card: { token: "tok_visa" },
    type: "card",
  });
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  subscription = await stripe.subscriptions.create({
    customer: customer.id,
    discounts: [{ promotion_code: promotionCode.id }],
    items: [{ price: price.id }],
    metadata: {
      e2e: "true",
      plan_code: "premium_plus",
      system: "tes",
      tes_offer_key: "therapist_founder",
      test_scope: "founder_clock",
    },
  });

  for (const date of [
    "2026-09-27T12:00:00.000Z",
    "2026-10-27T12:00:00.000Z",
    "2026-11-27T12:00:00.000Z",
  ]) {
    await stripe.testHelpers.testClocks.advance(clock.id, {
      frozen_time: Date.parse(date) / 1000,
    });
    await waitUntilClockReady(clock.id);
  }

  const invoices = await stripe.invoices.list({
    customer: customer.id,
    limit: 20,
    subscription: subscription.id,
  });
  const amounts = invoices.data
    .sort((left, right) => left.created - right.created)
    .map((invoice) => invoice.amount_due);
  const expected = [0, 0, 0, 7_990];

  if (JSON.stringify(amounts.slice(0, 4)) !== JSON.stringify(expected)) {
    throw new Error(`Founder invoice sequence diverges: ${amounts.join(",")}.`);
  }

  const finalSubscription = await stripe.subscriptions.retrieve(
    subscription.id,
  );
  const finalPrice = finalSubscription.items.data[0]?.price;
  if (
    finalSubscription.status !== "active" ||
    finalPrice?.lookup_key !== "tes_premium_plus_founder_brl_monthly_v1" ||
    finalPrice.unit_amount !== 7_990
  ) {
    throw new Error("Founder subscription did not remain active on its Price.");
  }

  console.log(
    JSON.stringify({
      finalPlan: "premium_plus",
      invoiceAmountsCents: expected,
      recurringAmountCents: 7990,
      status: "active",
      verified: true,
    }),
  );
} finally {
  if (subscription?.id) {
    await stripe.subscriptions.cancel(subscription.id).catch(() => undefined);
  }
  if (clock?.id) {
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
  }
}

async function waitUntilClockReady(testClockId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const current = await stripe.testHelpers.testClocks.retrieve(testClockId);
    if (current.status === "ready") return;
    if (current.status === "internal_failure") {
      throw new Error("Stripe Test Clock entered internal_failure.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Stripe Test Clock did not become ready.");
}
