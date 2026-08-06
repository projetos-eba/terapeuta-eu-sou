#!/usr/bin/env node

import { createHmac } from "node:crypto";
import process from "node:process";
import Stripe from "stripe";
import { chromium } from "playwright";
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
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
const stripeSecretKey = getStripeSecretKey();
const stripeWebhookSecret =
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET ??
  process.env.STRIPE_WEBHOOK_SECRET;

const required = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseAnonKey,
  STRIPE_SECRET_KEY: stripeSecretKey,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  SUPABASE_URL: supabaseUrl,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(
      `${name} is required for subscription checkout homologation.`,
    );
    process.exit(1);
  }
}

if (!stripeSecretKey.startsWith("sk_test_")) {
  console.error("Use Stripe test mode for subscription checkout homologation.");
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
let browser;
let cachedTherapistUserId;
let subscriptionId = null;

try {
  logStage("launch_browser");
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: { dir: "test-results/payments-subscription-approved" },
  });
  const page = await context.newPage();

  logStage("open_login");
  await page.goto(
    `${baseUrl}/terapeuta/login?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium`,
  );
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(password);
  logStage("submit_login");
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await page.waitForURL(/\/terapeuta\/checkout\?plan=premium/, {
    timeout: 20_000,
  });

  logStage("assert_free_before_checkout");
  await assertTherapistPlan("free", "before_checkout");

  logStage("open_stripe_checkout");
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  logStage("fill_approved_card");
  await fillApprovedStripeCard(page);
  logStage("wait_success_redirect");
  await page.waitForURL(/\/terapeuta\/checkout\?.*checkout=success/, {
    timeout: 120_000,
  });

  logStage("assert_redirect_did_not_activate_plan");
  const successUrl = new URL(page.url());
  const checkoutSessionId = successUrl.searchParams.get("session_id");
  if (!checkoutSessionId) throw new Error("checkout_session_id_missing");

  await assertTherapistPlan("free", "after_success_redirect_before_webhook");

  logStage("retrieve_stripe_subscription");
  const checkoutSession =
    await stripe.checkout.sessions.retrieve(checkoutSessionId);
  subscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;

  if (!subscriptionId) throw new Error("stripe_subscription_missing");

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.status !== "active") {
    throw new Error(`stripe_subscription_not_active:${subscription.status}`);
  }

  logStage("wait_real_stripe_event");
  const event = await waitForCheckoutCompletedEvent(checkoutSessionId);
  logStage("post_signed_webhook_event");
  const webhookResponse = await postSignedStripeEvent(event);

  if (!webhookResponse.ok) {
    throw new Error(`webhook_failed:${webhookResponse.status}`);
  }

  logStage("wait_local_plan_update");
  await waitForTherapistPlan("premium");
  logStage("collect_evidence");
  const evidence = await collectBillingEvidence(event.id, subscriptionId);

  console.log(
    JSON.stringify({
      checkoutRedirectDoesNotActivatePlan: true,
      eventProcessed: evidence.webhook?.processing_status === "processed",
      finalPlan: evidence.therapist?.plan,
      invoiceStatus: evidence.invoice?.status ?? null,
      localSubscriptionStatus: evidence.subscription?.status ?? null,
      ok: true,
      stripeSubscriptionStatus: subscription.status,
      webhookDelivery: "local_signed_replay_of_real_stripe_event",
    }),
  );
} finally {
  if (subscriptionId) {
    await stripe.subscriptions.cancel(subscriptionId).catch(() => undefined);
  }

  if (browser) await browser.close();
}

function logStage(stage) {
  console.log(JSON.stringify({ stage }));
}

async function fillApprovedStripeCard(page) {
  await fillStripeField(
    page,
    /Card number|Numero do cartao|Número do cartão/i,
    "4242424242424242",
    [
      'input[name="cardnumber"]',
      'input[autocomplete="cc-number"]',
      'input[data-elements-stable-field-name="cardNumber"]',
    ],
  );
  await fillStripeField(
    page,
    /Expiration|Validade|MM\s*\/\s*YY|MM\s*\/\s*AA/i,
    "1234",
    [
      'input[name="expiry"]',
      'input[autocomplete="cc-exp"]',
      'input[data-elements-stable-field-name="cardExpiry"]',
    ],
  );
  await fillStripeField(
    page,
    /CVC|Codigo de seguranca|Código de segurança/i,
    "123",
    [
      'input[name="cvc"]',
      'input[autocomplete="cc-csc"]',
      'input[data-elements-stable-field-name="cardCvc"]',
    ],
  );
  await fillOptionalStripeField(
    page,
    /Name on card|Nome no cartao|Nome no cartão|Nome/i,
    "Homologacao TES",
    ['input[name="billingName"]', 'input[autocomplete="cc-name"]'],
  );
  await fillOptionalStripeField(page, /ZIP|Postal|CEP/i, "01001000", [
    'input[name="postalCode"]',
    'input[autocomplete="postal-code"]',
    'input[data-elements-stable-field-name="postalCode"]',
  ]);
  await clickStripeButton(
    page,
    /Pay|Pagar|Finalizar|Confirmar|Subscribe|Assinar/i,
  );
}

async function fillStripeField(page, label, value, selectors = []) {
  const locator =
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByLabel(label).first(),
    )) ??
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByPlaceholder(label).first(),
    )) ??
    (await findFirstSelectorInPageOrFrames(page, selectors));

  if (!locator) throw new Error(`stripe_field_not_found:${label}`);
  await locator.fill(value, { timeout: 15_000 });
}

async function fillOptionalStripeField(page, label, value, selectors = []) {
  const locator =
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByLabel(label).first(),
    )) ??
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByPlaceholder(label).first(),
    )) ??
    (await findFirstSelectorInPageOrFrames(page, selectors));

  if (locator)
    await locator.fill(value, { timeout: 10_000 }).catch(() => undefined);
}

async function clickStripeButton(page, label) {
  const locator =
    (await findFirstSelectorInPageOrFrames(page, [
      'button[type="submit"]',
      '[data-testid="hosted-payment-submit-button"]',
    ])) ??
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByRole("button", { name: label }).first(),
    )) ??
    (await findFirstEnabledButtonInPageOrFrames(page));

  if (!locator) throw new Error("stripe_submit_button_not_found");
  await locator.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await locator.click({ timeout: 15_000 });
}

async function findFirstSelectorInPageOrFrames(page, selectors) {
  for (const selector of selectors) {
    const locator = await findLocatorInPageOrFrames(page, (scope) =>
      scope.locator(selector).first(),
    );
    if (locator) return locator;
  }
  return null;
}

async function findFirstEnabledButtonInPageOrFrames(page) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const scope of [page, ...page.frames()]) {
      const buttons = scope.locator("button");
      const count = await buttons.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index);
        try {
          if ((await button.isVisible()) && (await button.isEnabled())) {
            return button;
          }
        } catch {
          // Stripe frame tree can change while inspected.
        }
      }
    }
    await delay(500);
  }
  return null;
}

async function findLocatorInPageOrFrames(page, buildLocator) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const scope of [page, ...page.frames()]) {
      const locator = buildLocator(scope);
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible())) {
          return locator;
        }
      } catch {
        // Cross-origin Stripe frames can appear while the tree changes.
      }
    }
    await delay(500);
  }
  return null;
}

async function waitForCheckoutCompletedEvent(checkoutSessionId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const events = await stripe.events.list({
      limit: 20,
      type: "checkout.session.completed",
    });
    const event = events.data.find(
      (item) => item.data?.object?.id === checkoutSessionId,
    );
    if (event) return event;
    await delay(3000);
  }
  throw new Error("stripe_checkout_completed_event_not_found");
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

async function assertTherapistPlan(expectedPlan, stage) {
  const rows = await supabaseAdmin(
    `/rest/v1/therapist_profiles?select=plan&user_id=eq.${encodeURIComponent(
      await therapistUserId(),
    )}&limit=1`,
  );
  const actualPlan = rows[0]?.plan;
  if (actualPlan !== expectedPlan) {
    throw new Error(`unexpected_plan:${stage}:${actualPlan}`);
  }
}

async function waitForTherapistPlan(expectedPlan) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const rows = await supabaseAdmin(
      `/rest/v1/therapist_profiles?select=plan&user_id=eq.${encodeURIComponent(
        await therapistUserId(),
      )}&limit=1`,
    );
    if (rows[0]?.plan === expectedPlan) return;
    await delay(2000);
  }
  throw new Error(`therapist_plan_not_updated:${expectedPlan}`);
}

async function collectBillingEvidence(stripeEventId, stripeSubscriptionId) {
  const userId = await therapistUserId();
  const [therapist] = await supabaseAdmin(
    `/rest/v1/therapist_profiles?select=id,plan&user_id=eq.${encodeURIComponent(
      userId,
    )}&limit=1`,
  );
  const [subscription] = await supabaseAdmin(
    `/rest/v1/therapist_subscriptions?select=status,plan_code,stripe_subscription_id&stripe_subscription_id=eq.${encodeURIComponent(
      stripeSubscriptionId,
    )}&limit=1`,
  );
  const [webhook] = await supabaseAdmin(
    `/rest/v1/stripe_webhook_events?select=processing_status,event_type&stripe_event_id=eq.${encodeURIComponent(
      stripeEventId,
    )}&limit=1`,
  );
  const [invoice] = subscription?.stripe_subscription_id
    ? await supabaseAdmin(
        `/rest/v1/billing_invoices?select=status,stripe_subscription_id&stripe_subscription_id=eq.${encodeURIComponent(
          subscription.stripe_subscription_id,
        )}&limit=1`,
      )
    : [];

  return { invoice, subscription, therapist, webhook };
}

async function therapistUserId() {
  if (cachedTherapistUserId) return cachedTherapistUserId;
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
  if (!response.ok || !body.user?.id) {
    throw new Error("therapist_login_for_evidence_failed");
  }
  cachedTherapistUserId = body.user.id;
  return cachedTherapistUserId;
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
