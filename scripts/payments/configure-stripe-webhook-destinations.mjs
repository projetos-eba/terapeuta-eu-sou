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
    "Webhook destination configuration requires Stripe test mode.",
  );
}

const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
const destinations = await stripe.v2.core.eventDestinations.list({
  include: ["webhook_endpoint.url"],
  limit: 100,
});

const contracts = [
  {
    eventPayload: "snapshot",
    events: platformSnapshotEvents,
    eventsFrom: "@self",
    name: "stripe-billing-webhook-homolog",
    path: "/functions/v1/stripe-billing-webhook",
  },
  {
    eventPayload: "snapshot",
    events: connectSnapshotEvents,
    eventsFrom: "@accounts",
    name: "stripe-connect-webhook-snapshot-homolog",
    path: "/functions/v1/stripe-connect-webhook",
  },
  {
    eventPayload: "thin",
    events: connectThinEvents,
    eventsFrom: "@accounts",
    name: "stripe-connect-webhook-thin-homolog",
    path: "/functions/v1/stripe-connect-webhook",
  },
];

const configured = [];

for (const contract of contracts) {
  const matches = destinations.data.filter(
    (destination) =>
      destination.name === contract.name &&
      destination.livemode === false &&
      destination.event_payload === contract.eventPayload &&
      destination.events_from?.includes(contract.eventsFrom) &&
      destination.webhook_endpoint?.url?.endsWith(contract.path) &&
      !isLocalUrl(destination.webhook_endpoint.url),
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one remote ${contract.name} destination in test mode.`,
    );
  }

  const destination = matches[0];
  await stripe.v2.core.eventDestinations.update(destination.id, {
    enabled_events: contract.events,
  });

  if (destination.status !== "enabled") {
    await stripe.v2.core.eventDestinations.enable(destination.id);
  }

  configured.push({
    eventCount: contract.events.length,
    name: contract.name,
    payload: contract.eventPayload,
    scope: contract.eventsFrom,
  });
}

console.log(
  JSON.stringify({
    configured,
    mode: "test",
    remoteOnly: true,
  }),
);

function isLocalUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return true;
  }
}
