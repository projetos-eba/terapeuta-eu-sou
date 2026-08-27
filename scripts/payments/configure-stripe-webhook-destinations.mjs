#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Stripe from "stripe";

import { getStripeMode, getStripeSecretKey } from "./env-utils.mjs";
import {
  connectSnapshotEvents,
  connectThinEvents,
  platformSnapshotEvents,
} from "./stripe-webhook-events.mjs";

const targetArgument = process.argv.find((value) =>
  value.startsWith("--target="),
);
const target = targetArgument?.split("=")[1];
if (target !== "test" && target !== "live") {
  throw new Error("Use --target=test or --target=live.");
}

const stripeKey = getStripeSecretKey();
if (!stripeKey || getStripeMode(stripeKey) !== target) {
  throw new Error(`Stripe key does not match requested ${target} target.`);
}

const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
const listed = await stripe.v2.core.eventDestinations.list({
  include: ["webhook_endpoint.url"],
  limit: 100,
});
const contracts = destinationContracts(target);
const selected = [];
const createdSecrets = {};

for (const contract of contracts) {
  const exact = listed.data.filter((destination) =>
    matchesContract(destination, contract),
  );
  let destination = exact[0] ?? null;

  if (exact.length > 1) {
    throw new Error(`Duplicate canonical destination: ${contract.name}.`);
  }

  if (!destination) {
    if (target !== "live" || contract.scope !== "@accounts") {
      throw new Error(`Canonical destination is missing: ${contract.name}.`);
    }
    const source = listed.data.find(
      (candidate) =>
        candidate.event_payload === contract.payload &&
        candidate.webhook_endpoint?.url?.endsWith(contract.path) &&
        isRemoteUrl(candidate.webhook_endpoint.url),
    );
    if (!source?.webhook_endpoint?.url) {
      throw new Error(`No remote URL available for ${contract.name}.`);
    }

    destination = await stripe.v2.core.eventDestinations.create({
      description: "TES canonical Stripe Connect destination",
      enabled_events: contract.events,
      event_payload: contract.payload,
      events_from: [contract.scope],
      include: ["webhook_endpoint.signing_secret", "webhook_endpoint.url"],
      name: contract.name,
      snapshot_api_version:
        contract.payload === "snapshot" ? "2026-06-24.dahlia" : undefined,
      type: "webhook_endpoint",
      webhook_endpoint: { url: source.webhook_endpoint.url },
    });
    await stripe.v2.core.eventDestinations.disable(destination.id);
    const signingSecret = destination.webhook_endpoint?.signing_secret;
    if (!signingSecret) {
      throw new Error(`Signing secret was not returned for ${contract.name}.`);
    }
    createdSecrets[contract.secretName] = signingSecret;
  } else {
    destination = await stripe.v2.core.eventDestinations.update(
      destination.id,
      {
        enabled_events: contract.events,
      },
    );
  }

  selected.push({ contract, destination });
}

if (Object.keys(createdSecrets).length > 0) {
  if (target !== "live") {
    throw new Error("Unexpected webhook secret rotation outside Live Mode.");
  }
  persistLiveWebhookSecrets(createdSecrets, selected);
}

for (const { destination } of selected) {
  const current = await stripe.v2.core.eventDestinations.retrieve(
    destination.id,
    { include: ["webhook_endpoint.url"] },
  );
  if (current.status !== "enabled") {
    await stripe.v2.core.eventDestinations.enable(current.id);
  }
}

const selectedIds = new Set(selected.map(({ destination }) => destination.id));
for (const destination of listed.data) {
  if (
    selectedIds.has(destination.id) ||
    !isRelevantDestination(destination) ||
    !isRemoteUrl(destination.webhook_endpoint?.url)
  ) {
    continue;
  }
  if (target === "live") {
    await stripe.v2.core.eventDestinations.del(destination.id);
  } else if (destination.status === "enabled") {
    throw new Error("Unexpected enabled Test Mode payment destination.");
  }
}

console.log(
  JSON.stringify({
    configured: contracts.map((contract) => ({
      eventCount: contract.events.length,
      name: contract.name,
      payload: contract.payload,
      scope: contract.scope,
    })),
    secretsRotated: Object.keys(createdSecrets).length,
    target,
  }),
);

function destinationContracts(mode) {
  const suffix = mode === "test" ? "homolog" : "live";
  return [
    {
      events: platformSnapshotEvents,
      name:
        mode === "test"
          ? "stripe-billing-webhook-homolog"
          : "stripe-billing-webhook",
      path: "/functions/v1/stripe-billing-webhook",
      payload: "snapshot",
      scope: "@self",
      secretName: "STRIPE_PLATFORM_WEBHOOK_SECRET",
    },
    {
      events: connectSnapshotEvents,
      name: `stripe-connect-webhook-snapshot-${suffix}`,
      path: "/functions/v1/stripe-connect-webhook",
      payload: "snapshot",
      scope: "@accounts",
      secretName: "STRIPE_CONNECT_WEBHOOK_SECRET",
    },
    {
      events: connectThinEvents,
      name: `stripe-connect-webhook-thin-${suffix}`,
      path: "/functions/v1/stripe-connect-webhook",
      payload: "thin",
      scope: "@accounts",
      secretName: "STRIPE_CONNECT_V2_WEBHOOK_SECRET",
    },
  ];
}

function matchesContract(destination, contract) {
  return (
    destination.name === contract.name &&
    destination.event_payload === contract.payload &&
    destination.events_from?.includes(contract.scope) &&
    destination.webhook_endpoint?.url?.endsWith(contract.path) &&
    isRemoteUrl(destination.webhook_endpoint.url)
  );
}

function isRelevantDestination(destination) {
  return [
    "/functions/v1/stripe-billing-webhook",
    "/functions/v1/stripe-connect-webhook",
  ].some((suffix) => destination.webhook_endpoint?.url?.endsWith(suffix));
}

function isRemoteUrl(value) {
  if (!value) return false;
  try {
    return !["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function persistLiveWebhookSecrets(secrets, destinations) {
  const envPath = path.resolve("supabase/functions/.env.production");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      "supabase/functions/.env.production is required for Live secret rotation.",
    );
  }

  let content = fs.readFileSync(envPath, "utf8");
  for (const [name, value] of Object.entries(secrets)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, content, { mode: 0o600 });

  const endpointUrl = destinations
    .map(({ destination }) => destination.webhook_endpoint?.url)
    .find(Boolean);
  const projectRef = projectRefFromUrl(endpointUrl);
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "tes-stripe-secrets-"),
  );
  const temporaryEnv = path.join(temporaryDirectory, "webhook.env");

  try {
    fs.writeFileSync(
      temporaryEnv,
      Object.entries(secrets)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    execFileSync(
      "npx",
      [
        "supabase",
        "secrets",
        "set",
        "--env-file",
        temporaryEnv,
        "--project-ref",
        projectRef,
        "--yes",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function projectRefFromUrl(value) {
  const hostname = new URL(value).hostname;
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (!match)
    throw new Error("Could not infer Supabase project ref from webhook URL.");
  return match[1];
}
