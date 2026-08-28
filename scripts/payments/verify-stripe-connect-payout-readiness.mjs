#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

import Stripe from "stripe";

import {
  getStripeMode,
  getStripeSecretKey,
  loadEnvFiles,
} from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";
const projectRef = readArg("project-ref");

if (projectRef !== HML_PROJECT_REF) {
  throw new Error(
    "Connect payout readiness verification requires the explicit HML project ref.",
  );
}

loadEnvFiles(["supabase/functions/.env.homolog"]);
const stripeKey = getStripeSecretKey();

if (!stripeKey || getStripeMode(stripeKey) !== "test") {
  throw new Error(
    "Connect payout readiness verification requires Stripe test mode.",
  );
}

const supabaseUrl = `https://${projectRef}.supabase.co`;
const serviceRoleKey = getLinkedProjectServiceRoleKey(projectRef);
const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
const currentAccounts = await supabaseGet(
  "/rest/v1/therapist_connect_accounts?select=id,therapist_profile_id,stripe_account_id,operational_status,stripe_transfers_status,payouts_enabled,payout_status,payout_schedule_interval&is_current=eq.true&order=created_at.asc",
);

if (currentAccounts.length === 0) {
  throw new Error("No current Connect account was found in the HML project.");
}

const checks = [];

for (const local of currentAccounts) {
  const remote = await retrieveAccountV2(local.stripe_account_id);
  if (!ownershipMatches(remote, local.therapist_profile_id)) {
    checks.push({
      account: maskAccountId(local.stripe_account_id),
      outcome: "blocked",
      reason: "ownership_mismatch",
    });
    continue;
  }

  const settings = await stripe.balanceSettings.retrieve(
    {},
    { stripeContext: remote.id },
  );
  const payouts = settings.payments?.payouts;
  const remoteState = {
    operationalStatus:
      getTransferStatus(remote) === "active" ? "ready" : "restricted",
    payoutScheduleInterval: payouts?.schedule?.interval ?? null,
    payoutStatus: payouts?.status ?? null,
    payoutsEnabled: payouts?.status === "enabled",
    transfersStatus: getTransferStatus(remote),
  };
  const localState = {
    operationalStatus: local.operational_status,
    payoutScheduleInterval: local.payout_schedule_interval,
    payoutStatus: local.payout_status,
    payoutsEnabled: local.payouts_enabled === true,
    transfersStatus: local.stripe_transfers_status,
  };
  const financialHistory = await supabaseGet(
    `/rest/v1/session_payments?select=id&therapist_profile_id=eq.${encodeURIComponent(
      local.therapist_profile_id,
    )}&therapist_amount_cents=gt.0&limit=1`,
  );
  const outcome = evaluateReadiness({
    hasPositiveFinancialHistory: financialHistory.length > 0,
    local: localState,
    remote: remoteState,
  });
  checks.push({
    account: maskAccountId(remote.id),
    outcome: outcome.kind,
    reason: outcome.reason,
  });
}

const totals = {
  blocked: checks.filter((check) => check.outcome === "blocked").length,
  currentAccounts: checks.length,
  isolated: checks.filter((check) => check.outcome === "isolated").length,
  ready: checks.filter((check) => check.outcome === "ready").length,
};

console.log(
  JSON.stringify({
    accounts: checks,
    mode: "test",
    projectRef,
    totals,
  }),
);

if (totals.blocked > 0) {
  throw new Error(
    "One or more current HML Connect accounts block payout readiness.",
  );
}

function evaluateReadiness(input) {
  if (!statesMatch(input.local, input.remote)) {
    return { kind: "blocked", reason: "snapshot_mismatch" };
  }
  const ready =
    input.remote.operationalStatus === "ready" &&
    input.remote.transfersStatus === "active" &&
    input.remote.payoutsEnabled === true &&
    input.remote.payoutStatus === "enabled" &&
    input.remote.payoutScheduleInterval === "daily";
  if (ready) return { kind: "ready", reason: "ready" };
  if (input.hasPositiveFinancialHistory) {
    return { kind: "blocked", reason: "blocking_financial_history" };
  }
  return { kind: "isolated", reason: "no_financial_history" };
}

function statesMatch(left, right) {
  return (
    left.operationalStatus === right.operationalStatus &&
    left.payoutScheduleInterval === right.payoutScheduleInterval &&
    left.payoutStatus === right.payoutStatus &&
    left.payoutsEnabled === right.payoutsEnabled &&
    left.transfersStatus === right.transfersStatus
  );
}

function getLinkedProjectServiceRoleKey(ref) {
  const executable =
    process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? [
          "/d",
          "/c",
          `npx.cmd supabase projects api-keys --project-ref ${ref} -o json`,
        ]
      : [
          "supabase",
          "projects",
          "api-keys",
          "--project-ref",
          ref,
          "-o",
          "json",
        ];
  const raw = execFileSync(executable, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const keys = JSON.parse(raw);
  const serviceRole = keys.find(
    (key) =>
      key.name === "service_role" && key.disabled !== true && key.api_key,
  );
  if (!serviceRole) {
    throw new Error(
      "HML service role key is unavailable through the linked project.",
    );
  }
  return serviceRole.api_key;
}

function getTransferStatus(account) {
  return (
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? null
  );
}

async function retrieveAccountV2(accountId) {
  const include = new URLSearchParams();
  include.append("include[0]", "configuration.recipient");
  include.append("include[1]", "requirements");
  include.append("include[2]", "future_requirements");
  const response = await fetch(
    `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(accountId)}?${include.toString()}`,
    {
      headers: {
        authorization: `Bearer ${stripeKey}`,
        "stripe-version": "2026-06-24.dahlia",
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Stripe Accounts v2 read failed with status ${response.status}.`,
    );
  }
  return response.json();
}

function ownershipMatches(account, therapistProfileId) {
  return (
    account.livemode === false &&
    account.metadata?.system === "tes" &&
    account.metadata?.environment === "test" &&
    account.metadata?.tes_therapist_id === therapistProfileId
  );
}

async function supabaseGet(path) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `HML read-only query failed with status ${response.status}.`,
    );
  }
  return response.json();
}

function readArg(name) {
  const prefix = `--${name}=`;
  const value = process.argv
    .slice(2)
    .find((candidate) => candidate.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value || !/^[a-z0-9]{20}$/.test(value)) {
    throw new Error(`--${name}=<project-ref> is required.`);
  }
  return value;
}

function maskAccountId(value) {
  if (typeof value !== "string" || value.length < 12) return "unavailable";
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}
