#!/usr/bin/env node

import { createHmac } from "node:crypto";
import process from "node:process";
import Stripe from "stripe";
import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeMode,
  getStripeSecretKey,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();

const runId = process.env.PAYMENTS_E2E_RUN_ID ?? "tes-payments-e2e-local";
const password = process.env.PAYMENTS_E2E_PASSWORD ?? "TesE2e!ChangeMe2026";
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
const stripeSecretKey = getStripeSecretKey();
const stripeWebhookSecret =
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET ??
  process.env.STRIPE_WEBHOOK_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseAnonKey,
  STRIPE_SECRET_KEY: stripeSecretKey,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  SUPABASE_URL: supabaseUrl,
})) {
  if (!value) {
    console.error(`${name} is required for subscription lifecycle validation.`);
    process.exit(1);
  }
}

if (!stripeSecretKey.startsWith("sk_test_")) {
  console.error("Use Stripe test mode for subscription lifecycle validation.");
  process.exit(1);
}

assertStripeModeAllowedForSupabaseUrl({
  stripeMode: getStripeMode(stripeSecretKey),
  supabaseUrl,
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});
const therapistEmail = `${runId}.therapist_free@example.test`.toLowerCase();

let stripeSubscriptionId = null;

try {
  logStage("login_therapist");
  const auth = await loginTherapist();
  const therapist = await getTherapist(auth.user.id);
  const startingSubscription = await getLatestLocalSubscription(therapist.id);

  if (
    startingSubscription?.plan_code !== "premium" ||
    startingSubscription.status !== "active"
  ) {
    throw new Error(
      `expected_active_premium_subscription:${startingSubscription?.plan_code}:${startingSubscription?.status}`,
    );
  }

  stripeSubscriptionId = startingSubscription.stripe_subscription_id;

  logStage("upgrade_to_premium_plus");
  const upgradeStartedAt = stripeNow();
  await invokeFunction(
    auth.access_token,
    "stripe-change-therapist-subscription",
    {
      targetPlan: "premium_plus",
    },
  );
  await postSubscriptionEventAfter({
    since: upgradeStartedAt,
    stripeSubscriptionId,
    type: "customer.subscription.updated",
  });
  await waitForLocalSubscription(therapist.id, {
    plan: "premium_plus",
    status: "active",
  });

  logStage("schedule_downgrade_to_premium");
  await invokeFunction(
    auth.access_token,
    "stripe-change-therapist-subscription",
    {
      targetPlan: "premium",
    },
  );
  const downgradeEvent = await getLatestSubscriptionEvent(therapist.id, {
    eventType: "downgrade_scheduled",
  });
  if (!downgradeEvent) throw new Error("downgrade_scheduled_event_missing");

  logStage("schedule_cancel_at_period_end");
  const cancelStartedAt = stripeNow();
  await invokeFunction(
    auth.access_token,
    "stripe-cancel-therapist-subscription",
  );
  await postSubscriptionEventAfter({
    since: cancelStartedAt,
    stripeSubscriptionId,
    type: "customer.subscription.updated",
  });
  await waitForLocalSubscription(therapist.id, {
    cancelAtPeriodEnd: true,
    plan: "premium_plus",
    status: "active",
  });

  logStage("reactivate_cancel_at_period_end");
  const reactivateStartedAt = stripeNow();
  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
    metadata: {
      plan_code: "premium_plus",
      system: "tes",
      tes_therapist_id: therapist.id,
      user_id: auth.user.id,
    },
    proration_behavior: "none",
  });
  await postSubscriptionEventAfter({
    since: reactivateStartedAt,
    stripeSubscriptionId,
    type: "customer.subscription.updated",
  });
  await waitForLocalSubscription(therapist.id, {
    cancelAtPeriodEnd: false,
    plan: "premium_plus",
    status: "active",
  });

  logStage("cancel_immediately_and_sync_deleted");
  const deleteStartedAt = stripeNow();
  await stripe.subscriptions.cancel(stripeSubscriptionId);
  await postSubscriptionEventAfter({
    since: deleteStartedAt,
    stripeSubscriptionId,
    type: "customer.subscription.deleted",
  });
  await waitForTherapistPlan(therapist.id, "free");

  console.log(
    JSON.stringify({
      canceledToFree: true,
      downgradeScheduled: true,
      ok: true,
      reactivated: true,
      upgradedToPremiumPlus: true,
    }),
  );
  stripeSubscriptionId = null;
} finally {
  if (stripeSubscriptionId) {
    await stripe.subscriptions
      .cancel(stripeSubscriptionId)
      .catch(() => undefined);
  }
}

function logStage(stage) {
  console.log(JSON.stringify({ stage }));
}

function stripeNow() {
  return Math.floor(Date.now() / 1000);
}

async function loginTherapist() {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      body: JSON.stringify({ email: therapistEmail, password }),
      headers: {
        apikey: supabaseAnonKey,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  const body = await response.json();
  if (!response.ok || !body.access_token || !body.user?.id) {
    throw new Error("therapist_login_failed");
  }
  return body;
}

async function getTherapist(userId) {
  const [therapist] = await supabaseAdmin(
    `/rest/v1/therapist_profiles?select=id,plan&user_id=eq.${encodeURIComponent(
      userId,
    )}&limit=1`,
  );
  if (!therapist?.id) throw new Error("therapist_profile_missing");
  return therapist;
}

async function getLatestLocalSubscription(therapistProfileId) {
  const [subscription] = await supabaseAdmin(
    `/rest/v1/therapist_subscriptions?select=plan_code,status,stripe_subscription_id,cancel_at_period_end&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&order=created_at.desc&limit=1`,
  );
  return subscription ?? null;
}

async function getLatestSubscriptionEvent(therapistProfileId, { eventType }) {
  const [event] = await supabaseAdmin(
    `/rest/v1/therapist_subscription_events?select=id,event_type&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&event_type=eq.${encodeURIComponent(
      eventType,
    )}&order=created_at.desc&limit=1`,
  );
  return event ?? null;
}

async function waitForLocalSubscription(
  therapistProfileId,
  { cancelAtPeriodEnd, plan, status },
) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const subscription = await getLatestLocalSubscription(therapistProfileId);
    if (
      subscription?.plan_code === plan &&
      subscription?.status === status &&
      (cancelAtPeriodEnd === undefined ||
        subscription.cancel_at_period_end === cancelAtPeriodEnd)
    ) {
      return subscription;
    }
    await delay(2000);
  }
  throw new Error(`local_subscription_not_updated:${plan}:${status}`);
}

async function waitForTherapistPlan(therapistProfileId, expectedPlan) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const [therapist] = await supabaseAdmin(
      `/rest/v1/therapist_profiles?select=plan&id=eq.${encodeURIComponent(
        therapistProfileId,
      )}&limit=1`,
    );
    if (therapist?.plan === expectedPlan) return;
    await delay(2000);
  }
  throw new Error(`therapist_plan_not_updated:${expectedPlan}`);
}

async function invokeFunction(accessToken, functionName, body = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(
      `function_failed:${functionName}:${response.status}:${payload?.error?.code ?? "unknown"}`,
    );
  }
  return payload;
}

async function postSubscriptionEventAfter({
  since,
  stripeSubscriptionId,
  type,
}) {
  const event = await waitForStripeEvent({
    since,
    stripeSubscriptionId,
    type,
  });
  const firstResponse = await postSignedStripeEvent(event);
  if (!firstResponse.ok) {
    throw new Error(`webhook_failed:${type}:${firstResponse.status}`);
  }
  const duplicateResponse = await postSignedStripeEvent(event);
  if (!duplicateResponse.ok) {
    throw new Error(
      `webhook_duplicate_failed:${type}:${duplicateResponse.status}`,
    );
  }
  return event;
}

async function waitForStripeEvent({ since, stripeSubscriptionId, type }) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const events = await stripe.events.list({ limit: 30, type });
    const event = events.data.find(
      (item) =>
        item.created >= since && item.data?.object?.id === stripeSubscriptionId,
    );
    if (event) return event;
    await delay(3000);
  }
  throw new Error(`stripe_event_not_found:${type}`);
}

async function postSignedStripeEvent(event) {
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", stripeWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return fetch(`${supabaseUrl}/functions/v1/stripe-billing-webhook`, {
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    method: "POST",
  });
}

async function supabaseAdmin(path) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`supabase_admin_query_failed:${response.status}`);
  }
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
