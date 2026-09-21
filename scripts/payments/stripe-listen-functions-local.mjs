#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  allSnapshotEvents,
  connectThinEvents,
} from "./stripe-webhook-events.mjs";

const root = process.cwd();
const stripeApiKey = loadStripeApiKey();
const replayCheckoutId = process.argv
  .find((argument) => argument.startsWith("--replay-checkout="))
  ?.slice("--replay-checkout=".length);
const connectUrl =
  "http://127.0.0.1:54321/functions/v1/stripe-connect-webhook";
const billingUrl =
  "http://127.0.0.1:54321/functions/v1/stripe-billing-webhook";
const children = new Set();
let functions = null;
let listenerSecretCaptured = false;

const listener = spawn(
  "stripe",
  [
    "listen",
    "--skip-update",
    "--events",
    allSnapshotEvents.join(","),
    "--thin-events",
    connectThinEvents.join(","),
    "--forward-to",
    billingUrl,
    "--forward-connect-to",
    connectUrl,
    "--forward-thin-to",
    connectUrl,
    "--forward-thin-connect-to",
    connectUrl,
  ],
  {
    cwd: root,
    env: { ...process.env, STRIPE_API_KEY: stripeApiKey },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
children.add(listener);

for (const stream of [listener.stdout, listener.stderr]) {
  stream.on("data", (chunk) => {
    const raw = String(chunk);
    const match = raw.match(/whsec_[A-Za-z0-9_]+/);
    if (match && !listenerSecretCaptured) {
      listenerSecretCaptured = true;
      startFunctions(match[0]);
    }
    process.stdout.write(redact(raw));
  });
}

listener.once("exit", (code) => {
  children.delete(listener);
  if (!listenerSecretCaptured) {
    process.stderr.write("Stripe CLI listener exited before readiness.\n");
    shutdown(code ?? 1);
  }
});

const readinessTimeout = setTimeout(() => {
  if (!listenerSecretCaptured) {
    process.stderr.write("Stripe CLI listener readiness timed out.\n");
    shutdown(1);
  }
}, 30_000);

function startFunctions(secret) {
  clearTimeout(readinessTimeout);
  process.stdout.write(
    "Stripe CLI listener ready; starting local Edge Functions with an ephemeral signing secret.\n",
  );
  functions = spawn(
    process.execPath,
    [path.join(root, "scripts", "start-local-functions.mjs")],
    {
      cwd: root,
      env: {
        ...process.env,
        STRIPE_CONNECT_V2_WEBHOOK_SECRET: secret,
        STRIPE_CONNECT_WEBHOOK_SECRET: secret,
        STRIPE_WEBHOOK_SECRET: secret,
        STRIPE_PLATFORM_WEBHOOK_SECRET: secret,
        TES_FINANCE_TEST_CONTROLS_ENABLED: "true",
        TES_SESSION_FINANCIAL_FLOW_V10_ENABLED: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.add(functions);
  for (const stream of [functions.stdout, functions.stderr]) {
    stream.on("data", (chunk) => process.stdout.write(redact(String(chunk))));
  }
  functions.once("exit", (code) => {
    children.delete(functions);
    process.stderr.write(`Local Edge Functions exited with code ${code ?? 1}.\n`);
    shutdown(code ?? 1);
  });
  if (replayCheckoutId) {
    replayCompletedCheckout(secret, replayCheckoutId).catch((error) => {
      process.stderr.write(
        `Signed Checkout replay failed: ${safeErrorCode(error)}.\n`,
      );
      shutdown(1);
    });
  }
}

async function replayCompletedCheckout(secret, checkoutId) {
  // The API gateway can answer while the Edge Runtime container is still
  // restarting. Give the newly injected signing secret time to become active.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  await waitForFunctions();
  const listed = spawnSync(
    "stripe",
    [
      "events",
      "list",
      "--type",
      "checkout.session.completed",
      "--limit",
      "100",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, STRIPE_API_KEY: stripeApiKey },
      windowsHide: true,
    },
  );
  if (listed.status !== 0) throw new Error("stripe_event_list_failed");
  const collection = JSON.parse(listed.stdout);
  const event = collection.data?.find(
    (candidate) => candidate?.data?.object?.id === checkoutId,
  );
  if (!event) throw new Error("completed_checkout_event_not_found");
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const response = await fetch(billingUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
  if (!response.ok) {
    let responseCode = null;
    try {
      const body = await response.json();
      responseCode = body?.error?.code;
    } catch {
      // The HTTP status remains sufficient and contains no sensitive data.
    }
    throw new Error(
      typeof responseCode === "string" && /^[a-z0-9_]{1,80}$/i.test(responseCode)
        ? responseCode
        : `webhook_http_${response.status}`,
    );
  }
  process.stdout.write(
    "Previously completed Checkout was accepted through the signed local webhook path.\n",
  );
}

async function waitForFunctions() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(billingUrl, { method: "OPTIONS" });
      if (response.status < 500) return;
    } catch {
      // The local runtime is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("functions_readiness_timeout");
}

function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "unknown";
  return /^[a-z0-9_]{1,80}$/i.test(message) ? message : "unknown";
}

function loadStripeApiKey() {
  for (const relativePath of [
    ["supabase", "functions", ".env.local"],
    ["supabase", "functions", ".env"],
  ]) {
    try {
      const source = readFileSync(path.join(root, ...relativePath), "utf8");
      const line = source
        .split(/\r?\n/)
        .find((candidate) => /^\s*STRIPE_SECRET_KEY\s*=/.test(candidate));
      const value = line
        ?.split("=", 2)[1]
        ?.trim()
        .replace(/^['"]|['"]$/g, "");
      if (value?.startsWith("sk_test_")) return value;
    } catch {
      // Try the next local-only environment file.
    }
  }
  throw new Error("local_stripe_test_key_missing");
}

function redact(value) {
  return value
    .replace(/whsec_[A-Za-z0-9_]+/g, "[redacted-stripe-webhook-secret]")
    .replace(/sk_(?:test|live)_[A-Za-z0-9_]+/g, "[redacted-stripe-key]");
}

function shutdown(code) {
  clearTimeout(readinessTimeout);
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => shutdown(0));
}
