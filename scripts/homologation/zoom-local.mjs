#!/usr/bin/env node

import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeMode,
  getStripeSecretKey,
  getSupabaseUrl,
  loadEnvFiles,
} from "../payments/env-utils.mjs";
import { loadZoomVideoSdkEnv } from "../zoom/video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  listActiveSessions,
  maskIdentifier,
} from "../zoom/video-sdk-real-helpers.mjs";
import {
  cleanupZoomRealFixtures,
  createZoomCheckoutFixtures,
} from "../zoom/video-sdk-real-fixtures.mjs";
import {
  assertVerifiedWebhookState,
  isWebhookUrl,
  readRealState,
  writeRealState,
} from "../zoom/video-sdk-real-state.mjs";
import {
  createSupabaseAdmin,
  getSupabaseRuntime,
} from "../zoom/video-sdk-real-supabase.mjs";

loadEnvFiles();
loadZoomVideoSdkEnv();

const startedAt = new Date();
const runId = `zoom-homologation-${Date.now()}`;
const logDir = path.join(process.cwd(), ".tmp", "homologation", runId);
const children = [];
const evidence = {
  checks: [],
  commands: [],
  createdAt: startedAt.toISOString(),
  gates: [],
  runId,
  services: [],
};
const stripeWebhookEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.finalization_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "transfer.updated",
  "transfer.reversed",
  "account.updated",
  "account.external_account.updated",
  "balance_settings.updated",
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
];
const stripeThinWebhookEvents = [
  "v2.core.account.closed",
  "v2.core.account.created",
  "v2.core.account.updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[defaults].updated",
  "v2.core.account[future_requirements].updated",
  "v2.core.account[identity].updated",
  "v2.core.account[requirements].updated",
];
let canonicalAdmin = null;
let canonicalFixture = null;

await mkdir(logDir, { recursive: true });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await shutdown("signal");
    process.exit(1);
  });
}

try {
  await phase("tools", assertTools);
  await phase("environment", assertEnvironment);
  await phase("supabase_start", ensureSupabaseStarted);
  await phase("supabase_schema", prepareSupabaseSchema);
  await phase("stripe_catalog_sync", () =>
    run("npm", ["run", "payments:catalog:sync"], { timeoutMs: 120_000 }),
  );
  await phase("stripe_catalog_verify", () =>
    run("npm", ["run", "payments:catalog:verify"], { timeoutMs: 120_000 }),
  );
  await phase("supabase_lint", () =>
    run("npx", ["supabase", "db", "lint"], { timeoutMs: 120_000 }),
  );
  await phase("supabase_tests", () =>
    run("npx", ["supabase", "test", "db"], { timeoutMs: 180_000 }),
  );
  await phase("next", () => startNext({ timeoutMs: 120_000 }));
  const stripeWebhookSecret = await phase("stripe_listener", () =>
    startStripeListener({ timeoutMs: 45_000 }),
  );
  await phase("functions", () =>
    startFunctions({ stripeWebhookSecret, timeoutMs: 45_000 }),
  );
  await phase("zoom_local_tests", runZoomLocalTests);
  await phase("zoom_tunnel_state", assertZoomWebhookReady);
  await phase("stripe_payment_e2e", runCanonicalStripePaymentE2E);
  await phase("stripe_payment_evidence", assertCanonicalPaymentEvidence);
  await phase("real_preflight", assertRealPreflight);
  await phase("real_session", runRealZoomTest);
  await phase("post_cleanup", assertPostCleanup);

  evidence.finishedAt = new Date().toISOString();
  evidence.ok = true;
  await writeEvidence();
  console.log(
    JSON.stringify(
      {
        evidenceFile: path.join(logDir, "evidence.json"),
        ok: true,
        runId,
      },
      null,
      2,
    ),
  );
} catch (error) {
  evidence.finishedAt = new Date().toISOString();
  evidence.ok = false;
  evidence.error = sanitizeError(error);
  await writeEvidence();
  console.error(
    JSON.stringify(
      {
        blocked: true,
        evidenceFile: path.join(logDir, "evidence.json"),
        error: evidence.error,
        phase: evidence.currentPhase,
        runId,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await cleanupCanonicalFixture("finally");
  await shutdown("finally");
}

async function phase(name, callback) {
  evidence.currentPhase = name;
  evidence.checks.push({ at: new Date().toISOString(), phase: name });
  await writeEvidence();
  return callback();
}

async function assertTools() {
  for (const [command, args] of [
    ["node", ["--version"]],
    ["npm", ["--version"]],
    ["npx", ["supabase", "--version"]],
    ["stripe", ["--version"]],
    ["docker", ["--version"]],
  ]) {
    const resolved = resolveSpawn(command, args);
    const result = spawnSync(resolved.command, resolved.args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    if (result.status !== 0) {
      throw new Error(`tool_unavailable:${command}`);
    }
    evidence.commands.push({ command: [command, ...args].join(" "), ok: true });
  }
}

async function assertEnvironment() {
  const supabaseUrl = getSupabaseUrl();
  const stripeSecretKey = getStripeSecretKey();
  const stripeMode = getStripeMode(stripeSecretKey);
  assertStripeModeAllowedForSupabaseUrl({ stripeMode, supabaseUrl });
  if (stripeSecretKey) {
    process.env.STRIPE_API_KEY = stripeSecretKey;
  }

  const failures = [];
  if (!stripeSecretKey) {
    failures.push({
      expected: "STRIPE_SECRET_KEY test configurada",
      item: "STRIPE_SECRET_KEY",
      where: "supabase/functions/.env",
    });
  }
  if (stripeMode !== "test") {
    failures.push({
      expected: "Stripe test mode",
      item: "STRIPE_SECRET_KEY",
      where: "supabase/functions/.env",
    });
  }
  failures.push(...assertStaticRealZoomGates({ requireNgrok: true }));
  const host = safeHost(supabaseUrl);
  if (!["127.0.0.1", "localhost"].includes(host)) {
    failures.push({
      expected: "Supabase local",
      item: "SUPABASE_URL",
      where: "ambiente local",
    });
  }

  if (failures.length > 0) {
    evidence.gates.push(...failures);
    throw new Error("environment_gates_failed");
  }
}

async function ensureSupabaseStarted() {
  const status = await runMaybe("npx", ["supabase", "status"], {
    timeoutMs: 20_000,
  });
  if (status.ok) return;
  await run("npx", ["supabase", "start"], { timeoutMs: 240_000 });
}

async function prepareSupabaseSchema() {
  if (process.env.ZOOM_HOMOLOGATION_RESET_DB === "true") {
    await run("npx", ["supabase", "db", "reset"], { timeoutMs: 180_000 });
    return;
  }

  const runtime = await getSupabaseRuntime();
  const admin = createSupabaseAdmin(runtime);
  const requiredLegalDocuments = [
    "terms-of-use",
    "privacy-policy",
    "cancellation-reschedule-refund-policy",
  ];
  const legalRows = await admin.select(
    "legal_document_versions",
    `select=document_key&status=eq.published&document_key=in.(${requiredLegalDocuments.join(
      ",",
    )})`,
  );
  const legalKeys = new Set(legalRows.map((row) => row.document_key));
  const missingLegalDocuments = requiredLegalDocuments.filter(
    (key) => !legalKeys.has(key),
  );

  if (missingLegalDocuments.length > 0) {
    evidence.gates.push({
      expected:
        "Documentos legais publicados para Checkout local sem reset destrutivo",
      item: "legal_document_versions",
      missing: missingLegalDocuments,
      where:
        "rode migrations/seeds locais ou use ZOOM_HOMOLOGATION_RESET_DB=true conscientemente",
    });
    throw new Error("local_legal_documents_missing");
  }

  evidence.gates.push({
    expected: "Supabase local preservado; db reset pulado por padrao",
    item: "ZOOM_HOMOLOGATION_RESET_DB",
    where: "scripts/homologation/zoom-local.mjs",
  });
}

async function startFunctions({ stripeWebhookSecret, timeoutMs }) {
  const siteUrl = currentNextBaseUrl();
  const child = startProcess(
    "npm",
    ["run", "dev:functions"],
    "edge-functions",
    {
      EMAIL_PUBLIC_SITE_URL: siteUrl,
      NEXT_PUBLIC_SITE_URL: siteUrl,
      STRIPE_CONNECT_WEBHOOK_SECRET: stripeWebhookSecret,
      STRIPE_CONNECT_V2_WEBHOOK_SECRET: stripeWebhookSecret,
      STRIPE_PLATFORM_WEBHOOK_SECRET: stripeWebhookSecret,
      STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
    },
  );
  await waitForHttp("http://127.0.0.1:54321/functions/v1/zoom-webhook", {
    method: "OPTIONS",
    timeoutMs,
  });
  evidence.services.push({ name: "edge-functions", pid: child.pid });
}

async function startNext({ timeoutMs }) {
  const requested = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (requested && (await isHttpReady(requested))) {
    evidence.services.push({ name: "next", reused: true, url: requested });
    return;
  }

  const port = await getFreePort(3000);
  const url = `http://127.0.0.1:${port}`;
  const child = startProcess(
    "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    "next",
  );
  process.env.PLAYWRIGHT_BASE_URL = url;
  process.env.NEXT_PUBLIC_SITE_URL = url;
  await waitForHttp(url, { timeoutMs });
  evidence.services.push({ name: "next", pid: child.pid, url });
}

async function startStripeListener({ timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let child = null;
    let timer = null;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };
    child = startProcess(
      "stripe",
      [
        "listen",
        "--events",
        stripeWebhookEvents.join(","),
        "--forward-to",
        "http://127.0.0.1:54321/functions/v1/stripe-billing-webhook",
        "--forward-connect-to",
        "http://127.0.0.1:54321/functions/v1/stripe-connect-webhook",
        "--thin-events",
        stripeThinWebhookEvents.join(","),
        "--forward-thin-to",
        "http://127.0.0.1:54321/functions/v1/stripe-connect-webhook",
        "--forward-thin-connect-to",
        "http://127.0.0.1:54321/functions/v1/stripe-connect-webhook",
      ],
      "stripe-listener",
      {},
      {
        onOutputRaw(chunk) {
          const match = String(chunk).match(/whsec_[A-Za-z0-9_]+/);
          if (!match) return;
          evidence.gates.push({
            expected:
              "Stripe CLI webhook secret capturado do listener ativo sem imprimir valor",
            item: "STRIPE_WEBHOOK_SECRET",
            where: "processo local de Edge Functions",
          });
          evidence.services.push({ name: "stripe-listener", pid: child?.pid });
          finish(resolve, match[0]);
        },
      },
    );
    timer = setTimeout(() => {
      finish(reject, new Error("stripe_listener_secret_timeout"));
    }, timeoutMs);
    child.on("exit", () => {
      finish(reject, new Error("stripe_listener_exited"));
    });
  });
}

async function runZoomLocalTests() {
  await run("npm", ["run", "zoom:video-sdk:env"], { timeoutMs: 60_000 });
  await run("npm", ["run", "zoom:video-sdk:test"], { timeoutMs: 180_000 });
  await run("npm", ["run", "zoom:video-sdk:api:mock"], {
    timeoutMs: 120_000,
  });
  let lastSmokeError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await run("npm", ["run", "zoom:video-sdk:webhook:smoke"], {
        timeoutMs: 120_000,
      });
      lastSmokeError = null;
      break;
    } catch (error) {
      lastSmokeError = error;
      if (attempt < 3) await delay(3000);
    }
  }
  if (lastSmokeError) throw lastSmokeError;
}

async function assertZoomWebhookReady() {
  if (process.env.ZOOM_PUBLIC_WEBHOOK_URL) {
    if (!isWebhookUrl(process.env.ZOOM_PUBLIC_WEBHOOK_URL)) {
      throw new Error("zoom_public_webhook_url_invalid");
    }
  }
  const state = await readRealState();
  const publicWebhookUrl =
    state.tunnel?.publicWebhookUrl || process.env.ZOOM_PUBLIC_WEBHOOK_URL;
  if (!publicWebhookUrl) {
    throw new Error(
      "zoom_webhook_tunnel_missing: rode npm run zoom:video-sdk:webhook:tunnel e valide a URL no Zoom Build Platform",
    );
  }
  const verification = await assertVerifiedWebhookState();
  if (verification.failures.length > 0) {
    await run("npm", ["run", "zoom:video-sdk:webhook:real-verify"], {
      timeoutMs: 60_000,
    });
  }
  const refreshedVerification = await assertVerifiedWebhookState();
  if (refreshedVerification.failures.length > 0) {
    evidence.gates.push(...refreshedVerification.failures);
    throw new Error("zoom_webhook_not_verified");
  }
}

async function assertRealPreflight() {
  await run("npm", ["run", "zoom:video-sdk:webhook:real-verify"], {
    timeoutMs: 60_000,
  });
  await run("npm", ["run", "zoom:video-sdk:real-preflight"], {
    timeoutMs: 60_000,
  });
  const sessions = await listActiveSessions();
  if (!sessions.ok)
    throw new Error(`zoom_active_sessions_http_${sessions.status}`);
  if ((sessions.activeSessions ?? []).length > 0) {
    throw new Error("zoom_active_sessions_blocked");
  }
}

async function assertCanonicalPaymentEvidence() {
  const state = await readRealState();
  const payment = state.canonicalPayment;
  const failures = [];

  if (!payment?.bookingId || !payment?.sessionPaymentId) {
    failures.push({
      expected: "bookingId/sessionPaymentId criados pelo Checkout real",
      item: "canonicalPayment",
      where: ".tmp/zoom-real-homologation.json",
    });
  }
  if (payment?.financialStatus !== "paid") {
    failures.push({
      expected: "session_payments.financial_status = paid via webhook Stripe",
      item: "canonicalPayment.financialStatus",
      where: ".tmp/zoom-real-homologation.json",
    });
  }
  if (!payment?.stripeWebhookEventId) {
    failures.push({
      expected: "webhook Stripe processado e idempotente",
      item: "canonicalPayment.stripeWebhookEventId",
      where: ".tmp/zoom-real-homologation.json",
    });
  }
  if (!payment?.videoSessionId) {
    failures.push({
      expected:
        "video_session criada por ensure_video_session_for_paid_booking_v1",
      item: "canonicalPayment.videoSessionId",
      where: ".tmp/zoom-real-homologation.json",
    });
  }

  if (failures.length > 0) {
    evidence.gates.push(...failures);
    throw new Error(
      "canonical_stripe_payment_e2e_pending: o harness antigo de Zoom nao substitui Checkout + webhook Stripe",
    );
  }
}

async function runCanonicalStripePaymentE2E() {
  const runtime = await getSupabaseRuntime();
  canonicalAdmin = createSupabaseAdmin(runtime);
  canonicalFixture = await createZoomCheckoutFixtures({
    admin: canonicalAdmin,
    runId,
  });
  evidence.canonicalFixture = canonicalFixture.sanitized;

  const baseUrl = currentNextBaseUrl();
  const reservationUrl = buildReservationUrl(baseUrl, canonicalFixture);
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const browserEvents = [];
  const recordBrowserEvent = (event) => {
    browserEvents.push({
      ...event,
      at: new Date().toISOString(),
    });
    if (browserEvents.length > 80) browserEvents.shift();
  };
  page.on("console", (message) =>
    recordBrowserEvent({
      kind: "console",
      level: message.type(),
      text: sanitizeLog(message.text()).slice(0, 500),
    }),
  );
  page.on("pageerror", (error) =>
    recordBrowserEvent({
      kind: "pageerror",
      text: sanitizeLog(String(error?.message ?? error)).slice(0, 500),
    }),
  );
  page.on("requestfailed", (request) =>
    recordBrowserEvent({
      failure: sanitizeLog(request.failure()?.errorText ?? "").slice(0, 300),
      kind: "requestfailed",
      method: request.method(),
      url: sanitizeLog(request.url()).slice(0, 500),
    }),
  );

  try {
    await page.bringToFront();
    await page.goto(
      `${baseUrl}/cliente/login?next=${encodeURIComponent(
        new URL(reservationUrl).pathname + new URL(reservationUrl).search,
      )}`,
      { waitUntil: "domcontentloaded" },
    );
    await page
      .getByLabel("E-mail")
      .fill(canonicalFixture.credentials.patient.email);
    await page
      .getByLabel("Senha")
      .fill(canonicalFixture.credentials.patient.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/reserva/, { timeout: 45_000 });
    await page.bringToFront();
    await page.getByRole("checkbox", { name: /Aceito os Termos/i }).check();
    await clickEnabledButton(page, /Avan.ar para pagamento/i);
    await page.waitForURL(/etapa=pagamento/, { timeout: 30_000 });
    await page
      .locator("#reservation-embedded-checkout iframe")
      .first()
      .waitFor({
        state: "attached",
        timeout: 90_000,
      });
    await completeStripeEmbeddedCheckout(page);

    const payment = await waitForCanonicalPayment(
      canonicalAdmin,
      canonicalFixture,
    );
    canonicalFixture.ids.bookingId = payment.bookingId;
    canonicalFixture.ids.sessionPaymentId = payment.sessionPaymentId;
    canonicalFixture.ids.videoSessionId = payment.videoSessionId;
    canonicalFixture.videoSession = payment.videoSession;
    await writeRealState({
      canonicalPayment: {
        bookingId: payment.bookingId,
        checkoutSessionId: payment.checkoutSessionId,
        credentials: canonicalFixture.credentials,
        financialStatus: payment.financialStatus,
        ids: canonicalFixture.ids,
        sessionPaymentId: payment.sessionPaymentId,
        stripeWebhookEventId: payment.stripeWebhookEventId,
        videoSession: payment.videoSession,
        videoSessionId: payment.videoSessionId,
      },
    });
    evidence.canonicalPayment = {
      bookingId: maskIdentifier(payment.bookingId),
      financialStatus: payment.financialStatus,
      sessionPaymentId: maskIdentifier(payment.sessionPaymentId),
      stripeWebhookEventId: maskIdentifier(payment.stripeWebhookEventId),
      videoSessionId: maskIdentifier(payment.videoSessionId),
    };
  } finally {
    evidence.browserEvents = browserEvents;
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function clickEnabledButton(page, label) {
  const buttons = page.getByRole("button", { name: label });
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if ((await button.isVisible()) && (await button.isEnabled())) {
      await button.click({ timeout: 20_000 });
      return;
    }
  }
  throw new Error(`enabled_button_not_found:${label}`);
}

function buildReservationUrl(baseUrl, fixture) {
  const params = new URLSearchParams({
    duration: "30",
    etapa: "preparar",
    price: "17000",
    service: fixture.ids.serviceId,
    serviceName: fixture.reservation.serviceName,
    slot: fixture.reservation.startsAt,
    therapist: fixture.reservation.slug,
  });
  return `${baseUrl}/reserva?${params.toString()}`;
}

async function completeStripeEmbeddedCheckout(page) {
  await fillStripeField(
    page,
    /Card number|N.mero do cart.o/i,
    "4242424242424242",
    [
      'input[name="number"]',
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
  await fillStripeField(page, /CVC|C.digo de seguran.a/i, "123", [
    'input[name="cvc"]',
    'input[autocomplete="cc-csc"]',
    'input[data-elements-stable-field-name="cardCvc"]',
  ]);
  await fillOptionalStripeField(
    page,
    /Name on card|Nome no cart.o|Nome/i,
    "Homologacao TES",
    ['input[name="billingName"]', 'input[autocomplete="cc-name"]'],
  );
  await fillOptionalStripeField(page, /ZIP|Postal|CEP/i, "01001000", [
    'input[name="postalCode"]',
    'input[autocomplete="postal-code"]',
    'input[data-elements-stable-field-name="postalCode"]',
  ]);
  await clickStripeButton(page, /Pay|Pagar|Finalizar|Confirmar/i);
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
  if (!locator) {
    const error = new Error(`stripe_field_not_found:${label}`);
    error.details = await collectStripeFrameDiagnostics(page);
    throw error;
  }
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

async function findFirstSelectorInPageOrFrames(page, selectors) {
  for (const selector of selectors) {
    const locator = await findLocatorInPageOrFrames(page, (scope) =>
      scope.locator(selector).first(),
    );
    if (locator) return locator;
  }
  return null;
}

async function collectStripeFrameDiagnostics(page) {
  const frames = [];
  for (const frame of page.frames()) {
    const summary = {
      buttons: [],
      inputs: [],
      labels: [],
      name: frame.name(),
      url: frame.url().slice(0, 160),
    };
    try {
      summary.bodyText = await frame
        .locator("body")
        .innerText({ timeout: 1000 })
        .then((text) =>
          sanitizeLog(text).replace(/\s+/g, " ").trim().slice(0, 800),
        );
    } catch {
      // Stripe frame tree can change while diagnostics are collected.
    }
    try {
      summary.labels = await frame.locator("label").evaluateAll((elements) =>
        elements
          .slice(0, 20)
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean),
      );
    } catch {
      // Stripe frame tree can change while diagnostics are collected.
    }
    try {
      summary.inputs = await frame.locator("input").evaluateAll((elements) =>
        elements.slice(0, 20).map((element) => ({
          ariaLabel: element.getAttribute("aria-label"),
          autocomplete: element.getAttribute("autocomplete"),
          name: element.getAttribute("name"),
          placeholder: element.getAttribute("placeholder"),
          type: element.getAttribute("type"),
        })),
      );
    } catch {
      // Stripe frame tree can change while diagnostics are collected.
    }
    try {
      summary.buttons = await frame.locator("button").evaluateAll((elements) =>
        elements.slice(0, 20).map((element) => ({
          disabled: element.disabled,
          text: element.textContent?.replace(/\s+/g, " ").trim(),
        })),
      );
    } catch {
      // Stripe frame tree can change while diagnostics are collected.
    }
    frames.push(summary);
  }
  return {
    frameCount: frames.length,
    frames,
    pageUrl: page.url(),
  };
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
  if (!locator) {
    const error = new Error(`stripe_button_not_found:${label}`);
    error.details = await collectStripeFrameDiagnostics(page);
    throw error;
  }
  await locator.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await locator.click({ timeout: 10_000 });
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
          // Stripe frame tree can change while buttons are inspected.
        }
      }
    }
    await delay(500);
  }
  return null;
}

async function findLocatorInPageOrFrames(page, buildLocator) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const scope of [page, ...page.frames()]) {
      const locator = buildLocator(scope);
      try {
        if ((await locator.count()) > 0 && (await locator.isVisible())) {
          return locator;
        }
      } catch {
        // Cross-origin Stripe frames can appear while the tree is changing.
      }
    }
    await delay(500);
  }
  return null;
}

async function waitForCanonicalPayment(admin, fixture) {
  const deadline = Date.now() + 150_000;
  let last = null;
  while (Date.now() < deadline) {
    const [booking] = await admin.select(
      "bookings",
      `select=id,status,payment_status&patient_profile_id=eq.${fixture.ids.patientProfileId}&service_id=eq.${fixture.ids.serviceId}&order=created_at.desc&limit=1`,
    );
    if (booking?.id) {
      const [payment] = await admin.select(
        "session_payments",
        `select=id,financial_status,stripe_checkout_session_id,stripe_payment_intent_id&booking_id=eq.${booking.id}&limit=1`,
      );
      const [videoSession] = await admin.select(
        "video_sessions",
        `select=id,session_key,session_name,status&booking_id=eq.${booking.id}&limit=1`,
      );
      const [webhook] = payment?.stripe_checkout_session_id
        ? await admin.select(
            "stripe_webhook_events",
            `select=stripe_event_id,processing_status,event_type&event_type=eq.checkout.session.completed&object_id=eq.${encodeURIComponent(
              payment.stripe_checkout_session_id,
            )}&processing_status=eq.processed&limit=1`,
          )
        : [];
      last = { booking, payment, videoSession, webhook };
      if (
        payment?.financial_status === "paid" &&
        webhook?.stripe_event_id &&
        videoSession?.id
      ) {
        return {
          bookingId: booking.id,
          checkoutSessionId: payment.stripe_checkout_session_id,
          financialStatus: payment.financial_status,
          sessionPaymentId: payment.id,
          stripeWebhookEventId: webhook.stripe_event_id,
          videoSession: {
            id: videoSession.id,
            sessionKey: videoSession.session_key,
            sessionName: videoSession.session_name,
            status: videoSession.status,
          },
          videoSessionId: videoSession.id,
        };
      }
    }
    await delay(2000);
  }
  evidence.canonicalPaymentLastState = sanitizeCanonicalLastState(last);
  throw new Error("canonical_payment_not_confirmed_by_webhook");
}

function sanitizeCanonicalLastState(value) {
  return {
    bookingStatus: value?.booking?.status ?? null,
    financialStatus: value?.payment?.financial_status ?? null,
    hasBooking: Boolean(value?.booking?.id),
    hasCheckoutSession: Boolean(value?.payment?.stripe_checkout_session_id),
    hasPaymentIntent: Boolean(value?.payment?.stripe_payment_intent_id),
    hasProcessedWebhook: Boolean(value?.webhook?.stripe_event_id),
    hasVideoSession: Boolean(value?.videoSession?.id),
    paymentStatus: value?.booking?.payment_status ?? null,
  };
}

async function runRealZoomTest() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  await run(
    "npm",
    [
      "run",
      "zoom:video-sdk:test:real",
      "--",
      "--headed",
      "--slow-mo=300",
      "--confirm-zoom-marketplace",
      "--confirm-single-real-session",
      "--base-url",
      baseUrl,
    ],
    { timeoutMs: 360_000 },
  );
}

async function assertPostCleanup() {
  const sessions = await listActiveSessions();
  if (!sessions.ok) {
    throw new Error(`zoom_post_cleanup_http_${sessions.status}`);
  }
  const active = sessions.activeSessions ?? [];
  evidence.activeSessionCountFinal = active.length;
  evidence.activeSessionHashes = active.map((session) =>
    maskIdentifier(String(session.id ?? session.session_id ?? "")),
  );
  if (active.length > 0) throw new Error("zoom_active_sessions_after_cleanup");
}

function startProcess(command, args, label, extraEnv = {}, options = {}) {
  const stdoutPath = path.join(logDir, `${label}.stdout.log`);
  const stderrPath = path.join(logDir, `${label}.stderr.log`);
  const out = spawn(
    process.platform === "win32" ? "powershell.exe" : "sh",
    process.platform === "win32"
      ? [
          "-NoProfile",
          "-Command",
          `& ${JSON.stringify(command)} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`,
        ]
      : ["-lc", [command, ...args].map(shellQuote).join(" ")],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdout = [];
  const stderr = [];
  out.stdout.on("data", (chunk) => {
    options.onOutputRaw?.(chunk);
    stdout.push(sanitizeLog(chunk));
  });
  out.stderr.on("data", (chunk) => {
    options.onOutputRaw?.(chunk);
    stderr.push(sanitizeLog(chunk));
  });
  out.on("exit", async () => {
    await writeFile(stdoutPath, stdout.join(""), "utf8").catch(() => undefined);
    await writeFile(stderrPath, stderr.join(""), "utf8").catch(() => undefined);
  });
  children.push(out);
  return out;
}

function currentNextBaseUrl() {
  const next = [...evidence.services]
    .reverse()
    .find((service) => service.name === "next" && service.url);
  return (
    next?.url || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"
  );
}

async function cleanupCanonicalFixture(reason) {
  if (!canonicalFixture || !canonicalAdmin) return;
  if (process.env.ZOOM_HOMOLOGATION_KEEP_LOCAL_FIXTURES === "true") {
    evidence.canonicalCleanup = {
      ok: true,
      reason,
      skipped: "ZOOM_HOMOLOGATION_KEEP_LOCAL_FIXTURES",
    };
    await writeEvidence();
    return;
  }
  try {
    await cleanupZoomRealFixtures({
      admin: canonicalAdmin,
      ids: canonicalFixture.ids,
      runId,
    });
    evidence.canonicalCleanup = { ok: true, reason };
  } catch (error) {
    evidence.canonicalCleanup = {
      error: sanitizeError(error),
      ok: false,
      reason,
    };
  } finally {
    await writeEvidence();
  }
}

async function run(command, args, { timeoutMs }) {
  const result = await runCapture(command, args, { timeoutMs });
  if (result.code !== 0) {
    const error = new Error(`command_failed:${command} ${args.join(" ")}`);
    error.details = {
      exitCode: result.code,
      stderr: result.stderr.slice(-4000),
      stdout: result.stdout.slice(-4000),
    };
    throw error;
  }
  evidence.commands.push({ command: [command, ...args].join(" "), ok: true });
  return result;
}

async function runMaybe(command, args, { timeoutMs }) {
  const result = await runCapture(command, args, { timeoutMs });
  return { ok: result.code === 0 };
}

function runCapture(command, args, { sanitize = true, timeoutMs }) {
  return new Promise((resolve) => {
    const resolved = resolveSpawn(command, args);
    const child = spawn(resolved.command, resolved.args, {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += sanitize ? sanitizeLog(chunk) : String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += sanitize ? sanitizeLog(chunk) : String(chunk);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stderr, stdout });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stderr: sanitizeLog(String(error)), stdout });
    });
  });
}

async function waitForHttp(url, { method = "GET", timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHttpReady(url, method)) return;
    await delay(1000);
  }
  throw new Error(`http_not_ready:${url}`);
}

async function isHttpReady(url, method = "GET") {
  try {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(2000),
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function getFreePort(startPort) {
  for (let port = startPort; port < startPort + 30; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error("no_free_local_port");
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function shutdown(reason) {
  evidence.shutdownReason = reason;
  for (const child of children.reverse()) {
    if (child.exitCode === null && !child.killed) {
      await terminateProcessTree(child.pid);
      await delay(1000);
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }
  }
  await writeEvidence();
}

async function terminateProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The process may have already exited.
  }
}

async function writeEvidence() {
  await writeFile(
    path.join(logDir, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
}

function sanitizeLog(value) {
  return String(value)
    .replace(/whsec_[A-Za-z0-9_]+/g, "[redacted-stripe-webhook-secret]")
    .replace(/sk_(test|live)_[A-Za-z0-9_]+/g, "[redacted-stripe-secret]")
    .replace(/rk_(test|live)_[A-Za-z0-9_]+/g, "[redacted-stripe-secret]")
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted-jwt]",
    );
}

function sanitizeError(error) {
  const sanitized = {
    message: sanitizeLog(String(error?.message ?? error)).slice(0, 500),
    name: error?.name ?? "Error",
  };
  if (error?.details) {
    sanitized.details = sanitizeDetails(error.details);
  }
  return sanitized;
}

function sanitizeDetails(value) {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeLog(value).slice(0, 8_000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeDetails);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, nested]) => [key, sanitizeDetails(nested)]),
    );
  }
  return String(value).slice(0, 8_000);
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function resolveSpawn(command, args) {
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    return { args: ["/d", "/s", "/c", command, ...args], command: "cmd.exe" };
  }

  return { args, command: resolveExecutable(command) };
}

function resolveExecutable(command) {
  if (process.platform !== "win32") return command;
  if (/\.(cmd|exe|bat)$/i.test(command)) return command;
  if (["npm", "npx"].includes(command)) return `${command}.cmd`;
  return command;
}
