#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import Stripe from "stripe";
import { chromium } from "playwright";

import { parseNetscapeCookieJar } from "../homologation/zoom-hml.mjs";

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

const args = new Set(process.argv.slice(2));
const scenario = readArg("scenario", "approved");
const target = readArg("target", "hml");
const isLocalTarget = target === "local";
const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL?.trim() ??
  (isLocalTarget ? "http://127.0.0.1:3000" : "https://hml.terapeutaeusou.com.br");
const vercelCookieFile =
  process.env.PAYMENTS_HML_VERCEL_COOKIE_FILE?.trim() || null;
const expectedHmlRef =
  process.env.PAYMENTS_HML_SUPABASE_REF?.trim() || "emzwqkmrryuqvqiohqnu";
const publicTherapistSlug =
  (isLocalTarget
    ? process.env.PAYMENTS_LOCAL_PUBLIC_THERAPIST_SLUG?.trim()
    : process.env.PAYMENTS_HML_PUBLIC_THERAPIST_SLUG?.trim()) ??
  "antonio-ferrari-e2e";
const requestedSlot = process.env.PAYMENTS_HML_SLOT?.trim() || null;
const patientEmail = (isLocalTarget
  ? process.env.PAYMENTS_LOCAL_PATIENT_EMAIL
  : process.env.PAYMENTS_HML_PATIENT_EMAIL)?.trim();
const patientPassword = (isLocalTarget
  ? process.env.PAYMENTS_LOCAL_PATIENT_PASSWORD
  : process.env.PAYMENTS_HML_PATIENT_PASSWORD)?.trim();
const promotionCode = process.env.PAYMENTS_HML_PROMOTION_CODE?.trim() || null;
const supabaseUrl = getTargetSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
const stripeSecretKey = getStripeSecretKey();
const stripeWebhookSecret =
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;

if (
  ![
    "approved",
    "declined",
    "expired",
    "refund",
    "promotion_approved",
    "boleto_approved",
    "boleto_expired",
  ].includes(scenario)
) {
  console.error(
    "Use --scenario=approved, declined, expired, refund, promotion_approved, boleto_approved or boleto_expired.",
  );
  process.exit(1);
}

if (!isLocalTarget && target !== "hml") {
  console.error("Use --target=local or --target=hml.");
  process.exit(1);
}

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseAnonKey,
  PAYMENTS_HML_PATIENT_EMAIL: patientEmail,
  PAYMENTS_HML_PATIENT_PASSWORD: patientPassword,
  STRIPE_SECRET_KEY: stripeSecretKey,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  SUPABASE_URL: supabaseUrl,
})) {
  if (!value) {
    console.error(`${name} is required for session checkout homologation.`);
    process.exit(1);
  }
}

if (!stripeSecretKey.startsWith("sk_test_")) {
  console.error("Use Stripe test mode for session checkout validation.");
  process.exit(1);
}

assertStripeModeAllowedForSupabaseUrl({
  stripeMode: getStripeMode(stripeSecretKey),
  supabaseUrl,
});

if (!isLocalTarget && supabaseProjectRef(supabaseUrl) !== expectedHmlRef) {
  console.error(
    `Session checkout HML requires Supabase ref ${expectedHmlRef}; found ${supabaseProjectRef(supabaseUrl) ?? "unknown"}.`,
  );
  process.exit(1);
}

if (isLocalTarget && !isLocalSupabaseUrl(supabaseUrl)) {
  console.error("Local session checkout requires a local Supabase URL.");
  process.exit(1);
}

if (scenario === "promotion_approved" && !promotionCode) {
  console.error(
    "PAYMENTS_HML_PROMOTION_CODE is required for promotion_approved.",
  );
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});

let browser;
let checkoutSessionId = null;

try {
  logStage("resolve_public_fixture");
  const fixture = await getPublicFixture(publicTherapistSlug, requestedSlot);
  const reservationPath = buildReservationPath(fixture, requestedSlot);

  logStage("launch_browser");
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: { dir: `test-results/payments-session-${scenario}` },
  });
  if (vercelCookieFile) {
    const cookies = await readVercelCookies(vercelCookieFile);
    await context.addCookies(cookies);
  }
  const page = await context.newPage();

  logStage("patient_login");
  await page.goto(
    buildAppUrl(
      baseUrl,
      `/cliente/login?next=${encodeURIComponent(reservationPath)}`,
    ),
  );
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.locator('input[name="password"]').fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(new RegExp(`/reserva\\?`), { timeout: 30_000 });

  logStage("accept_terms_and_start_checkout");
  const prepareForm = page.locator("form").filter({
    has: page.locator('input[name="terms"]'),
  });
  await prepareForm.locator('input[name="terms"]').check();
  const [checkoutResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/public/reservation/checkout") &&
        response.request().method() === "POST",
      { timeout: 45_000 },
    ),
    prepareForm
      .getByRole("button", { name: /Avançar para pagamento/i })
      .click(),
  ]);

  await page
    .locator("#reservation-embedded-checkout iframe")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });

  const checkoutPayload = await checkoutResponse.json();
  if (!checkoutPayload?.ok || !checkoutPayload.checkout?.checkoutSessionId) {
    throw new Error(`checkout_creation_failed:${checkoutResponse.status()}`);
  }

  checkoutSessionId = checkoutPayload.checkout.checkoutSessionId;

  if (scenario === "boleto_approved" || scenario === "boleto_expired") {
    await runBoletoScenario(page, checkoutSessionId);
    process.exit(0);
  }

  if (scenario === "expired") {
    logStage("expire_checkout_session");
    await stripe.checkout.sessions.expire(checkoutSessionId);
    const event = await waitForStripeEvent({
      objectId: checkoutSessionId,
      type: "checkout.session.expired",
    });
    await postSignedStripeEventTwice(event);
    await waitForSessionPayment(checkoutSessionId, "canceled");
    printEvidence({
      checkoutSessionId,
      finalStatus: "canceled",
      ok: true,
      scenario,
    });
    process.exit(0);
  }

  if (scenario === "declined") {
    logStage("fill_declined_card");
    await fillStripeCard(page, "4000000000000002");
    await expectStripeDecline(page);
    const paymentIntentId = await waitForCheckoutPaymentIntent(checkoutSessionId);
    const event = await waitForStripeEvent({
      objectId: paymentIntentId,
      type: "payment_intent.payment_failed",
    });
    await postSignedStripeEventTwice(event);
    await waitForSessionPayment(checkoutSessionId, "failed");
    printEvidence({
      checkoutSessionId,
      finalStatus: "failed",
      ok: true,
      scenario,
    });
    process.exit(0);
  }

  if (scenario === "promotion_approved") {
    logStage("apply_promotion_code");
    await fillStripePromotionCode(page, promotionCode);
  }

  logStage("fill_approved_card");
  await fillStripeCard(page, "4242424242424242");
  const checkoutCompletion = await waitForCheckoutCompletion(
    page,
    checkoutSessionId,
  );

  const successUrl = new URL(page.url());
  const returnedSessionId = successUrl.searchParams.get("session_id");
  if (
    checkoutCompletion === "redirected" &&
    returnedSessionId !== checkoutSessionId
  ) {
    throw new Error("checkout_session_mismatch_after_redirect");
  }

  const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  if (checkout.livemode !== false) {
    throw new Error("stripe_live_mode_detected");
  }
  if (checkout.payment_status !== "paid") {
    throw new Error(`stripe_checkout_not_paid:${checkout.payment_status}`);
  }

  const discountAmountCents = checkout.total_details?.amount_discount ?? 0;
  if (scenario === "promotion_approved") {
    if (
      !checkout.amount_subtotal ||
      checkout.amount_total === null ||
      discountAmountCents <= 0 ||
      checkout.amount_total >= checkout.amount_subtotal
    ) {
      throw new Error("stripe_promotion_discount_not_applied");
    }
  } else if (
    checkout.amount_subtotal !== null &&
    checkout.amount_total !== null &&
    (checkout.amount_total !== checkout.amount_subtotal || discountAmountCents !== 0)
  ) {
    throw new Error("unexpected_discount_without_promotion_code");
  }

  const checkoutEvent = await waitForStripeEvent({
    objectId: checkoutSessionId,
    type: "checkout.session.completed",
  });
  await postSignedStripeEventTwice(checkoutEvent);

  const paymentIntentId =
    typeof checkout.payment_intent === "string"
      ? checkout.payment_intent
      : checkout.payment_intent?.id;
  if (!paymentIntentId) throw new Error("payment_intent_missing");

  const paymentIntentEvent = await waitForStripeEvent({
    objectId: paymentIntentId,
    type: "payment_intent.succeeded",
  });
  await postSignedStripeEventTwice(paymentIntentEvent);

  const paidPayment = await waitForSessionPayment(checkoutSessionId, "paid");

  if (scenario === "refund") {
    logStage("create_refund");
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
    });
    const chargeId = paidPayment.stripe_charge_id;
    const refundEvent = await waitForStripeEvent({
      objectId: chargeId,
      type: "charge.refunded",
    });
    await postSignedStripeEventTwice(refundEvent);
    const refundedPayment = await waitForAnySessionPaymentStatus(
      checkoutSessionId,
      ["refunded", "partially_refunded"],
    );
    printEvidence({
      checkoutSessionId,
      finalStatus: refundedPayment.financial_status,
      ok: true,
      refundId: maskStripeId(refund.id),
      scenario,
    });
    process.exit(0);
  }

  printEvidence({
    actualAmountCents: checkout.amount_total,
    bookingId: paidPayment.booking_id,
    commissionCents: paidPayment.platform_gross_commission_cents,
    checkoutSessionId,
    checkoutCompletion,
    discountAmountCents,
    finalStatus: paidPayment.financial_status,
    livemode: checkout.livemode,
    ok: true,
    originalAmountCents: checkout.amount_subtotal,
    paymentGrossAmountCents: paidPayment.gross_amount_cents,
    paymentMetadata: paidPayment.metadata?.stripe_checkout ?? null,
    therapistAmountCents: paidPayment.therapist_amount_cents,
    scenario,
    webhookEvents: ["checkout.session.completed", "payment_intent.succeeded"],
    webhookDelivery: "signed_replay_of_real_stripe_events",
  });
} finally {
  if (browser) await browser.close();
}

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function logStage(stage) {
  console.log(JSON.stringify({ scenario, stage }));
}

function printEvidence(payload) {
  console.log(
    JSON.stringify({
      ...payload,
      checkoutSessionId: maskStripeId(payload.checkoutSessionId),
    }),
  );
}

async function getPublicFixture(slug, slotOverride) {
  const [fixture] = await supabaseAdmin(
    `/rest/v1/public_therapist_search?select=slug,public_name,service_id,therapy_slug,next_slot_at&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  if (!fixture?.service_id || (!fixture?.next_slot_at && !slotOverride)) {
    throw new Error(`public_fixture_not_ready:${slug}`);
  }
  return fixture;
}

function buildReservationPath(fixture, slotOverride) {
  const slot = slotOverride ?? fixture.next_slot_at;
  if (!slot || !Number.isFinite(Date.parse(slot))) {
    throw new Error("reservation_slot_invalid");
  }
  const params = new URLSearchParams({
    etapa: "preparar",
    service: fixture.service_id,
    slot: new Date(slot).toISOString(),
    source: "stripe_phase3_hml",
    therapist: fixture.slug,
  });
  if (fixture.therapy_slug) params.set("therapy", fixture.therapy_slug);
  return `/reserva?${params.toString()}`;
}

function buildAppUrl(sharedBaseUrl, target) {
  const base = new URL(sharedBaseUrl);
  const url = new URL(target, `${base.origin}/`);
  const share = base.searchParams.get("_vercel_share");
  if (share) url.searchParams.set("_vercel_share", share);
  return url.toString();
}

async function readVercelCookies(filePath) {
  try {
    const cookies = parseNetscapeCookieJar(await readFile(filePath, "utf8"));
    if (cookies.length === 0) throw new Error("empty");
    return cookies;
  } catch {
    throw new Error("vercel_cookie_file_unreadable");
  }
}

async function fillStripeCard(page, cardNumber) {
  await fillStripeField(page, /Card number|Numero do cartao|Número do cartão/i, cardNumber, [
    'input[name="cardnumber"]',
    'input[autocomplete="cc-number"]',
    'input[data-elements-stable-field-name="cardNumber"]',
  ]);
  await fillStripeField(page, /Expiration|Validade|MM\s*\/\s*YY|MM\s*\/\s*AA/i, "1234", [
    'input[name="expiry"]',
    'input[autocomplete="cc-exp"]',
    'input[data-elements-stable-field-name="cardExpiry"]',
  ]);
  await fillStripeField(page, /CVC|Codigo de seguranca|Código de segurança/i, "123", [
    'input[name="cvc"]',
    'input[autocomplete="cc-csc"]',
    'input[data-elements-stable-field-name="cardCvc"]',
  ]);
  await fillOptionalStripeField(page, /Name on card|Nome no cartao|Nome no cartão|Nome/i, "Homologacao TES", [
    'input[name="billingName"]',
    'input[autocomplete="cc-name"]',
  ]);
  await fillOptionalStripeField(page, /ZIP|Postal|CEP/i, "01001000", [
    'input[name="postalCode"]',
    'input[autocomplete="postal-code"]',
    'input[data-elements-stable-field-name="postalCode"]',
  ]);
  await clickStripeButton(page, /Pay|Pagar|Finalizar|Confirmar/i);
}

async function fillStripePromotionCode(page, code) {
  const existingInput = await findLocatorInPageOrFrames(page, (scope) =>
    scope.getByLabel(/Promotion code|Código promocional|Codigo promocional|Cupom/i).first(),
  );

  if (!existingInput) {
    const addCode = await findLocatorInPageOrFrames(page, (scope) =>
      scope.getByText(/Add (?:a )?promotion code|Add code|Adicionar código(?: promocional)?|Adicionar codigo(?: promocional)?|Have a promotion code|Tem um código promocional/i).first(),
    );
    if (!addCode) {
      const visibleFrameText = [];
      for (const scope of [page, ...page.frames()]) {
        const text = await scope.locator("body").innerText().catch(() => "");
        if (text.trim()) visibleFrameText.push(text.replace(/\s+/g, " ").slice(0, 500));
      }
      console.log(JSON.stringify({
        code: "stripe_promotion_code_control_not_visible",
        visibleFrameText,
      }));
      throw new Error("stripe_promotion_code_control_not_visible");
    }
    await addCode.click({ timeout: 15_000 });
  }

  await fillStripeField(
    page,
    /Promotion code|Código promocional|Codigo promocional|Cupom/i,
    code,
    [
      'input[name="promotionCode"]',
      'input[name="promotion_code"]',
      'input[autocomplete="off"]',
    ],
  );
  await clickStripeButton(page, /Apply|Aplicar/i);

  const appliedCode = await findLocatorInPageOrFrames(page, (scope) =>
    scope.getByText(code, { exact: false }).first(),
  );
  if (!appliedCode) throw new Error("stripe_promotion_code_not_visible_after_apply");
}

async function runBoletoScenario(page, checkoutSessionId) {
  const expectedEmailSuffix =
    scenario === "boleto_approved"
      ? "succeed_immediately@"
      : "expire_immediately@";
  if (!patientEmail.toLowerCase().includes(expectedEmailSuffix)) {
    throw new Error(`boleto_test_email_required:${expectedEmailSuffix}...`);
  }

  logStage("select_boleto");
  await selectStripePaymentMethod(page, /Boleto/i);
  await fillStripeBoleto(page);

  const checkoutCompletedEventPromise = waitForStripeEvent({
    objectId: checkoutSessionId,
    type: "checkout.session.completed",
  });
  await clickStripeButton(page, /Pay|Pagar|Finalizar|Confirmar/i);
  const checkoutCompletedEvent = await checkoutCompletedEventPromise;
  await postSignedStripeEventTwice(checkoutCompletedEvent);

  const paymentIntentId = await waitForCheckoutPaymentIntent(checkoutSessionId);
  const paymentIntentEvent = await waitForStripeEvent({
    objectId: paymentIntentId,
    type:
      scenario === "boleto_approved"
        ? "payment_intent.succeeded"
        : "payment_intent.payment_failed",
  });
  await postSignedStripeEventTwice(paymentIntentEvent);

  const asyncCheckoutEvent = await waitForStripeEvent({
    objectId: checkoutSessionId,
    type:
      scenario === "boleto_approved"
        ? "checkout.session.async_payment_succeeded"
        : "checkout.session.async_payment_failed",
  });
  await postSignedStripeEventTwice(asyncCheckoutEvent);

  const expectedStatus =
    scenario === "boleto_approved" ? "paid" : "failed";
  const payment = await waitForSessionPayment(checkoutSessionId, expectedStatus);
  printEvidence({
    bookingId: payment.booking_id,
    checkoutSessionId,
    finalStatus: payment.financial_status,
    ok: true,
    scenario,
    webhookDelivery: "signed_replay_of_real_stripe_events",
  });
}

async function selectStripePaymentMethod(page, label) {
  const locator = await findLocatorInPageOrFrames(page, (scope) =>
    scope.getByText(label).first(),
  );
  if (!locator) throw new Error("stripe_boleto_option_not_visible");
  await locator.click({ timeout: 15_000 });
}

async function fillStripeBoleto(page) {
  await fillOptionalStripeField(
    page,
    /CPF|CNPJ|Tax ID|documento/i,
    "00000000000",
    [
      'input[name="taxId"]',
      'input[name="tax_id"]',
      'input[autocomplete="tax-id"]',
    ],
  );
  await fillOptionalStripeField(
    page,
    /Address|Endereço|Endereco|Rua/i,
    "Rua de Homologacao, 100",
    ['input[name="line1"]', 'input[autocomplete="address-line1"]'],
  );
  await fillOptionalStripeField(
    page,
    /City|Cidade/i,
    "Sao Paulo",
    ['input[name="city"]', 'input[autocomplete="address-level2"]'],
  );
  await fillOptionalStripeField(
    page,
    /State|Estado/i,
    "SP",
    ['input[name="state"]', 'input[autocomplete="address-level1"]'],
  );
  await fillOptionalStripeField(
    page,
    /ZIP|CEP|Postal/i,
    "01001000",
    ['input[name="postalCode"]', 'input[autocomplete="postal-code"]'],
  );
}

async function expectStripeDecline(page) {
  const deadline = Date.now() + 45_000;
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
    path: `test-results/payments-session-${scenario}/decline-timeout.png`,
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
      'button[type="submit"]',
      '[data-testid="hosted-payment-submit-button"]',
    ])) ??
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

async function waitForCheckoutPaymentIntent(sessionId) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId =
      typeof checkout.payment_intent === "string"
        ? checkout.payment_intent
        : checkout.payment_intent?.id;
    if (paymentIntentId) return paymentIntentId;
    await delay(2000);
  }
  throw new Error("payment_intent_not_attached_to_checkout");
}

async function waitForCheckoutCompletion(page, sessionId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (/\/reserva\/sucesso\?.*session_id=/.test(page.url())) {
      return "redirected";
    }

    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkout.status === "complete" && checkout.payment_status === "paid") {
      return "stripe_confirmed";
    }
    await delay(2000);
  }

  throw new Error("stripe_checkout_completion_not_confirmed");
}

async function waitForStripeEvent({ objectId, type }) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const events = await stripe.events.list({ limit: 30, type });
    const event = events.data.find((item) => item.data?.object?.id === objectId);
    if (event) return event;
    await delay(3000);
  }
  throw new Error(`stripe_event_not_found:${type}`);
}

async function postSignedStripeEventTwice(event) {
  const firstResponse = await postSignedStripeEvent(event);
  const duplicateResponse = await postSignedStripeEvent(event);
  if (!firstResponse.ok && !duplicateResponse.ok) {
    throw new Error(
      `webhook_failed:${event.type}:${firstResponse.status}:${duplicateResponse.status}`,
    );
  }
  if (!firstResponse.ok || !duplicateResponse.ok) {
    logStage("webhook_concurrent_delivery_recovered");
  }
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

async function waitForSessionPayment(checkoutSessionId, expectedStatus) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const [payment] = await getSessionPayment(checkoutSessionId);
    if (payment?.financial_status === expectedStatus) return payment;
    await delay(2000);
  }
  throw new Error(`session_payment_not_updated:${expectedStatus}`);
}

async function waitForAnySessionPaymentStatus(checkoutSessionId, statuses) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const [payment] = await getSessionPayment(checkoutSessionId);
    if (payment && statuses.includes(payment.financial_status)) return payment;
    await delay(2000);
  }
  throw new Error(`session_payment_not_updated:${statuses.join("|")}`);
}

function getSessionPayment(checkoutSessionId) {
  return supabaseAdmin(
    `/rest/v1/session_payments?select=id,booking_id,financial_status,stripe_charge_id,stripe_payment_intent_id,stripe_checkout_session_id,gross_amount_cents,platform_gross_commission_cents,therapist_amount_cents,metadata&stripe_checkout_session_id=eq.${encodeURIComponent(checkoutSessionId)}&limit=1`,
  );
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

function maskStripeId(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function getTargetSupabaseUrl() {
  const explicit =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";

  return (explicit || getSupabaseUrl()).replace(/\/+$/g, "");
}

function supabaseProjectRef(value) {
  try {
    const host = new URL(value).host;
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(value);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
