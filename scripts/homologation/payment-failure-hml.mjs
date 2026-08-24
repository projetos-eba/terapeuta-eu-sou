#!/usr/bin/env node

import { createHmac } from "node:crypto";
import process from "node:process";
import Stripe from "stripe";
import { chromium } from "playwright";

import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeSecretKey,
  loadEnvFiles,
} from "../payments/env-utils.mjs";

loadEnvFiles();

const baseUrl = requireHmlShare(process.env.PLAYWRIGHT_HML_BASE_URL);
const supabaseUrl = "https://emzwqkmrryuqvqiohqnu.supabase.co";
const adminEmail = required("PAYMENTS_HML_ADMIN_EMAIL");
const adminPassword = required("PAYMENTS_HML_ADMIN_PASSWORD");
const patientEmail = required("PAYMENTS_HML_PATIENT_EMAIL");
const patientPassword = required("PAYMENTS_HML_PATIENT_PASSWORD");
const webhookSecret =
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET ??
  process.env.STRIPE_WEBHOOK_SECRET;
const stripeSecretKey = getStripeSecretKey();

if (!webhookSecret || !stripeSecretKey) {
  throw new Error("hml_payment_failure_runtime_incomplete");
}
if (!stripeSecretKey.startsWith("sk_test_")) {
  throw new Error("stripe_test_mode_required");
}
assertStripeModeAllowedForSupabaseUrl({
  stripeMode: "test",
  supabaseUrl,
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});
let browser;

try {
  const adminToken = await loginAdmin();
  const fixture = await harness(adminToken, { action: "find_clean" });
  if (!fixture?.slot?.startsAt || !fixture?.service?.id) {
    throw new Error("hml_fixture_not_clean");
  }

  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const reservationPath = buildReservationPath(fixture);

  await page.goto(sharedUrl(`/cliente/login?next=${encodeURIComponent(reservationPath)}`), {
    waitUntil: "domcontentloaded",
  });
  await page.locator('input[name="email"], input[type="email"]').first().fill(patientEmail);
  await page.locator('input[name="password"], input[type="password"]').first().fill(patientPassword);
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL((url) => url.pathname === "/reserva", { timeout: 45_000 });

  await page.goto(sharedUrl(reservationPath), { waitUntil: "domcontentloaded" });
  const terms = page.locator('input[name="terms"]');
  await terms.check();
  const [checkoutResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/public/reservation/checkout" &&
        response.request().method() === "POST",
      { timeout: 45_000 },
    ),
    page
      .locator("form")
      .getByRole("button", { name: /Avançar para pagamento/i })
      .click(),
  ]);
  const checkoutPayload = await checkoutResponse.json();
  const checkoutSessionId = checkoutPayload?.checkout?.checkoutSessionId;
  if (!checkoutPayload?.ok || typeof checkoutSessionId !== "string") {
    throw new Error("checkout_session_not_created");
  }

  const scenario = process.argv.includes("--scenario=declined")
    ? "declined"
    : "expired";
  let event;
  if (scenario === "expired") {
    await stripe.checkout.sessions.expire(checkoutSessionId);
    event = await waitForStripeEvent(
      checkoutSessionId,
      "checkout.session.expired",
    );
  } else {
    await page.locator("#reservation-embedded-checkout iframe").first().waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await fillDeclinedCard(page);
    const paymentIntentId = await waitForPaymentIntent(checkoutSessionId);
    event = await waitForStripeEvent(
      paymentIntentId,
      "payment_intent.payment_failed",
    );
  }

  const first = await postSignedEvent(event);
  const duplicate = await postSignedEvent(event);
  const final = await waitForBookingState(
    adminToken,
    checkoutSessionId,
    scenario === "expired" ? "canceled" : "failed",
  );

  console.log(
    JSON.stringify({
      booking: {
        paymentStatus: final?.booking?.payment_status ?? null,
        status: final?.booking?.status ?? null,
      },
      checkout: {
        livemode: false,
        scenario,
      },
      fixture: {
        durationMinutes: fixture.service.durationMinutes,
        priceCents: fixture.service.priceCents,
        timezone: fixture.slot.timezone,
      },
      webhook: {
        duplicateStatus: duplicate.status,
        firstStatus: first.status,
        signedReplayConfirmed: first.ok && duplicate.ok,
      },
    }),
  );
} finally {
  await browser?.close();
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name.toLowerCase()}_missing`);
  return value;
}

function requireHmlShare(raw) {
  const value = new URL(raw ?? "");
  if (
    value.hostname !== "hml.terapeutaeusou.com.br" ||
    !value.searchParams.get("_vercel_share")
  ) {
    throw new Error("hml_vercel_share_url_required");
  }
  return value;
}

function sharedUrl(path) {
  const url = new URL(path, baseUrl.origin);
  url.searchParams.set("_vercel_share", baseUrl.searchParams.get("_vercel_share"));
  return url.toString();
}

function buildReservationPath(fixture) {
  const url = new URL("/reserva", baseUrl.origin);
  url.searchParams.set("etapa", "preparar");
  url.searchParams.set("service", fixture.service.id);
  url.searchParams.set("slot", new Date(fixture.slot.startsAt).toISOString());
  url.searchParams.set("source", "phase2_1_payment_failure");
  url.searchParams.set("therapist", "antonio-ferrari-e2e");
  return `${url.pathname}${url.search}`;
}

async function loginAdmin() {
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-auth-login`, {
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || typeof body.accessToken !== "string") {
    throw new Error("hml_admin_login_failed");
  }
  return body.accessToken;
}

async function harness(token, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-hml-preflight`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) {
    throw new Error("hml_harness_request_failed");
  }
  return payload.data;
}

async function waitForBookingState(token, checkoutSessionId, status) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const snapshot = await harness(token, {
      action: "inspect",
      checkoutSessionId,
    });
    if (
      snapshot?.payment?.financialStatus === status &&
      snapshot?.booking?.status === "cancelled_by_payment" &&
      snapshot?.booking?.payment_status ===
        (status === "canceled" ? "cancelled" : "failed")
    ) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("hml_booking_failure_state_timeout");
}

async function waitForPaymentIntent(sessionId) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const id = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("payment_intent_not_created");
}

async function waitForStripeEvent(objectId, type) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const events = await stripe.events.list({ limit: 50, type });
    const event = events.data.find((candidate) => candidate.data?.object?.id === objectId);
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`stripe_event_not_found:${type}`);
}

async function postSignedEvent(event) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return fetch(`${supabaseUrl}/functions/v1/stripe-billing-webhook`, {
    body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    method: "POST",
  });
}

async function fillDeclinedCard(page) {
  await fillStripeField(page, "4000000000000002", [
    'input[name="cardnumber"]',
    'input[autocomplete="cc-number"]',
  ]);
  await fillStripeField(page, "1234", [
    'input[name="expiry"]',
    'input[autocomplete="cc-exp"]',
  ]);
  await fillStripeField(page, "123", [
    'input[name="cvc"]',
    'input[autocomplete="cc-csc"]',
  ]);
  const button = page
    .getByRole("button", { name: /Pagar|Finalizar|Confirmar|Pay/i })
    .last();
  await button.click().catch(async () => {
    await page.locator('button[type="submit"]').last().click();
  });
}

async function fillStripeField(page, value, selectors) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      for (const selector of selectors) {
        const input = frame.locator(selector).first();
        if ((await input.count().catch(() => 0)) > 0 && await input.isVisible().catch(() => false)) {
          await input.fill(value);
          return;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("stripe_field_not_found");
}
