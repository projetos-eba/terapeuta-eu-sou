#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { getStripeMode, loadEnvFiles } from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";
const baseUrl = `https://${HML_PROJECT_REF}.supabase.co`;

loadEnvFiles(["supabase/functions/.env.homolog"]);

const bookingId = readArgument("--booking-id");
if (!/^[0-9a-f-]{36}$/i.test(bookingId ?? "")) {
  throw new Error("A valid --booking-id is required.");
}
if (getStripeMode() !== "test") {
  throw new Error("Refusing: the configured Stripe key is not in Test mode.");
}

const serviceKey = readHmlServiceRoleKey();
const [booking] = await get(
  `/rest/v1/bookings?select=id,status,payment_status,starts_at&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
);
const [payment] = await get(
  `/rest/v1/session_payments?select=id,payment_flow_version,financial_status,transfer_status,stripe_checkout_session_id,stripe_payment_intent_id,stripe_charge_id,stripe_connect_account_id_snapshot,therapist_amount_cents,stripe_balance_status,stripe_balance_available_on,metadata&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
);

if (!booking || !payment) {
  throw new Error("The HML booking or its canonical payment was not found.");
}

const paymentId = encodeURIComponent(payment.id);
const [attempts, setups, schedules, transferJobs, transfers] =
  await Promise.all([
    get(
      `/rest/v1/session_payment_attempts?select=attempt_kind,status&session_payment_id=eq.${paymentId}&order=created_at.asc`,
    ),
    get(
      `/rest/v1/session_payment_setups?select=status,usage,stripe_setup_intent_id,stripe_payment_method_id,superseded_at&session_payment_id=eq.${paymentId}&order=created_at.asc`,
    ),
    get(
      `/rest/v1/session_payment_schedules?select=status,due_at,attempt_count,stripe_payment_intent_id,stripe_charge_id,last_error_code&session_payment_id=eq.${paymentId}&order=created_at.asc`,
    ),
    get(
      `/rest/v1/session_transfer_jobs?select=status,attempt_count,last_error_code,transfer_amount_cents&session_payment_id=eq.${paymentId}`,
    ),
    get(
      `/rest/v1/stripe_transfers?select=status,amount_cents,stripe_transfer_id,stripe_source_charge_id&session_payment_id=eq.${paymentId}`,
    ),
  ]);

const activeSetup = setups.find(
  (setup) => setup.status === "succeeded" && setup.superseded_at === null,
);
const canaryDueAt = schedules[0]?.due_at ?? null;
const [dueCandidates, queuedTransferJobs, closureCandidates] =
  await Promise.all([
    canaryDueAt
      ? get(
          `/rest/v1/session_payment_schedules?select=booking_id,status&status=in.(scheduled,retry_scheduled,claimed,processing)&due_at=lte.${encodeURIComponent(canaryDueAt)}`,
        )
      : [],
    get(
      "/rest/v1/session_transfer_jobs?select=booking_id,status&status=in.(queued,creating,reconciliation_required)",
    ),
    canaryDueAt
      ? rpc("list_due_session_payment_closures_v10", {
          p_limit: 100,
          p_now: canaryDueAt,
        })
      : { items: [] },
  ]);
const [videoSessions, activePolicies, cronJobs] = await Promise.all([
  get(
    `/rest/v1/video_sessions?select=status,environment,last_error_code&booking_id=eq.${encodeURIComponent(bookingId)}`,
  ),
  get(
    "/rest/v1/financial_policy_versions?select=policy_key,is_active&policy_key=in.(tes-payments-v9-settlement-only,tes-payments-v10-setup-t24-immediate-transfer)",
  ),
  getFromProfile(
    "cron",
    "/rest/v1/job?select=jobname,active&jobname=in.(tes-session-financial-v10-charge-v1,tes-session-financial-v10-transfer-v1)",
  ),
]);
const webhookEvents = payment.stripe_payment_intent_id
  ? await get(
      `/rest/v1/stripe_webhook_events?select=event_type,processing_status,attempts,error_code&object_id=eq.${encodeURIComponent(payment.stripe_payment_intent_id)}&order=received_at.asc`,
    )
  : [];
const stripeCheckout = payment.stripe_checkout_session_id
  ? await getStripeObject(
      `/v1/checkout/sessions/${encodeURIComponent(payment.stripe_checkout_session_id)}`,
    )
  : null;
const stripeSetup = activeSetup?.stripe_setup_intent_id
  ? await getStripeObject(
      `/v1/setup_intents/${encodeURIComponent(activeSetup.stripe_setup_intent_id)}`,
    )
  : null;
const stripeCharge = payment.stripe_charge_id
  ? await getStripeObject(
      `/v1/charges/${encodeURIComponent(payment.stripe_charge_id)}`,
    )
  : null;
const providerTransfers = await Promise.all(
  transfers.map((transfer) =>
    transfer.stripe_transfer_id
      ? getStripeObject(
          `/v1/transfers/${encodeURIComponent(transfer.stripe_transfer_id)}`,
        )
      : Promise.resolve(null),
  ),
);
const succeededEvents = payment.stripe_payment_intent_id
  ? await getStripeList("/v1/events?type=payment_intent.succeeded&limit=100")
  : [];
const paymentSucceededEvent = succeededEvents.find(
  (event) =>
    providerObjectId(event.data?.object) === payment.stripe_payment_intent_id,
);
const transferContract = transfers.map((transfer, index) => {
  const providerTransfer = providerTransfers[index];
  return {
    amountMatches:
      transfer.amount_cents === payment.therapist_amount_cents &&
      providerTransfer?.amount === payment.therapist_amount_cents,
    destinationMatches:
      providerObjectId(providerTransfer?.destination) ===
      payment.stripe_connect_account_id_snapshot,
    sourceChargeMatches:
      transfer.stripe_source_charge_id === payment.stripe_charge_id &&
      providerObjectId(providerTransfer?.source_transaction) ===
        payment.stripe_charge_id,
  };
});

console.log(
  JSON.stringify(
    {
      target: "hml",
      stripeMode: "test",
      booking: {
        paymentStatus: booking.payment_status,
        startsAt: booking.starts_at,
        status: booking.status,
      },
      payment: {
        balanceAvailabilityKnown: Boolean(payment.stripe_balance_available_on),
        balanceStatus: payment.stripe_balance_status,
        chargePresent: Boolean(payment.stripe_charge_id),
        financialStatus: payment.financial_status,
        flow: payment.payment_flow_version,
        paymentMethodProjected: Boolean(
          payment.metadata?.paymentMethodType ??
          payment.metadata?.payment_method_type,
        ),
        providerPaymentMethodType:
          stripeCharge?.payment_method_details?.type ?? null,
        succeededEventPresent: Boolean(paymentSucceededEvent),
        succeededEventPendingWebhooks:
          paymentSucceededEvent?.pending_webhooks ?? null,
        paymentIntentPresent: Boolean(payment.stripe_payment_intent_id),
        transferStatus: payment.transfer_status,
      },
      checkout: stripeCheckout
        ? {
            paymentStatus: stripeCheckout.payment_status,
            status: stripeCheckout.status,
          }
        : null,
      attempts: summarize(attempts, "status"),
      setups: {
        activeSucceeded: activeSetup ? 1 : 0,
        paymentMethodBound: Boolean(activeSetup?.stripe_payment_method_id),
        providerStatus: stripeSetup?.status ?? null,
        total: setups.length,
        usage: activeSetup?.usage ?? null,
      },
      schedules: schedules.map((schedule) => ({
        attemptCount: schedule.attempt_count,
        chargePresent: Boolean(schedule.stripe_charge_id),
        dueAt: schedule.due_at,
        lastErrorPresent: Boolean(schedule.last_error_code),
        paymentIntentPresent: Boolean(schedule.stripe_payment_intent_id),
        status: schedule.status,
      })),
      transferJobs: {
        count: transferJobs.length,
        statuses: summarize(transferJobs, "status"),
      },
      transfers: {
        count: transfers.length,
        contract: transferContract,
        statuses: summarize(transfers, "status"),
      },
      webhookEvents: webhookEvents.map((event) => ({
        attempts: event.attempts,
        errorCodePresent: Boolean(event.error_code),
        status: event.processing_status,
        type: event.event_type,
      })),
      rolloutSafety: {
        canaryIsOnlyDueCandidate:
          dueCandidates.length === 1 &&
          dueCandidates[0].booking_id === bookingId,
        dueCandidatesAtCanaryInstant: dueCandidates.length,
        otherClosureCandidatesAtCanaryInstant: (
          closureCandidates.items ?? []
        ).filter((candidate) => candidate.bookingId !== bookingId).length,
        otherQueuedTransferJobs: queuedTransferJobs.filter(
          (job) => job.booking_id !== bookingId,
        ).length,
      },
      runtime: {
        policies: activePolicies,
        schedules: cronJobs,
        videoSessions: videoSessions.map((session) => ({
          environment: session.environment,
          errorPresent: Boolean(session.last_error_code),
          status: session.status,
        })),
      },
    },
    null,
    2,
  ),
);

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`HML read failed with status ${response.status}.`);
  }
  return response.json();
}

async function getFromProfile(profile, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "accept-profile": profile,
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) return { observable: false };
  return { observable: true, rows: await response.json() };
}

async function rpc(name, body) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`HML RPC read failed with status ${response.status}.`);
  }
  return response.json();
}

async function getStripeObject(path) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Stripe Test read failed with status ${response.status}.`);
  }
  return response.json();
}

async function getStripeList(path) {
  const result = await getStripeObject(path);
  return Array.isArray(result?.data) ? result.data : [];
}

function summarize(rows, field) {
  return rows.reduce((result, row) => {
    const value = String(row[field] ?? "unknown");
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function providerObjectId(value) {
  return typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value
      ? String(value.id)
      : null;
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
