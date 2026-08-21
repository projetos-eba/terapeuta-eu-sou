#!/usr/bin/env node

import process from "node:process";

import { chromium } from "playwright";

const baseUrl = requireHmlShare(process.env.PLAYWRIGHT_HML_BASE_URL);
const patient = credentials("PATIENT");
const admin = credentials("ADMIN");
const supabaseUrl = "https://emzwqkmrryuqvqiohqnu.supabase.co";
const evidence = [];
let adminAccessToken = null;
let browser = null;
let activePage = null;
let browserRuntimeEvidence = null;

try {
  adminAccessToken = await loginAdminForEvidence();
  const fixture = await hmlHarness({ action: "find_clean" });
  assertCleanFixture(fixture);
  stage("fixture_clean", {
    durationMinutes: fixture.service.durationMinutes,
    priceCents: fixture.service.priceCents,
    runId: fixture.runId,
    timezone: fixture.slot.timezone,
  });

  browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext();
  const page = await context.newPage();
  activePage = page;
  browserRuntimeEvidence = attachBrowserEvidence(page);
  try {
    await loginPatient(page);
    const checkoutSessionId = await beginCheckout(page, fixture);
    const before = await hmlHarness({ action: "inspect", checkoutSessionId });
    assertCheckoutConfiguration(before?.stripeCheckout);
    stage("checkout_return_config", sanitizeCheckout(before.stripeCheckout));

    await page
      .locator("#reservation-embedded-checkout iframe")
      .first()
      .waitFor({
        state: "attached",
        timeout: 90_000,
      });
    stage("embedded_checkout_render", await checkoutFormEvidence(page));

    await fillRequiredCardFields(page);
    await clickCheckoutSubmit(page);
    const initialOutcome = await waitForCheckoutOutcome(page, 8_000);
    const afterInitialSubmit = await checkoutFormEvidence(page);
    evidence.push({
      ...afterInitialSubmit,
      name: "initial_payment_interaction",
      outcome: initialOutcome,
      status: "PASS",
    });

    if (initialOutcome !== "redirected") {
      await fillSupplementalFields(page);
      const formAfterSupplemental = await checkoutFormEvidence(page);
      if (formAfterSupplemental.requiredEmptyCount > 0) {
        throw new Error("stripe_form_required_field_unresolved");
      }
      await clickCheckoutSubmit(page);
      const finalOutcome = await waitForCheckoutOutcome(page, 120_000);
      if (finalOutcome !== "redirected") {
        throw new Error("stripe_checkout_not_completed_in_browser");
      }
    }
    if (!new URL(page.url()).pathname.startsWith("/reserva/sucesso")) {
      throw new Error("checkout_return_route_missing");
    }
    stage("payment_interaction");
    stage("redirect_reserva_sucesso");

    const final = await poll(async () => {
      const snapshot = await hmlHarness({
        action: "inspect",
        checkoutSessionId,
      });
      return snapshot?.stripeCheckout?.status === "complete" &&
        snapshot?.stripeCheckout?.paymentStatus === "paid" &&
        snapshot?.payment?.financialStatus === "paid" &&
        snapshot?.booking?.status === "confirmed" &&
        snapshot?.booking?.payment_status === "paid" &&
        snapshot?.webhook?.checkoutCompletedProcessed === true
        ? snapshot
        : null;
    }, 150_000);
    if (!final) throw new Error("authoritative_checkout_not_converged");
    assertFinalState(final, fixture);
    stage(
      "stripe_checkout_final_state",
      sanitizeCheckout(final.stripeCheckout),
    );
    stage("signed_webhook");
    stage("authoritative_payment_paid", {
      currency: final.payment.currency,
      grossAmountCents: final.payment.grossAmountCents,
    });
    stage("booking_confirmation_after_payment");
    evidence.push({
      browser: browserRuntimeEvidence(),
      name: "browser_runtime_evidence",
      status: "PASS",
    });
  } finally {
    await context.close();
  }
} catch (error) {
  const form = activePage
    ? await checkoutFormEvidence(activePage).catch(() => null)
    : null;
  console.log(
    JSON.stringify({
      browser: browserRuntimeEvidence ? browserRuntimeEvidence() : null,
      checkoutForm: form,
      errorCode: sanitize(
        error instanceof Error
          ? error.message
          : "checkout_qualification_failed",
      ),
      ok: false,
    }),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}

if (!process.exitCode) console.log(JSON.stringify({ evidence, ok: true }));

function credentials(role) {
  const email = process.env[`PLAYWRIGHT_HML_${role}_EMAIL`]?.trim();
  const password = process.env.PLAYWRIGHT_HML_PASSWORD;
  if (!email || !password)
    throw new Error(`${role.toLowerCase()}_credentials_missing`);
  return { email, password };
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
  url.searchParams.set(
    "_vercel_share",
    baseUrl.searchParams.get("_vercel_share"),
  );
  return url.toString();
}

async function loginAdminForEvidence() {
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-auth-login`, {
    body: JSON.stringify({ email: admin.email, password: admin.password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body = await response.json();
  if (!response.ok || body?.ok !== true || !body.accessToken)
    throw new Error("admin_evidence_login_failed");
  return body.accessToken;
}

async function hmlHarness(body) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/stripe-hml-preflight`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true)
    throw new Error("hml_harness_request_failed");
  return payload.data;
}

function assertCleanFixture(fixture) {
  if (
    !fixture?.slot?.startsAt ||
    !Object.values(fixture.clean ?? {}).every(Boolean)
  ) {
    throw new Error("fixture_not_clean");
  }
}

async function loginPatient(page) {
  await page.goto(sharedUrl("/cliente/login"), {
    waitUntil: "domcontentloaded",
  });
  await page.locator('input[name="email"]').fill(patient.email);
  await page.locator('input[name="password"]').fill(patient.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname === "/app", { timeout: 30_000 });
}

async function beginCheckout(page, fixture) {
  const reservation = new URL("/reserva", baseUrl.origin);
  reservation.searchParams.set(
    "_vercel_share",
    baseUrl.searchParams.get("_vercel_share"),
  );
  reservation.searchParams.set("etapa", "preparar");
  reservation.searchParams.set("service", fixture.service.id);
  reservation.searchParams.set("slot", fixture.slot.startsAt);
  reservation.searchParams.set("therapist", "antonio-ferrari-e2e");
  await page.goto(reservation.toString(), { waitUntil: "domcontentloaded" });
  await page.locator('input[name="terms"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname ===
          "/api/public/reservation/checkout" &&
        candidate.request().method() === "POST",
      { timeout: 45_000 },
    ),
    page
      .getByRole("button", { name: /Avançar para pagamento/i })
      .first()
      .click(),
  ]);
  const body = await response.json();
  if (!body?.ok || typeof body?.checkout?.checkoutSessionId !== "string")
    throw new Error("checkout_not_created");
  stage("booking_initiated_and_checkout_created");
  return body.checkout.checkoutSessionId;
}

function assertCheckoutConfiguration(checkout) {
  if (
    !checkout ||
    checkout.livemode !== false ||
    checkout.uiMode !== "embedded_page" ||
    checkout.returnPath !== "/reserva/sucesso" ||
    checkout.returnUrlUsesHmlHttps !== true ||
    checkout.redirectOnCompletion !== "always"
  ) {
    throw new Error("checkout_return_config_invalid");
  }
}

function sanitizeCheckout(checkout) {
  return {
    livemode: checkout?.livemode ?? null,
    paymentStatus: checkout?.paymentStatus ?? null,
    redirectOnCompletion: checkout?.redirectOnCompletion ?? null,
    returnPath: checkout?.returnPath ?? null,
    returnUrlUsesHmlHttps: checkout?.returnUrlUsesHmlHttps ?? null,
    status: checkout?.status ?? null,
    uiMode: checkout?.uiMode ?? null,
  };
}

async function fillRequiredCardFields(page) {
  await fillStripeField(
    page,
    /Card number|N.mero do cart.o/i,
    ["input[autocomplete=cc-number]", "input[name=cardnumber]"],
    "4242424242424242",
    true,
  );
  await fillStripeField(
    page,
    /Expiration|Validade|MM\s*\/\s*(YY|AA)/i,
    ["input[autocomplete=cc-exp]", "input[name=expiry]"],
    "1234",
    true,
  );
  await fillStripeField(
    page,
    /CVC|C.digo de seguran.a/i,
    ["input[autocomplete=cc-csc]", "input[name=cvc]"],
    "123",
    true,
  );
}

async function fillSupplementalFields(page) {
  await fillStripeField(
    page,
    /Name on card|Nome no cart.o|Nome/i,
    ["input[autocomplete=cc-name]", "input[name=billingName]"],
    "Homologacao TES",
    false,
  );
  await fillStripeField(
    page,
    /ZIP|Postal|CEP/i,
    ["input[autocomplete=postal-code]", "input[name=postalCode]"],
    "01001000",
    false,
  );
}

async function fillStripeField(page, label, selectors, value, required) {
  const locator = await findInFrames(page, (frame) => [
    frame.getByLabel(label).first(),
    ...selectors.map((selector) => frame.locator(selector).first()),
  ]);
  if (!locator) {
    if (required) throw new Error("stripe_required_field_missing");
    return;
  }
  await locator.fill(value, { timeout: 15_000 });
}

async function clickCheckoutSubmit(page) {
  const button = await findInFrames(page, (frame) => [
    frame
      .getByRole("button", { name: /^(Pagar|Pay|Finalizar|Confirmar)/i })
      .first(),
    frame.locator("button[type=submit]").first(),
  ]);
  if (!button) throw new Error("stripe_submit_missing");
  await button.click({ timeout: 15_000 });
}

async function findInFrames(page, candidatesFor) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      for (const candidate of candidatesFor(frame)) {
        if (
          (await candidate.count().catch(() => 0)) &&
          (await candidate.isVisible().catch(() => false))
        )
          return candidate;
      }
    }
    await delay(250);
  }
  return null;
}

async function waitForCheckoutOutcome(page, timeoutMs) {
  try {
    await page.waitForURL(/\/reserva\/sucesso/, { timeout: timeoutMs });
    return "redirected";
  } catch {
    return "not_redirected";
  }
}

async function checkoutFormEvidence(page) {
  const frames = [];
  for (const frame of page.frames()) {
    if (!/stripe\.com/.test(frame.url())) continue;
    const diagnostics = await frame
      .locator("input, select, [role=alert]")
      .evaluateAll((elements) =>
        elements.slice(0, 30).map((element) => ({
          ariaLabel: element.getAttribute("aria-label"),
          autocomplete: element.getAttribute("autocomplete"),
          required: "required" in element ? Boolean(element.required) : false,
          role: element.getAttribute("role"),
          tag: element.tagName.toLowerCase(),
          text:
            element.getAttribute("role") === "alert"
              ? element.textContent?.replace(/\s+/g, " ").trim().slice(0, 200)
              : null,
          valueMissing:
            "validity" in element
              ? Boolean(element.validity?.valueMissing)
              : false,
        })),
      );
    frames.push(diagnostics);
  }
  const flat = frames.flat();
  return {
    errorMessages: flat
      .filter((entry) => entry.role === "alert")
      .map((entry) => entry.text)
      .filter(Boolean),
    fieldKinds: flat
      .filter((entry) => entry.tag !== "div")
      .map(({ ariaLabel, autocomplete, required, tag, valueMissing }) => ({
        ariaLabel,
        autocomplete,
        required,
        tag,
        valueMissing,
      })),
    requiredEmptyCount: flat.filter(
      (entry) => entry.required && entry.valueMissing,
    ).length,
  };
}

function attachBrowserEvidence(page) {
  const consoleEvents = [];
  const network = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      consoleEvents.push({
        type: message.type(),
        text: sanitize(message.text()),
      });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.hostname.endsWith("stripe.com") ||
      url.pathname === "/api/public/reservation/checkout"
    )
      network.push({
        host: url.hostname,
        path: sanitizePath(url.pathname),
        status: response.status(),
      });
  });
  return () => ({
    consoleEvents: consoleEvents.slice(-20),
    network: network.slice(-40),
  });
}

function sanitize(value) {
  return value
    .replace(/(cs|pi|seti|cus)_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 300);
}

function sanitizePath(pathname) {
  return pathname.replace(/\/(cs|pi|seti|cus)_[A-Za-z0-9_]+/g, "/[redacted]");
}

function assertFinalState(snapshot, fixture) {
  if (
    snapshot.payment.grossAmountCents !== fixture.service.priceCents ||
    snapshot.payment.currency !== "BRL" ||
    snapshot.invariants.bookingCount !== 1 ||
    snapshot.invariants.paymentCount !== 1 ||
    snapshot.videoSessions.length !== 1
  ) {
    throw new Error("payment_or_booking_invariants_failed");
  }
}

async function poll(task, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await task();
    if (result) return result;
    await delay(2_000);
  }
  return null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function stage(name, details = {}) {
  evidence.push({ ...details, name, status: "PASS" });
  console.log(JSON.stringify({ details, name, status: "PASS" }));
}
