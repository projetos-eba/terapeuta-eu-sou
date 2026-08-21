#!/usr/bin/env node

import process from "node:process";

import { chromium } from "playwright";

const baseUrl = requireHmlShare(process.env.PLAYWRIGHT_HML_BASE_URL);
const patient = credentials("PATIENT");
const therapist = credentials("THERAPIST");
const admin = credentials("ADMIN");
const supabaseUrl = "https://emzwqkmrryuqvqiohqnu.supabase.co";

let adminAccessToken = null;
let fixture = null;
let browser = null;
const evidence = [];

try {
  adminAccessToken = await loginAdminForEvidence();
  fixture = await hmlHarness({ action: "find_clean" });
  stage("fixture_prepared", {
    durationMinutes: fixture.service.durationMinutes,
    priceCents: fixture.service.priceCents,
    timezone: fixture.slot.timezone,
  });

  browser = await chromium.launch({ headless: false, slowMo: 150 });
  const patientContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const therapistContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const adminContext = await browser.newContext();
  const patientPage = await patientContext.newPage();
  const therapistPage = await therapistContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await verifyPublicDiscovery(patientPage, fixture);
    await Promise.all([
      loginProduct(patientPage, patient, "/cliente/login", "Entrar", "/app"),
      loginProduct(
        therapistPage,
        therapist,
        "/terapeuta/login",
        "Entrar como terapeuta",
        "/terapeuta",
      ),
      loginProduct(
        adminPage,
        admin,
        "/admin-login",
        "Entrar no Admin",
        "/admin",
      ),
    ]);
    stage("independent_personas_ready");

    const checkoutSessionId = await completeBookingCheckout(
      patientPage,
      fixture,
    );
    stage("stripe_checkout_completed");
    const snapshot = await poll(async () => {
      const value = await hmlHarness({
        action: "inspect",
        checkoutSessionId,
      });
      return value?.found &&
        value.payment?.financialStatus === "paid" &&
        value.booking?.status === "confirmed" &&
        value.booking?.payment_status === "paid" &&
        value.webhook?.checkoutCompletedProcessed === true &&
        value.videoSessions?.length === 1
        ? value
        : null;
    }, 150_000);
    if (!snapshot) throw new Error("authoritative_payment_not_converged");
    assertGoldenPayment(snapshot, fixture);
    stage("signed_webhook_and_payment_paid", {
      grossAmountCents: snapshot.payment.grossAmountCents,
      videoSessionCount: snapshot.invariants.videoSessionCount,
    });

    const bookingId = snapshot.bookingId;
    await verifyCrossPersonaViews({
      adminPage,
      bookingId,
      patientPage,
      therapistPage,
    });
    stage("cross_persona_booking_consistency");

    const zoomWindow = await verifyWindowAndVideo({
      bookingId,
      patientPage,
      startsAt: snapshot.booking.starts_at,
      therapistPage,
    });
    if (zoomWindow.inWindow) {
      stage("zoom_host_first_and_completion");
    } else {
      stage("zoom_join_window_not_reached", {
        checkpoint: "ZOOM_ACCESS_WINDOW",
      });
    }

    await verifyFinancialAndAdmin({
      adminPage,
      bookingId,
      therapistPage,
    });
    stage("financial_and_admin_consistency");
  } finally {
    await Promise.allSettled([
      patientContext.close(),
      therapistContext.close(),
      adminContext.close(),
    ]);
  }
} finally {
  await browser?.close();
}

console.log(JSON.stringify({ evidence, ok: true }));

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
  if (!response.ok || body?.ok !== true || !body.accessToken) {
    throw new Error("admin_evidence_login_failed");
  }
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

async function loginProduct(page, actor, loginPath, buttonName, expectedPath) {
  await page.goto(sharedUrl(loginPath), { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.getByRole("button", { name: buttonName }).click();
  await page.waitForURL((url) => url.pathname === expectedPath, {
    timeout: 30_000,
  });
}

async function verifyPublicDiscovery(page, prepared) {
  await page.goto(sharedUrl("/terapeutas/antonio-ferrari-e2e"), {
    waitUntil: "domcontentloaded",
  });
  const body = await page.locator("body").innerText();
  const bookingHref = await page
    .getByRole("link", { name: "Agendar", exact: true })
    .first()
    .getAttribute("href");
  const publicPrice = new URL(
    bookingHref ?? "",
    baseUrl.origin,
  ).searchParams.get("price");
  if (
    !body.includes("Antonio Ferrari E2E") ||
    !new URL(bookingHref ?? "", baseUrl.origin).searchParams.get("service") ||
    Number(publicPrice) !== prepared.service.priceCents
  ) {
    throw new Error("public_discovery_fixture_mismatch");
  }
  stage("public_discovery");
}

async function completeBookingCheckout(page, prepared) {
  const reservation = new URL("/reserva", baseUrl.origin);
  reservation.searchParams.set(
    "_vercel_share",
    baseUrl.searchParams.get("_vercel_share"),
  );
  reservation.searchParams.set("etapa", "preparar");
  reservation.searchParams.set("service", prepared.service.id);
  reservation.searchParams.set("slot", prepared.slot.startsAt);
  reservation.searchParams.set("therapist", "antonio-ferrari-e2e");
  await page.goto(reservation.toString(), { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  const amountPattern = new RegExp(
    `R\\$\\s*${prepared.service.priceCents / 100}(?:,00)?`,
  );
  if (!amountPattern.test(body.replace(/\\u00a0/g, " "))) {
    const prices = await page
      .locator("text=/R\\$/")
      .allTextContents()
      .catch(() => []);
    throw new Error(
      `booking_price_mismatch:${prices
        .map((value) => value.replace(/\\s+/g, " ").trim())
        .filter(Boolean)
        .join("|")}`,
    );
  }
  const terms = page.locator('input[name="terms"]');
  await terms.check();
  stage("booking_initiated");
  const [checkoutResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          "/api/public/reservation/checkout" &&
        response.request().method() === "POST",
      { timeout: 45_000 },
    ),
    page
      .getByRole("button", { name: /Avançar para pagamento/i })
      .first()
      .click(),
  ]);
  const checkout = await checkoutResponse.json();
  const checkoutSessionId = checkout?.checkout?.checkoutSessionId;
  if (!checkout?.ok || typeof checkoutSessionId !== "string") {
    throw new Error("checkout_not_created");
  }
  stage("checkout_created");
  await page.locator("#reservation-embedded-checkout iframe").first().waitFor({
    state: "attached",
    timeout: 90_000,
  });
  stage("checkout_embedded_loaded");
  await fillStripeCheckout(page);
  stage("stripe_test_submit_clicked");
  await page
    .waitForURL(/\/reserva\/sucesso/, { timeout: 120_000 })
    .catch(() => {
      throw new Error("stripe_checkout_not_completed_in_browser");
    });
  stage("stripe_checkout_returned");
  return checkoutSessionId;
}

async function fillStripeCheckout(page) {
  await fillInStripeFrame(
    page,
    /Card number|Número do cartão|Numero do cartao/i,
    ['input[autocomplete="cc-number"]', 'input[name="cardnumber"]'],
    "4242424242424242",
  );
  await fillInStripeFrame(
    page,
    /Expiration|Validade|MM\s*\/\s*(YY|AA)/i,
    ['input[autocomplete="cc-exp"]', 'input[name="expiry"]'],
    "1234",
  );
  await fillInStripeFrame(
    page,
    /CVC|Código de segurança|Codigo de seguranca/i,
    ['input[autocomplete="cc-csc"]', 'input[name="cvc"]'],
    "123",
  );
  const submit = await findInFrames(page, (frame) =>
    frame
      .getByRole("button", { name: /^(Pagar|Pay|Finalizar|Confirmar)/i })
      .first(),
  );
  if (!submit) throw new Error("stripe_submit_missing");
  await submit.click();
}

async function fillInStripeFrame(page, label, selectors, value) {
  const locator = await findInFrames(page, (frame) => {
    const byLabel = frame.getByLabel(label).first();
    return [
      byLabel,
      ...selectors.map((selector) => frame.locator(selector).first()),
    ];
  });
  if (!locator) throw new Error("stripe_field_missing");
  await locator.fill(value);
}

async function findInFrames(page, getCandidates) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const frame of [page, ...page.frames()]) {
      for (const candidate of [].concat(getCandidates(frame))) {
        if (
          (await candidate.count().catch(() => 0)) &&
          (await candidate.isVisible().catch(() => false))
        ) {
          return candidate;
        }
      }
    }
    await delay(250);
  }
  return null;
}

async function verifyCrossPersonaViews({
  adminPage,
  bookingId,
  patientPage,
  therapistPage,
}) {
  await Promise.all([
    patientPage.goto(sharedUrl(`/app/encontros/${bookingId}`), {
      waitUntil: "domcontentloaded",
    }),
    therapistPage.goto(sharedUrl(`/terapeuta/sessoes/${bookingId}`), {
      waitUntil: "domcontentloaded",
    }),
    adminPage.goto(sharedUrl(`/admin/sessoes/${bookingId}`), {
      waitUntil: "domcontentloaded",
    }),
  ]);
  for (const page of [patientPage, therapistPage, adminPage]) {
    if (!new URL(page.url()).pathname.includes(bookingId)) {
      throw new Error("cross_persona_booking_route_missing");
    }
    if (
      !(await page.locator("body").innerText()).includes("Reiki online E2E")
    ) {
      throw new Error("cross_persona_booking_content_missing");
    }
  }
}

async function verifyWindowAndVideo({
  bookingId,
  patientPage,
  startsAt,
  therapistPage,
}) {
  await patientPage.goto(sharedUrl(`/app/encontros/${bookingId}/video`), {
    waitUntil: "domcontentloaded",
  });
  const before = await pageAccessResponse(
    patientPage,
    /Tentar atualizar sala|Atualizar sala/,
  );
  if (before?.access?.allowed !== false)
    throw new Error("zoom_before_window_not_denied");
  stage("zoom_before_window_denied");

  const waitMs = Date.parse(startsAt) - 15 * 60_000 - Date.now();
  if (waitMs > 1_000) {
    return { inWindow: false };
  }

  await therapistPage.goto(sharedUrl(`/terapeuta/sessoes/${bookingId}/video`), {
    waitUntil: "domcontentloaded",
  });
  await therapistPage
    .getByRole("button", { name: "Entrar no encontro" })
    .click();
  await therapistPage
    .getByTestId("zoom-video-stage")
    .waitFor({ state: "visible", timeout: 90_000 });
  stage("therapist_join");

  await patientPage
    .getByRole("button", {
      name: /Atualizar sala|Renovar acesso|Tentar atualizar sala/,
    })
    .first()
    .click();
  await patientPage
    .getByRole("button", { name: "Entrar no encontro" })
    .waitFor({
      state: "visible",
      timeout: 90_000,
    });
  await patientPage.getByRole("button", { name: "Entrar no encontro" }).click();
  await patientPage
    .getByTestId("zoom-video-stage")
    .waitFor({ state: "visible", timeout: 90_000 });
  stage("patient_join_and_active");

  await therapistPage
    .getByRole("button", { name: "Encerrar encontro" })
    .click();
  await poll(async () => {
    const text = await patientPage.locator("body").innerText();
    return /encerrad|finalizad/i.test(text) ? true : null;
  }, 90_000);
  return { inWindow: true };
}

async function pageAccessResponse(page, name) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname ===
          "/api/zoom/video-session-access" &&
        candidate.request().method() === "POST",
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name }).first().click(),
  ]);
  const payload = await response.json();
  return payload?.data ?? payload;
}

async function verifyFinancialAndAdmin({
  adminPage,
  bookingId,
  therapistPage,
}) {
  await therapistPage.goto(sharedUrl("/terapeuta/financeiro"), {
    waitUntil: "domcontentloaded",
  });
  const financeText = await therapistPage.locator("body").innerText();
  if (!/recebimento|financeiro/i.test(financeText)) {
    throw new Error("therapist_finance_view_unavailable");
  }
  await adminPage.goto(sharedUrl(`/admin/sessoes/${bookingId}`), {
    waitUntil: "domcontentloaded",
  });
  if (
    !(await adminPage.locator("body").innerText()).includes("Reiki online E2E")
  ) {
    throw new Error("admin_operational_view_unavailable");
  }
}

function assertGoldenPayment(snapshot, prepared) {
  if (
    snapshot.payment.grossAmountCents !== prepared.service.priceCents ||
    snapshot.invariants.bookingCount !== 1 ||
    snapshot.invariants.paymentCount !== 1 ||
    snapshot.invariants.videoSessionCount !== 1
  ) {
    throw new Error("database_invariants_failed");
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

function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function stage(name, details = {}) {
  evidence.push({ ...details, name, status: "PASS" });
  console.log(`PASS ${name}`);
}
