#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import Stripe from "stripe";

import {
  assertAmountWithinCap,
  assertLiveMoneyGuard,
  assertLiveStripeMode,
  assertProductionSupabaseUrl,
  estimateDiscountedAmountCents,
  LIVE_CONFIRMATION_VALUE,
  maskStripeId,
  parsePlan,
  parsePositiveCentAmount,
  parseStage,
  safeError,
  safeHost,
  sanitizeUrl,
  shouldUseLiveSmokeCoupon,
} from "./stripe-phase3-live-smoke-core.mjs";
import {
  getStripeSecretKey,
  getSupabaseServiceRoleKey,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();

const rawArgs = process.argv.slice(2);
const stage = parseStage(readArg("stage", "readiness"));
const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/+$/g, "") ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/g, "") ||
  "https://terapeutaeusou.com.br";
const expectedHmlRef =
  process.env.PAYMENTS_HML_SUPABASE_REF?.trim() || "emzwqkmrryuqvqiohqnu";
const evidenceDir =
  process.env.PAYMENTS_PHASE3_EVIDENCE_DIR?.trim() ||
  "test-results/stripe-phase3";
const evidenceFile = `${evidenceDir}/live-smoke-${stage}-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}.json`;
const maxAmountCents = parsePositiveCentAmount(
  process.env.PAYMENTS_LIVE_MAX_AMOUNT_CENTS,
);
const checks = [];
const evidence = {
  generatedAt: new Date().toISOString(),
  stage,
  checks,
  environment: {},
};

try {
  await run();
} catch (error) {
  addCheck("live_smoke_script", "fail", safeError(error));
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);

for (const check of checks) {
  console.log(`${formatStatus(check.status)} ${check.name}: ${check.summary}`);
}
console.log(`Evidence: ${evidenceFile}`);

if (
  checks.some((check) => check.status === "fail" || check.status === "blocked")
) {
  process.exitCode = 1;
}

async function run() {
  const config = getLiveConfig();
  evidence.environment = {
    baseHost: safeHost(baseUrl),
    stripeMode: "live",
    supabaseHost: safeHost(config.supabaseUrl),
    supabaseRef: config.supabaseRef,
  };

  if (stage === "readiness") {
    await runReadiness(config);
    return;
  }

  if (stage === "report") {
    await runReport(config);
    return;
  }

  assertLiveMoneyGuard({
    args: rawArgs,
    env: process.env,
    maxAmountCents,
    plannedAmountCents: 1,
  });

  if (stage === "billing") {
    await runBilling(config);
    return;
  }

  if (stage === "session") {
    await runSession(config);
    return;
  }

  if (stage === "connect") {
    await runConnect(config);
  }
}

function getLiveConfig() {
  const stripeSecretKey = getStripeSecretKey();
  const supabaseUrl = getTargetSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const internalOperationsToken =
    process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN?.trim() || null;

  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is required.");
  assertLiveStripeMode(stripeSecretKey);
  const supabaseRef = assertProductionSupabaseUrl(supabaseUrl, {
    hmlRef: expectedHmlRef,
  });

  return {
    internalOperationsToken,
    serviceRoleKey,
    stripe: new Stripe(stripeSecretKey, {
      apiVersion: "2026-06-24.dahlia",
    }),
    stripeSecretKey,
    supabaseRef,
    supabaseUrl,
  };
}

async function runReadiness(config) {
  addCheck(
    "live_money_guard_documented",
    "pass",
    `Mutating stages require --confirm-live-money and TES_LIVE_SMOKE_CONFIRM=${LIVE_CONFIRMATION_VALUE}.`,
  );
  addCheck(
    "live_amount_cap",
    maxAmountCents <= 500 ? "pass" : "fail",
    maxAmountCents <= 500
      ? `Teto LIVE configurado em ${maxAmountCents} centavos.`
      : "PAYMENTS_LIVE_MAX_AMOUNT_CENTS excede 500 centavos.",
  );

  await checkStripeApi(config);
  await checkBillingCatalog(config);
  await checkWebhookEndpoints(config);
  await checkEdgeFunctions(config);
  await checkLiveFixtures(config);
  await checkFinanceTestControlsDenied(config);
}

async function runBilling(config) {
  requireEnvValue("PAYMENTS_LIVE_THERAPIST_EMAIL");
  requireEnvValue("PAYMENTS_LIVE_THERAPIST_PASSWORD");
  const therapistProfileId = requireEnvValue(
    "PAYMENTS_LIVE_THERAPIST_PROFILE_ID",
  );
  const plan = parsePlan(
    readArg("plan", process.env.PAYMENTS_LIVE_BILLING_PLAN || "premium"),
  );
  const price = await getBillingPrice(config, plan);
  const coupon = await getLiveSmokeCoupon(config, therapistProfileId);
  const plannedAmountCents = estimateDiscountedAmountCents({
    coupon,
    unitAmountCents: price.unit_amount_cents,
  });
  assertAmountWithinCap({ amountCents: plannedAmountCents, maxAmountCents });

  evidence.billing = {
    plan,
    plannedAmountCents,
    priceId: maskStripeId(price.stripe_price_id),
    smokeCouponApplied: Boolean(coupon),
    therapistProfileId,
  };

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({
      recordVideo: { dir: `${evidenceDir}/live-billing` },
    });
    const page = await context.newPage();
    await login(page, {
      email: process.env.PAYMENTS_LIVE_THERAPIST_EMAIL,
      password: process.env.PAYMENTS_LIVE_THERAPIST_PASSWORD,
      role: "terapeuta",
    });
    const checkout = await page.evaluate(
      async ({ selectedPlan }) => {
        const response = await fetch("/api/therapist/subscription-checkout", {
          body: JSON.stringify({
            checkoutUiMode: "hosted",
            plan: selectedPlan,
            requestId: crypto.randomUUID(),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        return {
          payload: await response.json().catch(() => null),
          status: response.status,
        };
      },
      { selectedPlan: plan },
    );

    if (!checkout.payload?.ok || !checkout.payload.checkout?.url) {
      throw new Error(`billing_checkout_failed:${checkout.status}`);
    }

    const checkoutSessionId = checkout.payload.checkout.checkoutSessionId;
    evidence.billing.checkoutSessionId = maskStripeId(checkoutSessionId);
    await page.goto(checkout.payload.checkout.url);
    addCheck(
      "billing_checkout_opened",
      "pass",
      "Checkout hosted LIVE aberto no navegador visível; operador deve inserir cartão real manualmente.",
    );

    const completed = await waitForPageUrl(
      page,
      /\/terapeuta\/checkout\?.*checkout=success/,
      900_000,
    );
    if (!completed) {
      addCheck(
        "billing_payment_completion",
        "blocked",
        "Pagamento LIVE não foi concluído dentro da janela manual.",
      );
      return;
    }

    const session = await config.stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      {
        expand: ["subscription", "payment_intent"],
      },
    );
    evidence.billing.stripePaymentStatus = session.payment_status;
    evidence.billing.subscriptionId = maskStripeId(
      getStripeId(session.subscription),
    );
    addCheck(
      "billing_stripe_paid",
      session.payment_status === "paid" ? "pass" : "fail",
      `Stripe Checkout retornou payment_status=${session.payment_status}.`,
    );
    await waitForSubscriptionState(config, {
      expectedPlan: plan,
      status: ["active", "trialing"],
      therapistProfileId,
    });
  } finally {
    await browser.close();
  }
}

async function runSession(config) {
  requireEnvValue("PAYMENTS_LIVE_PATIENT_EMAIL");
  requireEnvValue("PAYMENTS_LIVE_PATIENT_PASSWORD");
  const slug = requireEnvValue("PAYMENTS_LIVE_PUBLIC_THERAPIST_SLUG");
  const fixture = await getPublicFixture(config, slug);
  const service = await getService(config, fixture.service_id);
  assertAmountWithinCap({
    amountCents: service.price_cents,
    maxAmountCents,
  });
  evidence.session = {
    plannedAmountCents: service.price_cents,
    serviceId: fixture.service_id,
    therapistSlug: slug,
  };

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({
      recordVideo: { dir: `${evidenceDir}/live-session` },
    });
    const page = await context.newPage();
    const reservationPath = buildReservationPath(fixture, "stripe_phase3_live");
    await login(page, {
      email: process.env.PAYMENTS_LIVE_PATIENT_EMAIL,
      next: reservationPath,
      password: process.env.PAYMENTS_LIVE_PATIENT_PASSWORD,
      role: "cliente",
    });

    const checkoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/public/reservation/checkout") &&
        response.request().method() === "POST",
      { timeout: 90_000 },
    );
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /Avançar para pagamento/i }).click();
    await page
      .locator("#reservation-embedded-checkout iframe")
      .first()
      .waitFor({ state: "visible", timeout: 90_000 });

    const checkoutResponse = await checkoutResponsePromise;
    const checkoutPayload = await checkoutResponse.json();
    if (!checkoutPayload?.ok || !checkoutPayload.checkout?.checkoutSessionId) {
      throw new Error(`session_checkout_failed:${checkoutResponse.status()}`);
    }

    const checkoutSessionId = checkoutPayload.checkout.checkoutSessionId;
    evidence.session.checkoutSessionId = maskStripeId(checkoutSessionId);
    addCheck(
      "session_checkout_opened",
      "pass",
      "Checkout embedded LIVE aberto no navegador visível; operador deve inserir cartão real manualmente.",
    );

    const completed = await waitForPageUrl(
      page,
      /\/reserva\/sucesso\?.*session_id=/,
      900_000,
    );
    if (!completed) {
      addCheck(
        "session_payment_completion",
        "blocked",
        "Pagamento LIVE da sessão não foi concluído dentro da janela manual.",
      );
      return;
    }

    const session =
      await config.stripe.checkout.sessions.retrieve(checkoutSessionId);
    evidence.session.stripePaymentStatus = session.payment_status;
    addCheck(
      "session_stripe_paid",
      session.payment_status === "paid" ? "pass" : "fail",
      `Stripe Checkout retornou payment_status=${session.payment_status}.`,
    );
    await waitForSessionPaymentState(config, {
      checkoutSessionId,
      status: "paid",
    });
  } finally {
    await browser.close();
  }
}

async function runConnect(config) {
  const therapistProfileId = requireEnvValue(
    "PAYMENTS_LIVE_THERAPIST_PROFILE_ID",
  );
  const sessionPaymentId = requireEnvValue("PAYMENTS_LIVE_SESSION_PAYMENT_ID");
  if (!config.internalOperationsToken) {
    throw new Error(
      "PAYMENTS_INTERNAL_OPERATIONS_TOKEN is required for connect stage.",
    );
  }

  const connectAccount = await getConnectAccount(config, therapistProfileId);
  const account = await retrieveAccountV2(
    config,
    connectAccount.stripe_account_id,
  );
  const transfersStatus = getV2StripeTransfersStatus(account);
  evidence.connect = {
    connectAccountId: connectAccount.id,
    stripeAccountId: maskStripeId(connectAccount.stripe_account_id),
    transfersStatus,
  };
  if (transfersStatus !== "active") {
    addCheck(
      "connect_v2_transfers_active",
      "blocked",
      `Connect v2 stripe_transfers status=${transfersStatus}; transferência real não será criada.`,
    );
    return;
  }

  const payment = await getSessionPayment(config, sessionPaymentId);
  assertAmountWithinCap({
    amountCents: payment.therapist_amount_cents,
    maxAmountCents,
  });
  await invokeInternalFunction(config, "evaluate-transfer-eligibility", {
    sessionPaymentId,
  });
  const evaluated = await getSessionPayment(config, sessionPaymentId);
  evidence.connect.transferStatusAfterEligibility = evaluated.transfer_status;
  evidence.connect.eligibleAt = evaluated.eligible_at;
  if (evaluated.transfer_status !== "eligible") {
    addCheck(
      "connect_transfer_eligibility",
      "blocked",
      `Pagamento ainda não elegível (${evaluated.transfer_status}); janela/política normal preservada.`,
    );
    return;
  }

  const paidAt = new Date(evaluated.paid_at || evaluated.created_at);
  const periodStart = paidAt.toISOString().slice(0, 10);
  const periodEnd = new Date(paidAt.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const batch = await invokeInternalFunction(
    config,
    "create-weekly-payout-batch",
    {
      referencePeriodEnd: periodEnd,
      referencePeriodStart: periodStart,
    },
  );
  const batchId = batch.data?.batchId;
  if (!batchId) throw new Error("payout_batch_missing");
  const batchRows = await supabaseGet(
    config,
    `/rest/v1/payout_batches?select=id,item_count,therapist_amount_cents,status&id=eq.${encodeURIComponent(batchId)}&limit=1`,
  );
  const batchRow = batchRows[0];
  evidence.connect.payoutBatchId = batchId;
  evidence.connect.batchTherapistAmountCents =
    batchRow?.therapist_amount_cents ?? null;
  if (!batchRow || batchRow.item_count !== 1) {
    throw new Error("live_batch_item_count_not_safe");
  }
  assertAmountWithinCap({
    amountCents: batchRow.therapist_amount_cents,
    maxAmountCents,
  });
  const processed = await invokeInternalFunction(
    config,
    "process-payout-batch",
    {
      batchId,
    },
  );
  evidence.connect.processResult = sanitizeTransferResults(
    processed.data?.results,
  );
  await waitForStripeTransfer(config, sessionPaymentId);
}

async function runReport(config) {
  const therapistProfileId =
    process.env.PAYMENTS_LIVE_THERAPIST_PROFILE_ID?.trim();
  const sessionPaymentId = process.env.PAYMENTS_LIVE_SESSION_PAYMENT_ID?.trim();
  const checkoutSessionId =
    process.env.PAYMENTS_LIVE_CHECKOUT_SESSION_ID?.trim();

  evidence.report = {};
  if (therapistProfileId) {
    evidence.report.subscription = await getLatestSubscriptionEvidence(
      config,
      therapistProfileId,
    );
    evidence.report.connect = await getConnectReport(
      config,
      therapistProfileId,
    );
  }
  if (sessionPaymentId) {
    evidence.report.sessionPayment = await getSessionPaymentReport(
      config,
      sessionPaymentId,
    );
  }
  if (checkoutSessionId) {
    const session =
      await config.stripe.checkout.sessions.retrieve(checkoutSessionId);
    evidence.report.checkout = {
      id: maskStripeId(session.id),
      livemode: session.livemode,
      mode: session.mode,
      paymentStatus: session.payment_status,
      status: session.status,
    };
  }
  addCheck(
    "live_report_generated",
    "pass",
    "Relatório LIVE sanitizado gerado.",
  );
}

async function checkStripeApi(config) {
  try {
    const account = await config.stripe.accounts.retrieve();
    evidence.stripeAccount = {
      country: account.country ?? null,
      id: maskStripeId(account.id),
    };
    addCheck(
      "stripe_api_live",
      account.livemode !== false ? "pass" : "pass",
      "Stripe API LIVE respondeu.",
    );
  } catch (error) {
    addCheck(
      "stripe_api_live",
      "blocked",
      `Stripe API indisponível: ${safeError(error)}.`,
    );
  }
}

async function checkBillingCatalog(config) {
  if (!config.serviceRoleKey) {
    addCheck(
      "billing_catalog_live",
      "blocked",
      "SUPABASE_SERVICE_ROLE_KEY ausente.",
    );
    return;
  }
  const rows = await getBillingPlanPriceRows(config);
  const paidRows = rows.filter((row) => row.unit_amount_cents > 0);
  const results = [];
  let failed = false;
  for (const row of paidRows) {
    if (!row.stripe_price_id) {
      failed = true;
      results.push({
        ok: false,
        plan: row.billing_plans?.code ?? null,
        reason: "stripe_price_id_missing",
      });
      continue;
    }

    try {
      const price = await config.stripe.prices.retrieve(row.stripe_price_id);
      const ok =
        price.active === true &&
        price.livemode === true &&
        price.unit_amount === row.unit_amount_cents;
      failed ||= !ok;
      results.push({
        active: price.active,
        amountMatches: price.unit_amount === row.unit_amount_cents,
        livemode: price.livemode,
        ok,
        plan: row.billing_plans?.code ?? null,
        priceId: maskStripeId(price.id),
      });
    } catch (error) {
      failed = true;
      results.push({
        ok: false,
        priceId: maskStripeId(row.stripe_price_id),
        reason: safeError(error),
      });
    }
  }
  evidence.billingCatalog = results;
  addCheck(
    "billing_catalog_live",
    failed || !paidRows.length ? "fail" : "pass",
    failed
      ? "Catálogo LIVE diverge da Stripe."
      : `${paidRows.length} preço(s) pagos LIVE conferidos.`,
  );
}

async function checkWebhookEndpoints(config) {
  try {
    const endpoints = await config.stripe.webhookEndpoints.list({ limit: 100 });
    const rows = endpoints.data.map((endpoint) => ({
      enabledEvents: endpoint.enabled_events,
      id: maskStripeId(endpoint.id),
      status: endpoint.status,
      url: sanitizeUrl(endpoint.url),
    }));
    evidence.webhookEndpoints = rows;
    const expectedHost = `${config.supabaseRef}.supabase.co`;
    const platform = endpoints.data.find(
      (endpoint) =>
        endpoint.status === "enabled" &&
        endpoint.url.includes(expectedHost) &&
        endpoint.url.includes("/functions/v1/stripe-billing-webhook"),
    );
    const connect = endpoints.data.find(
      (endpoint) =>
        endpoint.status === "enabled" &&
        endpoint.url.includes(expectedHost) &&
        endpoint.url.includes("/functions/v1/stripe-connect-webhook"),
    );
    addCheck(
      "platform_webhook_live",
      platform ? "pass" : "fail",
      platform
        ? "Webhook LIVE da plataforma aponta para Supabase PROD."
        : "Webhook LIVE da plataforma não encontrado para Supabase PROD.",
    );
    addCheck(
      "connect_webhook_live",
      connect ? "pass" : "fail",
      connect
        ? "Webhook LIVE Connect aponta para Supabase PROD."
        : "Webhook LIVE Connect não encontrado para Supabase PROD.",
    );
  } catch (error) {
    addCheck("webhook_endpoints_live", "blocked", safeError(error));
  }
}

async function checkEdgeFunctions(config) {
  const functions = [
    "stripe-billing-webhook",
    "stripe-connect-webhook",
    "session-booking-checkout",
    "stripe-create-session-payment",
    "stripe-create-subscription-checkout",
    "stripe-subscription-checkout-status",
    "stripe-connect-sync-account",
    "evaluate-transfer-eligibility",
    "create-weekly-payout-batch",
    "process-payout-batch",
  ];
  const rows = [];
  for (const functionName of functions) {
    try {
      const response = await fetch(
        `${config.supabaseUrl}/functions/v1/${functionName}`,
        {
          method: "OPTIONS",
          signal: AbortSignal.timeout(10_000),
        },
      );
      rows.push({
        functionName,
        ok: response.status >= 200 && response.status < 500,
        status: response.status,
      });
    } catch (error) {
      rows.push({ functionName, ok: false, reason: safeError(error) });
    }
  }
  evidence.edgeFunctions = rows;
  addCheck(
    "edge_functions_live",
    rows.every((row) => row.ok) ? "pass" : "fail",
    `${rows.filter((row) => row.ok).length}/${rows.length} Edge Functions responderam ao OPTIONS.`,
  );
}

async function checkLiveFixtures(config) {
  if (!config.serviceRoleKey) {
    addCheck("live_fixtures", "blocked", "SUPABASE_SERVICE_ROLE_KEY ausente.");
    return;
  }
  const slug = process.env.PAYMENTS_LIVE_PUBLIC_THERAPIST_SLUG?.trim();
  const therapistProfileId =
    process.env.PAYMENTS_LIVE_THERAPIST_PROFILE_ID?.trim();
  const patientEmail = process.env.PAYMENTS_LIVE_PATIENT_EMAIL?.trim();
  const therapistEmail = process.env.PAYMENTS_LIVE_THERAPIST_EMAIL?.trim();
  evidence.liveFixtures = {
    hasPatientEmail: Boolean(patientEmail),
    hasPublicTherapistSlug: Boolean(slug),
    hasTherapistEmail: Boolean(therapistEmail),
    therapistProfileId: therapistProfileId || null,
  };
  if (slug) {
    try {
      const fixture = await getPublicFixture(config, slug);
      const service = await getService(config, fixture.service_id);
      evidence.liveFixtures.publicTherapist = {
        serviceId: fixture.service_id,
        servicePriceCents: service.price_cents,
        slug,
      };
      addCheck(
        "live_public_fixture",
        service.price_cents <= maxAmountCents ? "pass" : "blocked",
        service.price_cents <= maxAmountCents
          ? "Fixture pública LIVE tem serviço dentro do teto."
          : "Fixture pública LIVE excede o teto de R$ 5,00.",
      );
    } catch (error) {
      addCheck("live_public_fixture", "blocked", safeError(error));
    }
  }
}

async function checkFinanceTestControlsDenied(config) {
  if (!config.internalOperationsToken) {
    addCheck(
      "finance_test_controls_live_denied",
      "blocked",
      "PAYMENTS_INTERNAL_OPERATIONS_TOKEN ausente; chamada negativa não executada.",
    );
    return;
  }
  try {
    const response = await invokeInternalFunction(
      config,
      "evaluate-transfer-eligibility",
      {
        nowOverride: "2026-01-01T00:00:00.000Z",
        sessionPaymentId: "00000000-0000-4000-8000-000000000000",
      },
      { acceptFailure: true },
    );
    const code = response.error?.code ?? null;
    addCheck(
      "finance_test_controls_live_denied",
      code === "finance_test_control_not_allowed" ? "pass" : "fail",
      code === "finance_test_control_not_allowed"
        ? "Override temporal financeiro negado em LIVE."
        : `Resposta inesperada para override temporal: ${code ?? "sem_codigo"}.`,
    );
  } catch (error) {
    addCheck("finance_test_controls_live_denied", "blocked", safeError(error));
  }
}

async function login(page, { email, next = "/", password, role }) {
  const loginPath = role === "cliente" ? "/cliente/login" : "/terapeuta/login";
  const url = `${baseUrl}${loginPath}?next=${encodeURIComponent(next)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page
    .waitForLoadState("networkidle", { timeout: 45_000 })
    .catch(() => {});
}

async function waitForPageUrl(page, pattern, timeoutMs) {
  try {
    await page.waitForURL(pattern, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function waitForSubscriptionState(
  config,
  { expectedPlan, status, therapistProfileId },
) {
  const row = await poll(async () => {
    const rows = await supabaseGet(
      config,
      `/rest/v1/therapist_subscriptions?select=id,plan_code,status,stripe_subscription_id,stripe_checkout_session_id,updated_at&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&order=updated_at.desc&limit=1`,
    );
    const item = rows[0];
    if (item && item.plan_code === expectedPlan && status.includes(item.status))
      return item;
    return null;
  }, 180_000);
  evidence.billing.localSubscription = {
    id: row.id,
    planCode: row.plan_code,
    status: row.status,
    stripeSubscriptionId: maskStripeId(row.stripe_subscription_id),
  };
  addCheck(
    "billing_local_subscription",
    "pass",
    `Supabase convergiu para ${row.plan_code}/${row.status}.`,
  );
}

async function waitForSessionPaymentState(
  config,
  { checkoutSessionId, status },
) {
  const row = await poll(async () => {
    const rows = await supabaseGet(
      config,
      `/rest/v1/session_payments?select=id,booking_id,financial_status,gross_amount_cents,therapist_amount_cents,stripe_payment_intent_id,stripe_charge_id,transfer_status,paid_at&stripe_checkout_session_id=eq.${encodeURIComponent(checkoutSessionId)}&limit=1`,
    );
    const item = rows[0];
    if (item?.financial_status === status) return item;
    return null;
  }, 180_000);
  evidence.session.localPayment = sanitizeSessionPayment(row);
  addCheck(
    "session_local_payment",
    "pass",
    `Supabase convergiu para session_payments.financial_status=${row.financial_status}.`,
  );
}

async function waitForStripeTransfer(config, sessionPaymentId) {
  const row = await poll(async () => {
    const rows = await supabaseGet(
      config,
      `/rest/v1/stripe_transfers?select=id,amount_cents,status,stripe_transfer_id,session_payment_id&session_payment_id=eq.${encodeURIComponent(sessionPaymentId)}&limit=1`,
    );
    return rows[0] ?? null;
  }, 180_000);
  const transfer = row.stripe_transfer_id
    ? await config.stripe.transfers.retrieve(row.stripe_transfer_id)
    : null;
  evidence.connect.transfer = {
    amountCents: row.amount_cents,
    id: row.id,
    status: row.status,
    stripeTransferId: maskStripeId(row.stripe_transfer_id),
    stripeTransferReversed: transfer?.reversed ?? null,
  };
  addCheck(
    "connect_transfer_created",
    "pass",
    "Transfer LIVE registrado na Stripe e no Supabase.",
  );
}

async function poll(fn, timeoutMs) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("poll_timeout");
}

async function getBillingPrice(config, plan) {
  const [row] = await supabaseGet(
    config,
    `/rest/v1/billing_plan_prices?select=id,unit_amount_cents,stripe_price_id,billing_plans!inner(code)&billing_plans.code=eq.${plan}&is_active=eq.true&is_public=eq.true&offer_key=is.null&interval=eq.month&limit=1`,
  );
  if (!row?.stripe_price_id) throw new Error("billing_price_not_found");
  return row;
}

async function getBillingPlanPriceRows(config) {
  return supabaseGet(
    config,
    "/rest/v1/billing_plan_prices?select=billing_plans(code),stripe_price_id,unit_amount_cents,is_active,is_public,offer_key&is_active=eq.true",
  );
}

async function getLiveSmokeCoupon(config, therapistProfileId) {
  const couponId = process.env.PAYMENTS_LIVE_SMOKE_COUPON_ID?.trim();
  if (
    !shouldUseLiveSmokeCoupon({
      couponId,
      enabled: process.env.PAYMENTS_LIVE_SMOKE_ENABLED,
      therapistProfileId,
      therapistProfileIdAllowlist:
        process.env.PAYMENTS_LIVE_SMOKE_THERAPIST_PROFILE_ID,
    })
  ) {
    return null;
  }
  const coupon = await config.stripe.coupons.retrieve(couponId);
  if (!coupon.valid || coupon.livemode !== true) {
    throw new Error("live_smoke_coupon_invalid");
  }
  return {
    amount_off: coupon.amount_off,
    id: coupon.id,
    percent_off: coupon.percent_off,
  };
}

async function getPublicFixture(config, slug) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/public_therapist_search?select=slug,public_name,service_id,therapy_slug,next_slot_at&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  const fixture = rows[0];
  if (!fixture?.service_id || !fixture?.next_slot_at) {
    throw new Error(`public_fixture_not_ready:${slug}`);
  }
  return fixture;
}

async function getService(config, serviceId) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/therapist_services?select=id,price_cents,duration_minutes,status,is_reservable&id=eq.${encodeURIComponent(serviceId)}&limit=1`,
  );
  if (!rows[0]) throw new Error("service_not_found");
  return rows[0];
}

async function getConnectAccount(config, therapistProfileId) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,stripe_transfers_status,operational_status&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&limit=1`,
  );
  if (!rows[0]) throw new Error("connect_account_missing");
  return rows[0];
}

async function getSessionPayment(config, sessionPaymentId) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/session_payments?select=id,booking_id,created_at,paid_at,financial_status,gross_amount_cents,therapist_amount_cents,stripe_charge_id,transfer_status,eligible_at,therapist_profile_id&id=eq.${encodeURIComponent(sessionPaymentId)}&limit=1`,
  );
  if (!rows[0]) throw new Error("session_payment_missing");
  return rows[0];
}

async function getLatestSubscriptionEvidence(config, therapistProfileId) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/therapist_subscriptions?select=id,plan_code,status,stripe_subscription_id,stripe_checkout_session_id,updated_at&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&order=updated_at.desc&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;
  let stripeStatus = null;
  if (row.stripe_subscription_id) {
    const subscription = await config.stripe.subscriptions.retrieve(
      row.stripe_subscription_id,
    );
    stripeStatus = subscription.status;
  }
  return {
    id: row.id,
    localPlan: row.plan_code,
    localStatus: row.status,
    stripeStatus,
    stripeSubscriptionId: maskStripeId(row.stripe_subscription_id),
  };
}

async function getConnectReport(config, therapistProfileId) {
  const rows = await supabaseGet(
    config,
    `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id,stripe_transfers_status,operational_status,last_synced_at&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;
  const account = await retrieveAccountV2(config, row.stripe_account_id);
  return {
    id: row.id,
    localOperationalStatus: row.operational_status,
    localTransfersStatus: row.stripe_transfers_status,
    stripeAccountId: maskStripeId(row.stripe_account_id),
    stripeTransfersStatus: getV2StripeTransfersStatus(account),
  };
}

async function getSessionPaymentReport(config, sessionPaymentId) {
  const row = await getSessionPayment(config, sessionPaymentId);
  let paymentIntentStatus = null;
  if (row.stripe_charge_id) {
    const charge = await config.stripe.charges.retrieve(row.stripe_charge_id);
    paymentIntentStatus =
      typeof charge.payment_intent === "string" ? "charge_linked" : null;
  }
  return {
    ...sanitizeSessionPayment(row),
    stripeChargeId: maskStripeId(row.stripe_charge_id),
    stripePaymentIntentStatus: paymentIntentStatus,
  };
}

async function retrieveAccountV2(config, accountId) {
  const include = new URLSearchParams();
  include.append("include[0]", "configuration.recipient");
  include.append("include[1]", "configuration.merchant");
  include.append("include[2]", "requirements");
  const response = await fetch(
    `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(accountId)}?${include.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${config.stripeSecretKey}`,
        "Stripe-Version": "2026-06-24.dahlia",
      },
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`stripe_v2_account_failed:${response.status}`);
  }
  return JSON.parse(text);
}

function getV2StripeTransfersStatus(account) {
  return (
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? "inactive"
  );
}

async function invokeInternalFunction(
  config,
  functionName,
  body,
  options = {},
) {
  const response = await fetch(
    `${config.supabaseUrl}/functions/v1/${functionName}`,
    {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "x-tes-internal-operations-token": config.internalOperationsToken,
      },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok && !options.acceptFailure) {
    throw new Error(
      `${functionName}_failed:${response.status}:${payload?.error?.code ?? "unknown"}`,
    );
  }
  return payload ?? { ok: response.ok };
}

async function supabaseGet(config, path) {
  if (!config.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `supabase_get_failed:${response.status}:${text.slice(0, 120)}`,
    );
  }
  return text ? JSON.parse(text) : [];
}

function buildReservationPath(fixture, source) {
  const params = new URLSearchParams({
    etapa: "preparar",
    service: fixture.service_id,
    slot: fixture.next_slot_at,
    source,
    therapist: fixture.slug,
  });
  if (fixture.therapy_slug) params.set("therapy", fixture.therapy_slug);
  return `/reserva?${params.toString()}`;
}

function sanitizeSessionPayment(row) {
  return {
    bookingId: row.booking_id,
    financialStatus: row.financial_status,
    grossAmountCents: row.gross_amount_cents,
    id: row.id,
    paidAt: row.paid_at,
    therapistAmountCents: row.therapist_amount_cents,
    transferStatus: row.transfer_status,
  };
}

function sanitizeTransferResults(results) {
  if (!Array.isArray(results)) return [];
  return results.map((result) => ({
    itemId: result.itemId,
    ok: result.ok,
    skipped: result.skipped ?? undefined,
    transferId: maskStripeId(result.transferId),
  }));
}

function getStripeId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : (value.id ?? null);
}

function getTargetSupabaseUrl() {
  const explicit =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  return explicit.replace(/\/+$/g, "");
}

function requireEnvValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = rawArgs.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function addCheck(name, status, summary) {
  checks.push({ name, status, summary });
}

function formatStatus(status) {
  return {
    blocked: "BLOCKED",
    fail: "FAIL",
    pass: "PASS",
    warn: "WARN",
  }[status];
}
