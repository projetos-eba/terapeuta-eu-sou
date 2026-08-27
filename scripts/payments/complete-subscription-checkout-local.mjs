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
const plan = normalizePaidPlan(process.env.PAYMENTS_E2E_PLAN ?? "premium");
const scenario = normalizeScenario(
  process.env.PAYMENTS_E2E_SCENARIO ?? "approved",
);
const shouldOpenPortal = process.env.PAYMENTS_E2E_OPEN_PORTAL === "true";
const shouldKeepSubscription =
  process.env.PAYMENTS_E2E_KEEP_SUBSCRIPTION === "true";
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
let hostedCheckoutSessionId = null;

try {
  logStage("cleanup_existing_e2e_stripe_subscriptions");
  await cancelExistingE2EStripeSubscriptions();
  logStage("launch_browser");
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: { dir: "test-results/payments-subscription-approved" },
  });
  const page = await context.newPage();

  logStage("open_login");
  await page.goto(
    `${baseUrl}/terapeuta/login?next=${encodeURIComponent(
      `/terapeuta/checkout?plan=${plan}`,
    )}`,
  );
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(password);
  logStage("submit_login");
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await page.waitForURL(
    new RegExp(`/terapeuta/checkout\\?plan=${plan.replace("_", "_")}`),
    {
      timeout: 20_000,
    },
  );

  logStage("assert_free_before_checkout");
  await assertTherapistPlan("free", "before_checkout");

  logStage("wait_embedded_stripe_checkout");
  await page
    .locator("#subscription-embedded-checkout iframe")
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });

  if (scenario === "founder") {
    if (plan !== "premium_plus") {
      throw new Error("founder_scenario_requires_premium_plus");
    }
    logStage("apply_remove_reapply_founder_code");
    await exerciseFounderPromotionReplacement(page);
  }

  if (scenario === "hosted") {
    logStage("open_authenticated_hosted_checkout_fallback");
    const hostedCheckout = await page.evaluate(async (selectedPlan) => {
      const response = await fetch("/api/therapist/subscription-checkout", {
        body: JSON.stringify({
          checkoutUiMode: "hosted",
          plan: selectedPlan,
          promotionCode: null,
          replaceCheckoutSessionId: null,
          requestId: crypto.randomUUID(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      return response.json();
    }, plan);
    if (
      !hostedCheckout?.ok ||
      hostedCheckout.checkout?.mode !== "hosted" ||
      !hostedCheckout.checkout?.url ||
      !hostedCheckout.checkout?.checkoutSessionId
    ) {
      throw new Error("hosted_checkout_fallback_missing");
    }
    hostedCheckoutSessionId = hostedCheckout.checkout.checkoutSessionId;
    await page.goto(hostedCheckout.checkout.url);
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    logStage("return_from_hosted_checkout");
    await page.goto(
      `${baseUrl}/terapeuta/checkout?plan=${plan}&checkout=canceled`,
    );
    await page.waitForURL(/\/terapeuta\/checkout\?.*checkout=canceled/, {
      timeout: 30_000,
    });
    await page
      .getByRole("heading", { name: "Código promocional", exact: true })
      .waitFor({ timeout: 30_000 });
    await assertTherapistPlan("free", "after_hosted_checkout_return");
    console.log(
      JSON.stringify({
        authenticatedReturnObserved: true,
        finalPlan: "free",
        hostedCheckoutObserved: true,
        ok: true,
        plan,
        scenario,
      }),
    );
  } else if (scenario === "canceled") {
    logStage("cancel_stripe_checkout");
    await cancelStripeCheckout(page);
    await page.waitForURL(/\/terapeuta\/checkout\?.*checkout=canceled/, {
      timeout: 30_000,
    });
    await assertTherapistPlan("free", "after_checkout_canceled");
    console.log(
      JSON.stringify({
        finalPlan: "free",
        ok: true,
        plan,
        scenario,
      }),
    );
  } else if (scenario === "declined") {
    logStage("fill_declined_card");
    await fillStripeCard(page, "4000000000000002");
    logStage("assert_declined_state");
    await expectStripeDecline(page);
    await assertTherapistPlan("free", "after_declined_card");
    console.log(
      JSON.stringify({
        finalPlan: "free",
        ok: true,
        plan,
        scenario,
      }),
    );
  } else {
    logStage("fill_approved_card");
    await fillStripeCard(page, "4242424242424242");
    logStage("wait_success_redirect");
    try {
      await page.waitForURL(/\/terapeuta\/checkout\?.*checkout=success/, {
        timeout: 120_000,
      });
    } catch (error) {
      await page.screenshot({
        fullPage: true,
        path: `test-results/payments-subscription-approved/${plan}-${scenario}-redirect-timeout.png`,
      });
      throw error;
    }

    logStage("capture_success_redirect_session");
    const successUrl = new URL(page.url());
    const checkoutSessionId = successUrl.searchParams.get("session_id");
    if (!checkoutSessionId) throw new Error("checkout_session_id_missing");

    logStage("retrieve_stripe_subscription");
    const checkoutSession =
      await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (
      scenario === "founder" &&
      (checkoutSession.amount_subtotal !== 7_990 ||
        checkoutSession.amount_total !== 0 ||
        checkoutSession.total_details?.amount_discount !== 7_990)
    ) {
      throw new Error("founder_checkout_amounts_diverge");
    }
    subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription?.id;

    if (!subscriptionId) throw new Error("stripe_subscription_missing");

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== "active") {
      throw new Error(`stripe_subscription_not_active:${subscription.status}`);
    }
    const latestInvoiceId = getStripeObjectId(subscription.latest_invoice);
    const planAfterRedirect = await readTherapistPlan();

    logStage("wait_real_stripe_event");
    const event = await waitForCheckoutCompletedEvent(checkoutSessionId);
    logStage("post_signed_webhook_event");
    const webhookResponse = await postSignedStripeEvent(event);

    if (!webhookResponse.ok) {
      throw new Error(`webhook_failed:${webhookResponse.status}`);
    }
    logStage("repost_duplicate_signed_webhook_event");
    const duplicateWebhookResponse = await postSignedStripeEvent(event);
    if (!duplicateWebhookResponse.ok) {
      throw new Error(
        `duplicate_webhook_failed:${duplicateWebhookResponse.status}`,
      );
    }

    let invoiceEvent = null;
    if (latestInvoiceId) {
      logStage("wait_real_invoice_paid_event");
      invoiceEvent = await waitForStripeEvent("invoice.paid", latestInvoiceId);
      logStage("post_signed_invoice_webhook_event");
      const invoiceWebhookResponse = await postSignedStripeEvent(invoiceEvent);

      if (!invoiceWebhookResponse.ok) {
        throw new Error(
          `invoice_webhook_failed:${invoiceWebhookResponse.status}`,
        );
      }
    }

    let founderPaymentMethodRegistered;
    let founderFirstInvoiceAmountDue;
    if (scenario === "founder") {
      if (!latestInvoiceId) throw new Error("founder_invoice_missing");
      const firstInvoice = await stripe.invoices.retrieve(latestInvoiceId);
      founderFirstInvoiceAmountDue = firstInvoice.amount_due;
      if (firstInvoice.amount_due !== 0 || firstInvoice.total !== 0) {
        throw new Error("founder_first_invoice_not_zero");
      }

      const customerId = getStripeObjectId(subscription.customer);
      const customer = customerId
        ? await stripe.customers.retrieve(customerId)
        : null;
      founderPaymentMethodRegistered = Boolean(
        getStripeObjectId(subscription.default_payment_method) ||
          (customer &&
            !customer.deleted &&
            getStripeObjectId(customer.invoice_settings.default_payment_method)),
      );
      if (!founderPaymentMethodRegistered) {
        throw new Error("founder_payment_method_not_registered");
      }
    }

    logStage("wait_local_plan_update");
    await waitForTherapistPlan(plan);
    logStage("collect_evidence");
    const evidence = await collectBillingEvidence(event.id, subscriptionId);

    if (shouldOpenPortal) {
      logStage("open_billing_portal");
      const portalButton = await waitForBillingPortalButton(page);
      await portalButton.click();
      await page.waitForURL(/billing\.stripe\.com/, { timeout: 30_000 });
    }

    console.log(
      JSON.stringify({
        planAfterRedirect,
        redirectReturnObserved: true,
        serverSideReconciliationObserved: planAfterRedirect === plan,
        eventProcessed: evidence.webhook?.processing_status === "processed",
        duplicateWebhookAccepted: duplicateWebhookResponse.ok,
        finalPlan: evidence.therapist?.plan,
        invoiceEventProcessed: invoiceEvent
          ? evidence.invoice?.status === "paid"
          : undefined,
        invoiceStatus: evidence.invoice?.status ?? null,
        initialInvoiceAmountCents:
          scenario === "founder" ? checkoutSession.amount_total : undefined,
        founderFirstInvoiceAmountDue,
        founderPaymentMethodRegistered,
        localSubscriptionStatus: evidence.subscription?.status ?? null,
        ok: true,
        plan,
        portalOpened: shouldOpenPortal || undefined,
        scenario,
        stripeSubscriptionStatus: subscription.status,
        webhookDelivery: "local_signed_replay_of_real_stripe_event",
      }),
    );
  }
} finally {
  if (subscriptionId && !shouldKeepSubscription) {
    await stripe.subscriptions.cancel(subscriptionId).catch(() => undefined);
  }
  if (hostedCheckoutSessionId) {
    await stripe.checkout.sessions
      .expire(hostedCheckoutSessionId)
      .catch(() => undefined);
  }

  if (browser) await browser.close();
}

function logStage(stage) {
  console.log(JSON.stringify({ plan, scenario, stage }));
}

function normalizePaidPlan(value) {
  if (value === "premium" || value === "premium_plus") return value;

  console.error("PAYMENTS_E2E_PLAN must be premium or premium_plus.");
  process.exit(1);
}

function normalizeScenario(value) {
  if (
    value === "approved" ||
    value === "declined" ||
    value === "canceled" ||
    value === "founder" ||
    value === "hosted"
  ) {
    return value;
  }

  console.error(
    "PAYMENTS_E2E_SCENARIO must be approved, declined, canceled, founder or hosted.",
  );
  process.exit(1);
}

async function exerciseFounderPromotionReplacement(page) {
  const input = page.locator("#tes-promotion-code");
  await input.fill("TERAPEUTAFUNDADOR");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByText("Código aplicado").waitFor({ timeout: 30_000 });
  await page
    .getByText(/Seus 3 primeiros meses ficam grátis/i)
    .waitFor({ timeout: 30_000 });
  await page.getByText("R$ 0,00", { exact: true }).waitFor({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Aplicar" }).waitFor({
    timeout: 30_000,
  });
  await input.fill("TERAPEUTAFUNDADOR");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByText("Código aplicado").waitFor({ timeout: 30_000 });
  await page
    .getByText(/Seus 3 primeiros meses ficam grátis/i)
    .waitFor({ timeout: 30_000 });
  await page
    .locator("#subscription-embedded-checkout iframe")
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
}

async function fillStripeCard(page, cardNumber) {
  await fillStripeField(
    page,
    /Card number|Numero do cartao|Número do cartão/i,
    cardNumber,
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

async function cancelStripeCheckout(page) {
  const locator =
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByRole("link", { name: /Cancelar e voltar/i }).first(),
    )) ??
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope
        .getByRole("link", {
          name: /Voltar|Return|Cancelar|Cancel|Back|Terapeuta/i,
        })
        .first(),
    )) ??
    (await findFirstSelectorInPageOrFrames(page, [
      'a[href*="checkout=canceled"]',
      'a[href*="/terapeuta/checkout"]',
    ]));

  if (!locator) throw new Error("stripe_cancel_link_not_found");

  await locator.click({ timeout: 15_000 });
}

async function expectStripeDecline(page) {
  const deadline = Date.now() + 30_000;
  const errorText =
    /declined|recusad|cartao foi recusado|cartão foi recusado|Your card was declined/i;

  while (Date.now() < deadline) {
    const errorLocator = await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByText(errorText).first(),
    );
    if (errorLocator) return;
    await delay(500);
  }

  await page.screenshot({
    fullPage: true,
    path: `test-results/payments-subscription-approved/${plan}-${scenario}-decline-timeout.png`,
  });
  throw new Error("stripe_decline_message_not_visible");
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
    (await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByRole("button", { name: label }).first(),
    )) ??
    (await findFirstSelectorInPageOrFrames(page, [
      '[data-testid="hosted-payment-submit-button"]',
    ])) ??
    (await findFirstEnabledButtonInPageOrFrames(page));

  if (!locator) throw new Error("stripe_submit_button_not_found");
  await locator.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await locator.click({ timeout: 15_000 });
}

async function waitForBillingPortalButton(page) {
  const deadline = Date.now() + 60_000;
  const locator = page.getByRole("button", { name: "Gerenciar assinatura" });

  while (Date.now() < deadline) {
    await page.reload({ waitUntil: "networkidle" });
    if (await locator.isVisible().catch(() => false)) return locator;
    await delay(2000);
  }

  throw new Error("billing_portal_button_not_visible_after_webhook");
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
  return waitForStripeEvent("checkout.session.completed", checkoutSessionId);
}

async function waitForStripeEvent(type, objectId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const events = await stripe.events.list({
      limit: 20,
      type,
    });
    const event = events.data.find(
      (item) => item.data?.object?.id === objectId,
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

async function assertTherapistPlan(expectedPlan, stage) {
  const actualPlan = await readTherapistPlan();
  if (actualPlan !== expectedPlan) {
    throw new Error(`unexpected_plan:${stage}:${actualPlan}`);
  }
}

async function readTherapistPlan() {
  const rows = await supabaseAdmin(
    `/rest/v1/therapist_profiles?select=plan&user_id=eq.${encodeURIComponent(
      await therapistUserId(),
    )}&limit=1`,
  );
  return rows[0]?.plan ?? null;
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

async function cancelExistingE2EStripeSubscriptions() {
  const userId = await therapistUserId();
  const [therapist] = await supabaseAdmin(
    `/rest/v1/therapist_profiles?select=id&user_id=eq.${encodeURIComponent(
      userId,
    )}&limit=1`,
  );

  if (!therapist?.id) return;

  const customers = await supabaseAdmin(
    `/rest/v1/stripe_customers?select=stripe_customer_id&therapist_profile_id=eq.${encodeURIComponent(
      therapist.id,
    )}&role=eq.therapist`,
  );

  for (const customer of customers) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripe_customer_id,
      limit: 100,
      status: "all",
    });

    for (const subscription of subscriptions.data) {
      if (
        subscription.status === "canceled" ||
        subscription.status === "incomplete_expired" ||
        subscription.metadata?.system !== "tes" ||
        subscription.metadata?.tes_therapist_id !== therapist.id
      ) {
        continue;
      }

      await stripe.subscriptions.cancel(subscription.id).catch(() => undefined);
    }
  }
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

function getStripeObjectId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}
