#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";

const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://hml.terapeutaeusou.com.br";
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

const steps = [
  {
    args: ["scripts/payments/stripe-phase3-readiness.mjs", "--target=hml"],
    name: "readiness_hml",
  },
  {
    args: ["scripts/payments/complete-session-checkout-hml.mjs", "--scenario=approved"],
    name: "patient_session_approved",
  },
  {
    args: ["scripts/payments/complete-session-checkout-hml.mjs", "--scenario=declined"],
    name: "patient_session_declined",
  },
  {
    args: ["scripts/payments/complete-session-checkout-hml.mjs", "--scenario=expired"],
    name: "patient_session_expired",
  },
  {
    args: ["scripts/payments/complete-session-checkout-hml.mjs", "--scenario=refund"],
    name: "patient_session_refund",
  },
  {
    args: ["scripts/payments/complete-subscription-checkout-local.mjs"],
    env: {
      PAYMENTS_E2E_KEEP_SUBSCRIPTION: "true",
      PAYMENTS_E2E_PLAN: "premium",
      PAYMENTS_E2E_RUN_ID: `tes-phase3-hml-${runStamp}-premium`,
      PAYMENTS_E2E_SCENARIO: "approved",
    },
    name: "therapist_subscription_premium_approved",
  },
  {
    args: ["scripts/payments/exercise-subscription-lifecycle-local.mjs"],
    env: {
      PAYMENTS_E2E_RUN_ID: `tes-phase3-hml-${runStamp}-premium`,
    },
    name: "therapist_subscription_lifecycle",
  },
  {
    args: ["scripts/payments/complete-subscription-checkout-local.mjs"],
    env: {
      PAYMENTS_E2E_PLAN: "premium_plus",
      PAYMENTS_E2E_RUN_ID: `tes-phase3-hml-${runStamp}-premium-plus`,
      PAYMENTS_E2E_SCENARIO: "approved",
    },
    name: "therapist_subscription_premium_plus_approved",
  },
  {
    args: ["scripts/payments/complete-subscription-checkout-local.mjs"],
    env: {
      PAYMENTS_E2E_PLAN: "premium_plus",
      PAYMENTS_E2E_RUN_ID: `tes-phase3-hml-${runStamp}-declined`,
      PAYMENTS_E2E_SCENARIO: "declined",
    },
    name: "therapist_subscription_declined",
  },
  {
    args: ["scripts/payments/complete-subscription-checkout-local.mjs"],
    env: {
      PAYMENTS_E2E_PLAN: "premium_plus",
      PAYMENTS_E2E_RUN_ID: `tes-phase3-hml-${runStamp}-canceled`,
      PAYMENTS_E2E_SCENARIO: "canceled",
    },
    name: "therapist_subscription_canceled",
  },
];

if (process.env.PAYMENTS_HML_PROMOTION_CODE?.trim()) {
  steps.splice(2, 0, {
    args: [
      "scripts/payments/complete-session-checkout-hml.mjs",
      "--scenario=promotion_approved",
    ],
    name: "patient_session_promotion_approved",
  });
}

for (const step of steps) {
  console.log(JSON.stringify({ phase: "stripe_3a_hml", step: step.name }));
  const code = await runNode(step.args, step.env ?? {});
  if (code !== 0) {
    console.error(
      JSON.stringify({
        code,
        failedStep: step.name,
        phase: "stripe_3a_hml",
      }),
    );
    process.exit(code);
  }
}

console.log(JSON.stringify({ ok: true, phase: "stripe_3a_hml" }));

function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      env: {
        ...process.env,
        ...env,
        PLAYWRIGHT_BASE_URL: baseUrl,
      },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}
