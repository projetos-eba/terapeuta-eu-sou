#!/usr/bin/env node

import Stripe from "stripe";

import {
  getStripeMode,
  getStripeSecretKey,
  loadEnvFiles,
} from "./env-utils.mjs";
import {
  connectSnapshotEvents,
  connectThinEvents,
  platformSnapshotEvents,
} from "./stripe-webhook-events.mjs";

loadEnvFiles();
const stripeKey = getStripeSecretKey();
if (!stripeKey || getStripeMode(stripeKey) !== "test") {
  throw new Error(
    "Webhook destination verification requires Stripe test mode.",
  );
}

const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
const destinations = await stripe.v2.core.eventDestinations.list({
  include: ["webhook_endpoint.url"],
  limit: 100,
});

const canonicalNames = new Set([
  "stripe-billing-webhook-homolog",
  "stripe-connect-webhook-snapshot-homolog",
  "stripe-connect-webhook-thin-homolog",
]);
const unexpectedRelevantDestinations = destinations.data.filter(
  (destination) =>
    destination.status === "enabled" &&
    destination.livemode === false &&
    isRemoteRelevantUrl(destination.webhook_endpoint?.url) &&
    !canonicalNames.has(destination.name),
);

if (unexpectedRelevantDestinations.length > 0) {
  throw new Error(
    "Unexpected enabled remote destination targets a canonical TES payment webhook.",
  );
}

const checks = [
  checkDestination({
    destinations: destinations.data,
    eventPayload: "snapshot",
    events: platformSnapshotEvents,
    eventsFrom: "@self",
    name: "stripe-billing-webhook-homolog",
    path: "/functions/v1/stripe-billing-webhook",
  }),
  checkDestination({
    destinations: destinations.data,
    eventPayload: "snapshot",
    events: connectSnapshotEvents,
    eventsFrom: "@accounts",
    name: "stripe-connect-webhook-snapshot-homolog",
    path: "/functions/v1/stripe-connect-webhook",
  }),
  checkDestination({
    destinations: destinations.data,
    eventPayload: "thin",
    events: connectThinEvents,
    eventsFrom: "@accounts",
    name: "stripe-connect-webhook-thin-homolog",
    path: "/functions/v1/stripe-connect-webhook",
  }),
];

console.log(
  JSON.stringify({
    destinations: checks,
    mode: "test",
    relevantRemoteDestinationCount: checks.length,
    verified: true,
  }),
);

function checkDestination(input) {
  const matches = input.destinations.filter(
    (destination) =>
      destination.name === input.name &&
      destination.status === "enabled" &&
      destination.livemode === false &&
      destination.event_payload === input.eventPayload &&
      destination.events_from?.includes(input.eventsFrom) &&
      destination.webhook_endpoint?.url?.endsWith(input.path),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one enabled ${input.name} destination in test mode.`,
    );
  }
  const actual = [...matches[0].enabled_events].sort();
  const expected = [...input.events].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${input.name} event matrix is incomplete or divergent.`);
  }
  return {
    eventCount: expected.length,
    name: input.name,
    payload: input.eventPayload,
    scope: input.eventsFrom,
  };
}

function isRemoteRelevantUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const isLocal = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    return (
      !isLocal &&
      [
        "/functions/v1/stripe-billing-webhook",
        "/functions/v1/stripe-connect-webhook",
      ].some((path) => url.pathname.endsWith(path))
    );
  } catch {
    return false;
  }
}
