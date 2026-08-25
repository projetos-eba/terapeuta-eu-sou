#!/usr/bin/env node

import Stripe from "stripe";

import {
  getStripeMode,
  getStripeSecretKey,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();
const stripeKey = getStripeSecretKey();

if (!stripeKey || getStripeMode(stripeKey) !== "test") {
  throw new Error("Connect payout readiness verification requires test mode.");
}

const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
const accounts = await stripe.v2.core.accounts
  .list({
    applied_configurations: ["recipient"],
    limit: 20,
  })
  .autoPagingToArray({ limit: 1000 });
const tesAccounts = accounts.filter(
  (account) =>
    account.livemode === false &&
    account.metadata?.system === "tes" &&
    account.metadata?.environment === "test" &&
    Boolean(account.metadata?.tes_therapist_id),
);

if (tesAccounts.length === 0) {
  throw new Error("No TES-managed Connect account was found in test mode.");
}

const checks = [];
for (const account of tesAccounts) {
  const settings = await stripe.balanceSettings.retrieve(
    {},
    { stripeContext: account.id },
  );
  const payouts = settings.payments?.payouts;
  const interval = payouts?.schedule?.interval ?? null;
  const status = payouts?.status ?? null;
  checks.push({
    account: maskAccountId(account.id),
    interval,
    ready: status === "enabled" && interval === "daily",
    status,
  });
}

const blocked = checks.filter((check) => !check.ready);
console.log(
  JSON.stringify({
    blocked: blocked.length,
    mode: "test",
    ready: checks.length - blocked.length,
    tesManagedAccounts: checks.length,
    accounts: checks,
  }),
);

if (blocked.length > 0) {
  throw new Error(
    "One or more TES Connect accounts are not ready for daily payouts.",
  );
}

function maskAccountId(value) {
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}
