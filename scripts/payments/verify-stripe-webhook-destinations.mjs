#!/usr/bin/env node

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
const page = await stripe.v2.core.eventDestinations.list({
  include: ["webhook_endpoint.url"],
  limit: 100,
});
const suffix = target === "test" ? "homolog" : "live";
const contracts = [
  {
    events: platformSnapshotEvents,
    name:
      target === "test"
        ? "stripe-billing-webhook-homolog"
        : "stripe-billing-webhook",
    path: "/functions/v1/stripe-billing-webhook",
    payload: "snapshot",
    scope: "@self",
  },
  {
    events: connectSnapshotEvents,
    name: `stripe-connect-webhook-snapshot-${suffix}`,
    path: "/functions/v1/stripe-connect-webhook",
    payload: "snapshot",
    scope: "@accounts",
  },
  {
    events: connectThinEvents,
    name: `stripe-connect-webhook-thin-${suffix}`,
    path: "/functions/v1/stripe-connect-webhook",
    payload: "thin",
    scope: "@self",
  },
];

const relevantEnabled = page.data.filter(
  (destination) =>
    destination.status === "enabled" &&
    isRemoteUrl(destination.webhook_endpoint?.url) &&
    contracts.some((contract) =>
      destination.webhook_endpoint?.url?.endsWith(contract.path),
    ),
);
if (relevantEnabled.length !== 3) {
  throw new Error(
    "Expected exactly three enabled canonical payment destinations.",
  );
}

const checks = contracts.map((contract) => {
  const matches = relevantEnabled.filter(
    (destination) =>
      destination.name === contract.name &&
      destination.event_payload === contract.payload &&
      destination.events_from?.includes(contract.scope) &&
      destination.webhook_endpoint?.url?.endsWith(contract.path),
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one canonical destination: ${contract.name}.`);
  }
  const actual = [...matches[0].enabled_events].sort();
  const expected = [...contract.events].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${contract.name} event matrix diverges.`);
  }
  return {
    eventCount: expected.length,
    name: contract.name,
    payload: contract.payload,
    scope: contract.scope,
  };
});

console.log(
  JSON.stringify({
    destinations: checks,
    relevantRemoteDestinationCount: relevantEnabled.length,
    target,
    verified: true,
  }),
);

function isRemoteUrl(value) {
  if (!value) return false;
  try {
    return !["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}
