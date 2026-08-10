#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import Stripe from "stripe";

import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeMode,
  getStripeSecretKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();

const args = new Set(process.argv.slice(2));
const target = readArg("target", "hml");
const expectedHmlRef =
  process.env.PAYMENTS_HML_SUPABASE_REF?.trim() ||
  "emzwqkmrryuqvqiohqnu";
const publicTherapistSlug =
  process.env.PAYMENTS_HML_PUBLIC_THERAPIST_SLUG?.trim() ||
  "antonio-ferrari-e2e";
const evidenceDir =
  process.env.PAYMENTS_PHASE3_EVIDENCE_DIR?.trim() ||
  "test-results/stripe-phase3";
const evidenceFile = `${evidenceDir}/readiness-${target}-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}.json`;

if (!["hml", "live-readiness"].includes(target)) {
  console.error("Use --target=hml or --target=live-readiness.");
  process.exit(1);
}

const checks = [];
const evidence = {
  generatedAt: new Date().toISOString(),
  target,
  checks,
  environment: {},
};

try {
  await run();
} catch (error) {
  addCheck("readiness_script", "fail", safeError(error));
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);

const failed = checks.filter((check) => check.status === "fail");
const blocked = checks.filter((check) => check.status === "blocked");

for (const check of checks) {
  console.log(`${formatStatus(check.status)} ${check.name}: ${check.summary}`);
}
console.log(`Evidence: ${evidenceFile}`);

if (failed.length || blocked.length) {
  process.exitCode = 1;
}

async function run() {
  const supabaseUrl = getTargetSupabaseUrl();
  const supabaseRef = supabaseProjectRef(supabaseUrl);
  const stripeSecretKey = getStripeSecretKey();
  const stripeMode = getStripeMode(stripeSecretKey);
  const serviceRoleKey = getSupabaseServiceRoleKey();

  evidence.environment = {
    stripeMode: stripeMode ?? "missing",
    supabaseHost: safeHost(supabaseUrl),
    supabaseRef,
  };

  if (!stripeSecretKey) {
    addCheck("stripe_secret_key", "blocked", "STRIPE_SECRET_KEY ausente.");
    return;
  }

  assertStripeModeAllowedForSupabaseUrl({
    stripeMode,
    supabaseUrl,
  });

  if (target === "hml") {
    addCheck(
      "stripe_mode_hml",
      stripeMode === "test" ? "pass" : "fail",
      stripeMode === "test"
        ? "HML está usando Stripe test mode."
        : "HML deve usar Stripe test mode.",
    );
    addCheck(
      "supabase_hml_ref",
      supabaseRef === expectedHmlRef ? "pass" : "fail",
      supabaseRef === expectedHmlRef
        ? `Supabase HML confirmado (${expectedHmlRef}).`
        : `Supabase esperado ${expectedHmlRef}, encontrado ${supabaseRef ?? "desconhecido"}.`,
    );
  } else {
    addCheck(
      "stripe_mode_live_readiness",
      stripeMode === "live" ? "pass" : "fail",
      stripeMode === "live"
        ? "Readiness LIVE usa chave Stripe live."
        : "Readiness LIVE exige chave Stripe live, sem transações.",
    );
    addCheck(
      "supabase_live_not_local",
      isLocalSupabaseUrl(supabaseUrl) ? "fail" : "pass",
      isLocalSupabaseUrl(supabaseUrl)
        ? "Readiness LIVE não pode apontar para Supabase local."
        : "Supabase LIVE/readiness não aponta para ambiente local.",
    );
  }

  if (!serviceRoleKey) {
    addCheck(
      "supabase_service_role",
      "blocked",
      "SUPABASE_SERVICE_ROLE_KEY ausente; não é possível validar catálogo/fixture remoto.",
    );
    return;
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-06-24.dahlia",
  });

  await checkStripeApi(stripe);
  await checkBillingCatalog({ serviceRoleKey, stripe, supabaseUrl });
  await checkWebhookEndpoints(stripe, supabaseRef);
  await checkEdgeFunctions(supabaseUrl);

  if (target === "hml") {
    await checkPublicTherapistFixture({
      serviceRoleKey,
      slug: publicTherapistSlug,
      supabaseUrl,
    });
  }
}

async function checkStripeApi(stripe) {
  try {
    const account = await stripe.accounts.retrieve();
    evidence.stripeAccount = {
      country: account.country ?? null,
      id: maskStripeId(account.id),
    };
    addCheck("stripe_api", "pass", "Stripe API respondeu com a conta da plataforma.");
  } catch (error) {
    addCheck("stripe_api", "blocked", `Stripe API indisponível: ${safeError(error)}.`);
  }
}

async function checkBillingCatalog({ serviceRoleKey, stripe, supabaseUrl }) {
  const rows = await supabaseGet({
    path:
      "/rest/v1/billing_plan_prices?select=billing_plans(code),interval,stripe_price_id,stripe_lookup_key,unit_amount_cents,is_active&is_active=eq.true",
    serviceRoleKey,
    supabaseUrl,
  });

  const paidRows = rows.filter((row) => row.unit_amount_cents > 0);
  if (!paidRows.length) {
    addCheck("billing_catalog", "fail", "Nenhum preço pago ativo encontrado no catálogo local.");
    return;
  }

  const details = [];
  let hasFailure = false;

  for (const row of paidRows) {
    if (!row.stripe_price_id) {
      hasFailure = true;
      details.push({
        lookupKey: row.stripe_lookup_key ?? null,
        ok: false,
        reason: "stripe_price_id_missing",
      });
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(row.stripe_price_id);
      const amountMatches = price.unit_amount === row.unit_amount_cents;
      const modeMatches =
        (price.livemode ? "live" : "test") ===
        (target === "live-readiness" ? "live" : "test");
      const activeMatches = price.active === true;
      const ok = amountMatches && modeMatches && activeMatches;
      hasFailure ||= !ok;
      details.push({
        active: price.active,
        amountMatches,
        interval: row.interval,
        livemode: price.livemode,
        modeMatches,
        ok,
        plan: row.billing_plans?.code ?? null,
        priceId: maskStripeId(price.id),
      });
    } catch (error) {
      hasFailure = true;
      details.push({
        ok: false,
        priceId: maskStripeId(row.stripe_price_id),
        reason: safeError(error),
      });
    }
  }

  evidence.billingCatalog = details;
  addCheck(
    "billing_catalog",
    hasFailure ? "fail" : "pass",
    hasFailure
      ? "Há divergência entre catálogo local e Stripe."
      : `${details.length} preço(s) pagos ativos conferidos na Stripe.`,
  );
}

async function checkWebhookEndpoints(stripe, supabaseRef) {
  let endpoints;
  try {
    endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  } catch (error) {
    addCheck(
      "stripe_webhook_endpoints",
      "blocked",
      `Não foi possível listar webhooks Stripe: ${safeError(error)}.`,
    );
    return;
  }

  const expectedHost = supabaseRef ? `${supabaseRef}.supabase.co` : null;
  const rows = endpoints.data.map((endpoint) => ({
    enabledEvents: endpoint.enabled_events,
    id: maskStripeId(endpoint.id),
    status: endpoint.status,
    url: sanitizeUrl(endpoint.url),
  }));
  evidence.webhookEndpoints = rows;

  const platform = endpoints.data.find(
    (endpoint) =>
      endpoint.status === "enabled" &&
      endpoint.url.includes("/functions/v1/stripe-billing-webhook") &&
      (!expectedHost || endpoint.url.includes(expectedHost)),
  );
  const connect = endpoints.data.find(
    (endpoint) =>
      endpoint.status === "enabled" &&
      endpoint.url.includes("/functions/v1/stripe-connect-webhook") &&
      (!expectedHost || endpoint.url.includes(expectedHost)),
  );

  const platformEvents = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "invoice.paid",
    "payment_intent.succeeded",
    "charge.refunded",
    "transfer.updated",
  ];
  const connectEvents = ["account.updated"];

  addCheck(
    "platform_webhook_endpoint",
    platform && hasEvents(platform, platformEvents) ? "pass" : "fail",
    platform
      ? "Webhook da plataforma encontrado com eventos essenciais."
      : "Webhook da plataforma não encontrado para a Edge Function esperada.",
  );
  addCheck(
    "connect_webhook_endpoint",
    connect && hasEvents(connect, connectEvents) ? "pass" : "fail",
    connect
      ? "Webhook Connect snapshot encontrado com evento essencial."
      : "Webhook Connect snapshot não encontrado para a Edge Function esperada.",
  );
}

async function checkEdgeFunctions(supabaseUrl) {
  const functions = [
    "stripe-billing-webhook",
    "stripe-connect-webhook",
    "session-booking-checkout",
    "stripe-create-session-payment",
    "stripe-create-subscription-checkout",
    "stripe-subscription-checkout-status",
    "stripe-connect-create-account",
    "stripe-connect-create-account-link",
    "stripe-connect-sync-account",
  ];
  const results = [];

  for (const functionName of functions) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(10_000),
      });
      const ok = response.status >= 200 && response.status < 500;
      results.push({ functionName, ok, status: response.status });
    } catch (error) {
      results.push({ functionName, ok: false, reason: safeError(error) });
    }
  }

  evidence.edgeFunctions = results;
  const failed = results.filter((item) => !item.ok);
  addCheck(
    "edge_functions",
    failed.length ? "fail" : "pass",
    failed.length
      ? `${failed.length} Edge Function(s) não responderam ao OPTIONS.`
      : `${results.length} Edge Function(s) responderam ao OPTIONS.`,
  );
}

async function checkPublicTherapistFixture({ serviceRoleKey, slug, supabaseUrl }) {
  const searchRows = await supabaseGet({
    path: `/rest/v1/public_therapist_search?select=slug,public_name,service_id,therapy_slug,next_slot_at&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    serviceRoleKey,
    supabaseUrl,
  });
  const fixture = searchRows[0] ?? null;
  evidence.publicTherapistFixture = fixture
    ? {
        hasNextSlot: Boolean(fixture.next_slot_at),
        publicName: fixture.public_name,
        serviceId: fixture.service_id,
        slug: fixture.slug,
        therapySlug: fixture.therapy_slug,
      }
    : null;
  addCheck(
    "public_therapist_fixture",
    fixture?.service_id && fixture?.next_slot_at ? "pass" : "fail",
    fixture
      ? "Fixture pública HML encontrada com serviço e próximo horário."
      : `Fixture pública HML não encontrada para slug ${slug}.`,
  );
}

async function supabaseGet({ path, serviceRoleKey, supabaseUrl }) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`supabase_get_failed:${response.status}:${text.slice(0, 120)}`);
  }

  return text ? JSON.parse(text) : [];
}

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix));
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

function hasEvents(endpoint, requiredEvents) {
  if (endpoint.enabled_events.includes("*")) return true;
  return requiredEvents.every((event) => endpoint.enabled_events.includes(event));
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function supabaseProjectRef(value) {
  const host = safeHost(value);
  const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
  return match?.[1] ?? null;
}

function isLocalSupabaseUrl(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(value);
}

function getTargetSupabaseUrl() {
  const explicit =
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    "";

  return (explicit || getSupabaseUrl()).replace(/\/+$/g, "");
}

function maskStripeId(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function safeError(error) {
  if (!(error instanceof Error)) return "unknown";
  return error.message.replace(/(sk|rk|pk|whsec)_(test|live)?_[A-Za-z0-9_]+/g, "$1_REDACTED");
}
