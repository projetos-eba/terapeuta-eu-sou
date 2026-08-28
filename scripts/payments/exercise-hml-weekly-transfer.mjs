#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { getStripeMode, loadEnvFiles } from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";
const MAX_THERAPIST_AMOUNT_CENTS = 20_000;

loadEnvFiles(["supabase/functions/.env.homolog"]);

const bookingId = readArgument("--booking-id");
const batchId = readArgument("--batch-id");
const stage = readArgument("--stage");
if (!/^[0-9a-f-]{36}$/i.test(bookingId ?? "")) {
  throw new Error("A valid --booking-id is required.");
}
if (
  !stage ||
  ![
    "verify-closed",
    "prepare-batch",
    "transfer",
    "verify-idempotency",
  ].includes(stage)
) {
  throw new Error(
    "Use --stage=verify-closed, prepare-batch, transfer, or verify-idempotency.",
  );
}
if (
  ["transfer", "verify-idempotency"].includes(stage) &&
  !/^[0-9a-f-]{36}$/i.test(batchId ?? "")
) {
  throw new Error("A valid --batch-id is required for this stage.");
}
if (getStripeMode() !== "test") {
  throw new Error("Refusing: the local HML Stripe key is not in Test mode.");
}

const operationsToken = process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN?.trim();
if (!operationsToken)
  throw new Error("HML internal operations token is unavailable.");
const baseUrl = `https://${HML_PROJECT_REF}.supabase.co`;
const serviceKey = readHmlServiceRoleKey();
const context = await readContext();

if (stage === "verify-closed") {
  const response = await invoke(
    "evaluate-transfer-eligibility",
    {
      nowOverride: context.afterSafetyAt,
      sessionPaymentId: context.payment.id,
    },
    true,
  );
  if (
    response.status !== 403 ||
    response.payload?.error?.code !== "finance_test_control_not_allowed"
  ) {
    throw new Error(
      "Remote HML finance test control is not closed as expected.",
    );
  }
  console.log(JSON.stringify({ closed: true, ok: true, stage }, null, 2));
  process.exit(0);
}

if (process.env.TES_FINANCE_TEST_CONTROLS_ENABLED?.trim() !== "true") {
  throw new Error(
    "Refusing: local finance test control is not enabled for this process.",
  );
}

if (stage === "prepare-batch") {
  await requireNoActiveBatchItem();
  const before = await invoke("evaluate-transfer-eligibility", {
    nowOverride: context.beforeSafetyAt,
    sessionPaymentId: context.payment.id,
  });
  if (before.payload?.data?.status !== "waiting_safety_period") {
    throw new Error(
      "Payment did not remain blocked immediately before the safety boundary.",
    );
  }

  const after = await invoke("evaluate-transfer-eligibility", {
    nowOverride: context.afterSafetyAt,
    sessionPaymentId: context.payment.id,
  });
  if (after.payload?.data?.status !== "eligible") {
    throw new Error("Payment did not become eligible at the safety boundary.");
  }

  const eligible = await get(
    "/rest/v1/session_payments?select=id,booking_id,therapist_amount_cents&transfer_status=eq.eligible&limit=3",
  );
  if (
    eligible.length !== 1 ||
    eligible[0].id !== context.payment.id ||
    eligible[0].booking_id !== bookingId
  ) {
    throw new Error(
      "Refusing: eligible payment set is not isolated to the dedicated fixture.",
    );
  }

  const existingBatches = await get(
    `/rest/v1/payout_batches?select=id,status&reference_period_start=eq.${context.periodStart}&reference_period_end=eq.${context.periodEnd}&status=neq.canceled&limit=2`,
  );
  if (existingBatches.length > 0) {
    throw new Error(
      "Refusing: the controlled HML reference period already has a batch.",
    );
  }

  const created = await invoke("create-weekly-payout-batch", {
    cutoffAtOverride: context.afterSafetyAt,
    referencePeriodEnd: context.periodEnd,
    referencePeriodStart: context.periodStart,
  });
  const createdBatchId = created.payload?.data?.batchId;
  if (!/^[0-9a-f-]{36}$/i.test(createdBatchId ?? "")) {
    throw new Error("Controlled HML batch was not created.");
  }
  const evidence = await assertBatchIsIsolated(createdBatchId);
  console.log(
    JSON.stringify(
      {
        batchId: createdBatchId,
        bookingId,
        evidence,
        ok: true,
        safetyBoundary: {
          after: after.payload.data.status,
          before: before.payload.data.status,
        },
        stage,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const batchEvidence = await assertBatchIsIsolated(batchId);
const processed = await invoke("process-payout-batch", {
  batchId,
  maxPayouts: 1,
  maxTransfers: 1,
  nowOverride: context.afterSafetyAt,
});
const results = processed.payload?.data?.transfers;
if (stage === "verify-idempotency") {
  if (!Array.isArray(results) || results.length !== 0) {
    throw new Error("Idempotent replay attempted another Stripe Transfer.");
  }
  const [transfers, ledger] = await Promise.all([
    get(
      `/rest/v1/stripe_transfers?select=id,status&payout_batch_item_id=eq.${encodeURIComponent(batchEvidence.itemId)}`,
    ),
    get(
      `/rest/v1/financial_ledger_entries?select=id&session_payment_id=eq.${encodeURIComponent(context.payment.id)}&entry_type=eq.transfer`,
    ),
  ]);
  if (
    transfers.length !== 1 ||
    transfers[0]?.status !== "transferred" ||
    ledger.length !== 1
  ) {
    throw new Error("Idempotent replay evidence is inconsistent.");
  }
  console.log(
    JSON.stringify(
      {
        batchId,
        bookingId,
        evidence: {
          additionalTransfersProcessed: results.length,
          ledgerEntries: ledger.length,
          persistedTransfers: transfers.length,
        },
        ok: true,
        stage,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (
  !Array.isArray(results) ||
  results.length !== 1 ||
  results[0]?.status !== "transferred"
) {
  throw new Error("Stripe Test Transfer did not complete exactly once.");
}

const [transfers, finalPayments, ledger] = await Promise.all([
  get(
    `/rest/v1/stripe_transfers?select=id,status,amount_cents,stripe_transfer_id,stripe_source_charge_id,stripe_destination_payment_id,stripe_connected_balance_transaction_id,session_payment_id&payout_batch_item_id=eq.${encodeURIComponent(batchEvidence.itemId)}`,
  ),
  get(
    `/rest/v1/session_payments?select=id,transfer_status,transfer_blocked_reason&id=eq.${encodeURIComponent(context.payment.id)}&limit=1`,
  ),
  get(
    `/rest/v1/financial_ledger_entries?select=id,entry_type,direction,amount_cents&session_payment_id=eq.${encodeURIComponent(context.payment.id)}&entry_type=eq.transfer`,
  ),
]);
const transfer = transfers[0];
if (
  transfers.length !== 1 ||
  transfer?.status !== "transferred" ||
  transfer?.amount_cents !== context.payment.therapist_amount_cents ||
  transfer?.stripe_source_charge_id !== context.payment.stripe_charge_id ||
  !transfer?.stripe_transfer_id ||
  !transfer?.stripe_destination_payment_id ||
  !transfer?.stripe_connected_balance_transaction_id ||
  finalPayments[0]?.transfer_status !== "transferred" ||
  ledger.length !== 1 ||
  ledger[0]?.direction !== "debit" ||
  ledger[0]?.amount_cents !== context.payment.therapist_amount_cents
) {
  throw new Error(
    "Transfer reconciliation or ledger evidence did not converge.",
  );
}

console.log(
  JSON.stringify(
    {
      batchId,
      bookingId,
      evidence: {
        amountCents: transfer.amount_cents,
        destinationBalanceTransaction: "present",
        destinationPayment: "present",
        ledgerEntries: ledger.length,
        sourceChargeMatched: true,
        transferCount: transfers.length,
        transferStatus: transfer.status,
      },
      ok: true,
      stage,
    },
    null,
    2,
  ),
);

async function readContext() {
  const [payment] = await get(
    `/rest/v1/session_payments?select=id,booking_id,policy_version_id,financial_status,service_status,service_confirmed_at,eligible_at,transfer_status,therapist_amount_cents,stripe_charge_id,stripe_balance_transaction_id&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`,
  );
  if (
    !payment ||
    payment.financial_status !== "paid" ||
    payment.service_status !== "confirmed_bilateral" ||
    !payment.service_confirmed_at ||
    !payment.stripe_charge_id ||
    !payment.stripe_balance_transaction_id ||
    payment.therapist_amount_cents <= 0 ||
    payment.therapist_amount_cents > MAX_THERAPIST_AMOUNT_CENTS
  ) {
    throw new Error(
      "Dedicated HML payment does not satisfy transfer preconditions.",
    );
  }
  const [policy] = await get(
    `/rest/v1/financial_policy_versions?select=transfer_safety_period_days&id=eq.${encodeURIComponent(payment.policy_version_id)}&limit=1`,
  );
  if (policy?.transfer_safety_period_days !== 1) {
    throw new Error(
      "Controlled HML payment does not use the one-day safety policy.",
    );
  }
  const safetyEpoch =
    Date.parse(payment.service_confirmed_at) +
    policy.transfer_safety_period_days * 86_400_000;
  const afterSafetyAt = new Date(safetyEpoch).toISOString();
  const periodStart = afterSafetyAt.slice(0, 10);
  const periodEnd = new Date(safetyEpoch + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    afterSafetyAt,
    beforeSafetyAt: new Date(safetyEpoch - 1).toISOString(),
    payment,
    periodEnd,
    periodStart,
  };
}

async function requireNoActiveBatchItem() {
  const rows = await get(
    `/rest/v1/payout_batch_items?select=id,status&session_payment_id=eq.${encodeURIComponent(context.payment.id)}&status=in.(reserved,transfer_pending,transferred)&limit=2`,
  );
  if (rows.length > 0)
    throw new Error("Refusing: payment already has an active batch item.");
}

async function assertBatchIsIsolated(targetBatchId) {
  const [batches, items] = await Promise.all([
    get(
      `/rest/v1/payout_batches?select=id,item_count,therapist_count,therapist_amount_cents,status&id=eq.${encodeURIComponent(targetBatchId)}&limit=1`,
    ),
    get(
      `/rest/v1/payout_batch_items?select=id,session_payment_id,booking_id,amount_cents,status&payout_batch_id=eq.${encodeURIComponent(targetBatchId)}&limit=3`,
    ),
  ]);
  const batch = batches[0];
  const item = items[0];
  if (
    !batch ||
    batch.item_count !== 1 ||
    batch.therapist_count !== 1 ||
    batch.therapist_amount_cents !== context.payment.therapist_amount_cents ||
    items.length !== 1 ||
    item.session_payment_id !== context.payment.id ||
    item.booking_id !== bookingId ||
    item.amount_cents !== context.payment.therapist_amount_cents ||
    !["reserved", "transfer_pending", "transferred"].includes(item.status)
  ) {
    throw new Error(
      "Refusing: payout batch is not isolated to the dedicated fixture.",
    );
  }
  return {
    amountCents: item.amount_cents,
    itemCount: batch.item_count,
    itemId: item.id,
    itemStatus: item.status,
    therapistCount: batch.therapist_count,
  };
}

async function invoke(functionName, body, acceptFailure = false) {
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-tes-internal-operations-token": operationsToken,
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok && !acceptFailure) {
    throw new Error(
      `${functionName} failed with ${response.status}:${payload?.error?.code ?? "unknown"}.`,
    );
  }
  return { payload, status: response.status };
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok)
    throw new Error(`HML read failed with status ${response.status}.`);
  return response.json();
}

function readHmlServiceRoleKey() {
  const command = `npx.cmd supabase projects api-keys --project-ref ${HML_PROJECT_REF} -o json`;
  const output = execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
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
