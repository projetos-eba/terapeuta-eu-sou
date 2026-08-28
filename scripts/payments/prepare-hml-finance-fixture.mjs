#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

import { getStripeMode, loadEnvFiles } from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";
const CONFIRMATION_FLAG = "--confirm-controlled-hml-time-advance";
const dryRun = process.argv.includes("--dry-run");

loadEnvFiles(["supabase/functions/.env.homolog"]);

const bookingId = readArgument("--booking-id");
if (!/^[0-9a-f-]{36}$/i.test(bookingId ?? "")) {
  throw new Error("A valid --booking-id is required.");
}
if (dryRun === process.argv.includes(CONFIRMATION_FLAG)) {
  throw new Error(`Choose exactly one of --dry-run or ${CONFIRMATION_FLAG}.`);
}
if (getStripeMode() !== "test") {
  throw new Error("Refusing: the local HML Stripe key is not in Test mode.");
}
if (process.env.TES_FINANCE_TEST_CONTROLS_ENABLED?.trim() !== "true") {
  throw new Error(
    "Refusing: TES_FINANCE_TEST_CONTROLS_ENABLED must be true locally.",
  );
}

const baseUrl = `https://${HML_PROJECT_REF}.supabase.co`;
const serviceKey = readHmlServiceRoleKey();

const [booking] = await get(
  `/rest/v1/bookings?select=id,status,starts_at,ends_at,patient_profile_id,therapist_profile_id&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
);
const [payment] = await get(
  `/rest/v1/session_payments?select=id,booking_id,policy_version_id,financial_status,service_status,service_confirmed_at,transfer_status,therapist_amount_cents,stripe_charge_id,stripe_balance_transaction_id&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
);
if (!booking || !payment)
  throw new Error("Dedicated paid fixture was not found.");
if (booking.status !== "confirmed" || payment.financial_status !== "paid") {
  throw new Error("Refusing: fixture is not a confirmed paid booking.");
}
if (!payment.stripe_charge_id || !payment.stripe_balance_transaction_id) {
  throw new Error(
    "Refusing: canonical Stripe charge reconciliation is incomplete.",
  );
}
if (
  ["batched", "transfer_pending", "transferred"].includes(
    payment.transfer_status,
  )
) {
  throw new Error("Refusing: fixture already entered the transfer lifecycle.");
}
if (
  payment.therapist_amount_cents <= 0 ||
  payment.therapist_amount_cents > 20_000
) {
  throw new Error(
    "Refusing: fixture amount is outside the controlled HML cap.",
  );
}

const [policy] = await get(
  `/rest/v1/financial_policy_versions?select=id,version,patient_auto_confirmation_days,therapist_auto_confirmation_days,transfer_safety_period_days&id=eq.${encodeURIComponent(payment.policy_version_id)}&limit=1`,
);
if (
  !policy ||
  policy.patient_auto_confirmation_days !== 7 ||
  policy.therapist_auto_confirmation_days !== 30 ||
  policy.transfer_safety_period_days !== 1
) {
  throw new Error(
    "Refusing: fixture policy is not the canonical 7/30/1 lifecycle.",
  );
}

const [patient, therapist, eligible, existingConfirmations] = await Promise.all(
  [
    get(
      `/rest/v1/patient_profiles?select=user_id&id=eq.${encodeURIComponent(booking.patient_profile_id)}&limit=1`,
    ),
    get(
      `/rest/v1/therapist_profiles?select=user_id&id=eq.${encodeURIComponent(booking.therapist_profile_id)}&limit=1`,
    ),
    get(
      "/rest/v1/session_payments?select=id&transfer_status=eq.eligible&limit=2",
    ),
    get(
      `/rest/v1/session_participant_confirmations?select=participant_role,outcome,source,due_at,confirmed_at&booking_id=eq.${encodeURIComponent(bookingId)}&order=participant_role.asc`,
    ),
  ],
);
if (!patient[0]?.user_id || !therapist[0]?.user_id) {
  throw new Error("Refusing: booking participants are incomplete.");
}
if (eligible.length > 0) {
  throw new Error(
    "Refusing: HML already has eligible payments outside this preparation stage.",
  );
}

const endsAt = Date.parse(booking.ends_at);
const patientDueAt = new Date(
  endsAt + policy.patient_auto_confirmation_days * 86_400_000,
).toISOString();
const therapistDueAt = new Date(
  endsAt + policy.therapist_auto_confirmation_days * 86_400_000,
).toISOString();

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        bookingId,
        mode: "dry_run",
        ok: true,
        policy: {
          patientDays: policy.patient_auto_confirmation_days,
          safetyDays: policy.transfer_safety_period_days,
          therapistDays: policy.therapist_auto_confirmation_days,
          version: policy.version,
        },
        preconditions: {
          canonicalStripeReconciliation: true,
          eligiblePaymentsBefore: eligible.length,
          existingConfirmationCount: existingConfirmations.length,
          financialStatus: payment.financial_status,
          therapistAmountCents: payment.therapist_amount_cents,
          transferStatus: payment.transfer_status,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await recordAutomaticConfirmation({
  actorUserId: patient[0].user_id,
  confirmedAt: patientDueAt,
  role: "patient",
});
const firstFinalize = await rpc("finalize_bilateral_session_confirmation_v1", {
  p_booking_id: bookingId,
  p_now: patientDueAt,
});
if (firstFinalize !== "waiting_confirmation") {
  throw new Error(
    `Patient-only confirmation did not remain independent: ${firstFinalize}.`,
  );
}

await recordAutomaticConfirmation({
  actorUserId: therapist[0].user_id,
  confirmedAt: therapistDueAt,
  role: "therapist",
});
const secondFinalize = await rpc("finalize_bilateral_session_confirmation_v1", {
  p_booking_id: bookingId,
  p_now: therapistDueAt,
});
if (secondFinalize !== "confirmed") {
  throw new Error(
    `Bilateral confirmation did not finalize: ${secondFinalize}.`,
  );
}

const [finalPayment, confirmations] = await Promise.all([
  get(
    `/rest/v1/session_payments?select=id,service_status,service_confirmed_at,transfer_status,eligible_at&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  ),
  get(
    `/rest/v1/session_participant_confirmations?select=participant_role,outcome,source,due_at,confirmed_at&booking_id=eq.${encodeURIComponent(bookingId)}&order=participant_role.asc`,
  ),
]);
const final = finalPayment[0];
if (
  final?.service_status !== "confirmed_bilateral" ||
  confirmations.length !== 2 ||
  confirmations.some(
    (row) => row.outcome !== "completed" || row.source !== "automatic",
  )
) {
  throw new Error("Controlled bilateral fixture state did not converge.");
}

console.log(
  JSON.stringify(
    {
      bookingId,
      firstFinalize,
      ok: true,
      policy: {
        patientDays: policy.patient_auto_confirmation_days,
        safetyDays: policy.transfer_safety_period_days,
        therapistDays: policy.therapist_auto_confirmation_days,
        version: policy.version,
      },
      secondFinalize,
      state: {
        confirmationCount: confirmations.length,
        serviceStatus: final.service_status,
        transferStatus: final.transfer_status,
      },
    },
    null,
    2,
  ),
);

async function recordAutomaticConfirmation({ actorUserId, confirmedAt, role }) {
  const result = await rpc("record_session_participant_confirmation_v1", {
    p_actor_user_id: actorUserId,
    p_booking_id: bookingId,
    p_confirmed_at: confirmedAt,
    p_outcome: "completed",
    p_request_id: crypto.randomUUID(),
    p_source: "automatic",
  });
  const confirmation = result?.confirmation;
  if (
    confirmation?.source !== "automatic" ||
    confirmation?.outcome !== "completed" ||
    !sameInstant(confirmation?.confirmedAt, confirmedAt)
  ) {
    throw new Error(
      `${role} automatic confirmation did not match its contractual due instant.`,
    );
  }
}

function sameInstant(left, right) {
  const leftEpoch = Date.parse(left ?? "");
  const rightEpoch = Date.parse(right ?? "");
  return Number.isFinite(leftEpoch) && leftEpoch === rightEpoch;
}

async function get(path) {
  return request(path, { method: "GET" });
}

async function rpc(name, body) {
  return request(`/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HML request failed with status ${response.status}.`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readHmlServiceRoleKey() {
  const command = `npx.cmd supabase projects api-keys --project-ref ${HML_PROJECT_REF} -o json`;
  const output = execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  const keys = JSON.parse(output);
  const match = keys.find(
    (candidate) =>
      candidate.name === "service_role" && candidate.type === "legacy",
  );
  if (!match?.api_key) throw new Error("HML service role key is unavailable.");
  return match.api_key;
}

function readArgument(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : null;
}
