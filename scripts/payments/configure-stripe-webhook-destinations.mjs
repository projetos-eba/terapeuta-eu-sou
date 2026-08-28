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
const replaceConnectThin = process.argv.includes("--replace-connect-thin");
const recoverIncompleteConnectThin = process.argv.includes(
  "--recover-incomplete-connect-thin",
);
const confirmSecretRotation = process.argv.includes(
  "--confirm-secret-rotation",
);

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
const legacyDestinations = [];

for (const contract of contracts) {
  const exact = listed.data.filter((destination) =>
    matchesContract(destination, contract),
  );
  let destination = exact[0] ?? null;
  const legacy = legacyThinDestination(listed.data, contract);

  if (exact.length > 1) {
    throw new Error(`Duplicate canonical destination: ${contract.name}.`);
  }

  if (
    destination &&
    legacy &&
    destination.status === "disabled" &&
    legacy.status === "enabled"
  ) {
    if (!recoverIncompleteConnectThin) {
      throw new Error(
        `The canonical thin destination ${contract.name} is disabled while the legacy destination is enabled. ` +
          "Do not enable it because its signing secret may not have been persisted. " +
          "Inspect both destinations, then rerun with --recover-incomplete-connect-thin.",
      );
    }
    if (!replaceConnectThin || !confirmSecretRotation) {
      throw new Error(
        "Incomplete thin destination recovery also requires " +
          "--replace-connect-thin --confirm-secret-rotation.",
      );
    }
    if (destination.webhook_endpoint?.url !== legacy.webhook_endpoint?.url) {
      throw new Error(
        `Refusing to recover ${contract.name}: canonical and legacy URLs differ.`,
      );
    }

    await stripe.v2.core.eventDestinations.del(destination.id);
    destination = null;
  }

  if (!destination) {
    if (!legacy) {
      throw new Error(`Canonical destination is missing: ${contract.name}.`);
    }
    if (!replaceConnectThin || !confirmSecretRotation) {
      throw new Error(
        `The thin Connect destination ${contract.name} has the wrong scope. ` +
          "Deploy the compatible migration and Edge Function first; then rerun with " +
          "--replace-connect-thin --confirm-secret-rotation.",
      );
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
      webhook_endpoint: { url: legacy.webhook_endpoint.url },
    });
    await stripe.v2.core.eventDestinations.disable(destination.id);
    const signingSecret = destination.webhook_endpoint?.signing_secret;
    if (!signingSecret) {
      throw new Error(`Signing secret was not returned for ${contract.name}.`);
    }
    createdSecrets[contract.secretName] = signingSecret;
    legacyDestinations.push(legacy);
  } else if (!sameEvents(destination.enabled_events, contract.events)) {
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
  persistWebhookSecrets({ createdSecrets, selected, target });
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

for (const legacy of legacyDestinations) {
  const current = await stripe.v2.core.eventDestinations.retrieve(legacy.id, {
    include: ["webhook_endpoint.url"],
  });
  if (current.status === "enabled") {
    await stripe.v2.core.eventDestinations.disable(current.id);
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
    thinDestinationsReplaced: legacyDestinations.length,
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
      scope: "@self",
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

function sameEvents(actual, expected) {
  return JSON.stringify([...actual].sort()) ===
    JSON.stringify([...expected].sort());
}

function isRelevantDestination(destination) {
  return [
    "/functions/v1/stripe-billing-webhook",
    "/functions/v1/stripe-connect-webhook",
  ].some((suffix) => destination.webhook_endpoint?.url?.endsWith(suffix));
}

function legacyThinDestination(destinations, contract) {
  if (contract.payload !== "thin" || contract.scope !== "@self") return null;

  const candidates = destinations.filter(
    (destination) =>
      destination.name === contract.name &&
      destination.event_payload === contract.payload &&
      !destination.events_from?.includes(contract.scope) &&
      destination.webhook_endpoint?.url?.endsWith(contract.path) &&
      isRemoteUrl(destination.webhook_endpoint.url),
  );
  if (candidates.length > 1) {
    throw new Error(`Duplicate legacy thin destination: ${contract.name}.`);
  }
  return candidates[0] ?? null;
}

function isRemoteUrl(value) {
  if (!value) return false;
  try {
    return !["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function persistWebhookSecrets({ createdSecrets, selected, target }) {
  const endpointUrl = selected
    .map(({ destination }) => destination.webhook_endpoint?.url)
    .find(Boolean);
  const projectRef = projectRefFromUrl(endpointUrl);
  const localEnvFile = path.resolve(
    "supabase",
    "functions",
    target === "live" ? ".env.production" : ".env.homolog",
  );
  if (!fs.existsSync(localEnvFile)) {
    throw new Error(`Local Functions env file was not found for ${target}.`);
  }
  const previousLocalEnv = fs.readFileSync(localEnvFile, "utf8");
  const nextLocalEnv = replaceEnvSecrets(previousLocalEnv, createdSecrets);
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "tes-stripe-secrets-"),
  );
  const temporaryEnv = path.join(temporaryDirectory, "webhook.env");

  try {
    fs.writeFileSync(localEnvFile, nextLocalEnv, { mode: 0o600 });
    fs.writeFileSync(
      temporaryEnv,
      Object.entries(createdSecrets)
        .map(([name, value]) => `${name}=${value}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    const supabaseCliEntry = path.resolve(
      "node_modules",
      "supabase",
      "dist",
      "supabase.js",
    );
    if (!fs.existsSync(supabaseCliEntry)) {
      throw new Error("Local Supabase CLI entrypoint was not found.");
    }
    execFileSync(
      process.execPath,
      [
        supabaseCliEntry,
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
  } catch (error) {
    fs.writeFileSync(localEnvFile, previousLocalEnv, { mode: 0o600 });
    throw error;
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function replaceEnvSecrets(content, secrets) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  let next = content;

  for (const [name, value] of Object.entries(secrets)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    if (pattern.test(next)) {
      next = next.replace(pattern, `${name}=${value}`);
    } else {
      next = `${next.replace(/\s*$/, "")}${newline}${name}=${value}${newline}`;
    }
  }

  return next;
}

function projectRefFromUrl(value) {
  const hostname = new URL(value).hostname;
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (!match)
    throw new Error("Could not infer Supabase project ref from webhook URL.");
  return match[1];
}
