#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { getStripeMode, loadEnvFiles } from "./env-utils.mjs";

const HML_PROJECT_REF = "emzwqkmrryuqvqiohqnu";
const EXPECTED_ITEM_COUNT = 13;
const EXPECTED_THERAPIST_COUNT = 5;
const EXPECTED_TOTAL_CENTS = 134_900;

loadEnvFiles(["supabase/functions/.env.homolog"]);

const stage = readArgument("--stage") ?? "inspect";
const businessDate = readArgument("--business-date") ?? "2026-09-08";
const confirmed = process.argv.includes("--confirm");

if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
  throw new Error("A valid --business-date is required.");
}
if (getStripeMode() !== "test") {
  throw new Error("Refusing: the HML Stripe key is not in Test mode.");
}

const operationsToken = process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN?.trim();
if (!operationsToken) {
  throw new Error("HML internal operations token is unavailable.");
}

const serviceKey = readHmlServiceRoleKey();
const baseUrl = `https://${HML_PROJECT_REF}.supabase.co`;

if (stage === "inspect") {
  console.log(JSON.stringify(await readEvidence(), null, 2));
  process.exit(0);
}

if (stage === "stripe-liquidity") {
  console.log(JSON.stringify(await readStripeLiquidity(), null, 2));
  process.exit(0);
}

if (stage === "assert-pristine") {
  const evidence = await readEvidence();
  assertExpectedBatch(evidence, { pristine: true });
  console.log(JSON.stringify({ ok: true, stage, evidence }, null, 2));
  process.exit(0);
}

if (stage === "verify-liquidity-gate") {
  requireConfirmation(stage);
  const before = await readEvidence();
  const response = await invokeRaw("process-payout-batch", {
    batchId: before.run.payout_batch_id,
    maxPayouts: 1,
    maxTransfers: 1,
  });
  if (
    response.status !== 500 ||
    response.payload?.error?.code !== "internal_error"
  ) {
    throw new Error(
      "Liquidity gate did not fail with the generic public contract.",
    );
  }
  const after = await readEvidence();
  for (const field of [
    "items",
    "ledger",
    "localTransfers",
    "payments",
    "providerTransfers",
  ]) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      throw new Error(`Liquidity gate mutated ${field} before claim.`);
    }
  }
  console.log(
    JSON.stringify(
      {
        genericPublicError: true,
        noClaimMutation: true,
        ok: true,
        stage,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (stage === "pause-cron" || stage === "resume-cron") {
  requireConfirmation(stage);
  const active = stage === "resume-cron";
  const result = await rpc("set_weekly_payout_scheduler_active_v1", {
    p_active: active,
  });
  if (result?.active !== active || result?.updated !== true) {
    throw new Error("Scheduler activation response did not converge.");
  }
  console.log(JSON.stringify({ active, ok: true, stage }, null, 2));
  process.exit(0);
}

if (stage === "verify-scheduler-outside-window") {
  requireConfirmation(stage);
  const result = await invoke("weekly-payout-scheduler", {});
  if (
    result?.acquired !== false ||
    result?.reason !== "outside_start_window"
  ) {
    throw new Error("Scheduler did not remain closed outside its start window.");
  }
  console.log(JSON.stringify({ ok: true, result, stage }, null, 2));
  process.exit(0);
}

if (stage === "fund-recovery") {
  requireConfirmation(stage);
  let liquidity = await readStripeLiquidity();
  let fundedGrossCents = 0;
  const key = requireStripeKey();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const missingCents = Math.max(
      0,
      EXPECTED_TOTAL_CENTS - liquidity.platformBalance.availableBrlCents,
    );
    if (missingCents === 0) break;
    const grossCents = missingCents + Math.max(
      1_000,
      Math.ceil(missingCents * 0.08),
    );
    if (fundedGrossCents + grossCents > EXPECTED_TOTAL_CENTS + 25_000) {
      throw new Error("Required Test charge exceeds the bounded recovery amount.");
    }
    const charge = await stripePost(
      "/v1/charges",
      new URLSearchParams({
        amount: String(grossCents),
        currency: "brl",
        description: "TES HML weekly payout incident recovery",
        "metadata[purpose]": "hml_payout_recovery_funding",
        "metadata[recovery_business_date]": businessDate,
        "metadata[system]": "tes",
        source: "tok_bypassPendingInternational",
      }),
      key,
      `tes:hml:weekly-payout-recovery:${businessDate}:charge:${attempt}:${grossCents}:v1`,
    );
    if (charge.paid !== true || charge.status !== "succeeded") {
      throw new Error("Stripe Test recovery charge did not succeed.");
    }
    fundedGrossCents += grossCents;
    liquidity = await readStripeLiquidity();
  }
  if (liquidity.platformBalance.availableBrlCents < EXPECTED_TOTAL_CENTS) {
    throw new Error("Stripe Test charge did not fund the approved batch.");
  }
  console.log(
    JSON.stringify(
      {
        availableBrlCents: liquidity.platformBalance.availableBrlCents,
        fundedGrossCents,
        ok: true,
        stage,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (stage === "recover") {
  requireConfirmation(stage);
  await recoverBatch();
  process.exit(0);
}

if (stage === "process-one") {
  requireConfirmation(stage);
  const before = await readEvidence();
  const processed = await invoke("process-payout-batch", {
    batchId: before.run.payout_batch_id,
    maxPayouts: 1,
    maxTransfers: 1,
  });
  const transferResults = processed?.transfers;
  if (
    !Array.isArray(transferResults) ||
    transferResults.length !== 1 ||
    transferResults[0]?.status !== "transferred"
  ) {
    throw new Error(
      `One-item recovery did not transfer: ${JSON.stringify({ transfers: transferResults ?? null })}`,
    );
  }
  const after = await readEvidence();
  assertRecoveryAdvancedOnce(before, after);
  console.log(JSON.stringify({ after, ok: true, stage }, null, 2));
  process.exit(0);
}

if (stage === "rearm-final-transfer") {
  requireConfirmation(stage);
  const before = await readEvidence();
  const items = await get(
    `/rest/v1/payout_batch_items?select=id&payout_batch_id=eq.${before.run.payout_batch_id}&limit=100`,
  );
  const itemIds = items.map((item) => item.id);
  const terminal = await get(
    `/rest/v1/stripe_transfers?select=id,status,attempt_count,failure_code,stripe_transfer_id&payout_batch_item_id=in.(${itemIds.join(",")})&status=eq.failed&attempt_count=gte.4&stripe_transfer_id=is.null&limit=10`,
  );
  if (
    terminal.length !== 1 ||
    !["balance_insufficient", "insufficient_funds"].includes(
      terminal[0]?.failure_code,
    )
  ) {
    throw new Error("Expected exactly one definitive terminal balance rejection.");
  }
  const result = await rpc("rearm_definitive_payout_transfer_v1", {
    p_expected_batch_id: before.run.payout_batch_id,
    p_transfer_id: terminal[0].id,
  });
  if (result?.rearmed !== true) {
    throw new Error("Terminal Transfer was not rearmed.");
  }
  console.log(JSON.stringify({ ok: true, rearmed: true, stage }, null, 2));
  process.exit(0);
}

throw new Error(
  "Use --stage=inspect, stripe-liquidity, assert-pristine, verify-liquidity-gate, pause-cron, fund-recovery, rearm-final-transfer, process-one, recover, resume-cron, or verify-scheduler-outside-window.",
);

async function recoverBatch() {
  let evidence = await readEvidence();
  assertExpectedBatch(evidence, { pristine: false });

  if (evidence.run.status === "failed") {
    const resumed = await rpc("resume_failed_payout_scheduler_run_v1", {
      p_expected_batch_id: evidence.run.payout_batch_id,
      p_run_id: evidence.run.id,
    });
    if (resumed?.resumed !== true) {
      throw new Error("Failed scheduler run was not resumed.");
    }
    evidence = await readEvidence();
  }

  for (
    let index = evidence.localTransfers.transferred ?? 0;
    index < EXPECTED_ITEM_COUNT;
    index += 1
  ) {
    const before = evidence;
    const processed = await invoke("process-payout-batch", {
      batchId: before.run.payout_batch_id,
      maxPayouts: 1,
      maxTransfers: 1,
    });
    const transferResults = processed?.transfers;
    if (
      !Array.isArray(transferResults) ||
      transferResults.length !== 1 ||
      transferResults[0]?.status !== "transferred"
    ) {
      throw new Error("A recovery item did not complete as one Transfer.");
    }

    evidence = await readEvidence();
    assertRecoveryAdvancedOnce(before, evidence);
  }

  const replay = await invoke("process-payout-batch", {
    batchId: evidence.run.payout_batch_id,
    maxPayouts: 1,
    maxTransfers: 1,
  });
  if (!Array.isArray(replay?.transfers) || replay.transfers.length !== 0) {
    throw new Error("Idempotent replay attempted an additional Transfer.");
  }

  const finalized = await rpc("finalize_payout_scheduler_run_v1", {
    p_scheduler_run_id: evidence.run.id,
  });
  if (finalized?.completed !== true) {
    throw new Error("Scheduler run did not finalize after all Transfers.");
  }

  evidence = await readEvidence();
  assertExpectedBatch(evidence, { pristine: false, recovered: true });
  console.log(
    JSON.stringify({ evidence, finalized, ok: true, stage }, null, 2),
  );
}

function assertExpectedBatch(evidence, options) {
  if (
    evidence.batch.item_count !== EXPECTED_ITEM_COUNT ||
    evidence.batch.therapist_count !== EXPECTED_THERAPIST_COUNT ||
    evidence.batch.therapist_amount_cents !== EXPECTED_TOTAL_CENTS ||
    evidence.items.count !== EXPECTED_ITEM_COUNT ||
    evidence.items.amountCents !== EXPECTED_TOTAL_CENTS
  ) {
    throw new Error(
      "The HML batch identity or amount diverged from the approved recovery scope.",
    );
  }

  if (
    options.pristine &&
    (evidence.items.reserved !== EXPECTED_ITEM_COUNT ||
      evidence.payments.batched !== EXPECTED_ITEM_COUNT ||
      evidence.localTransfers.count !== 0 ||
      evidence.ledger.count !== 0 ||
      evidence.providerTransfers.count !== 0)
  ) {
    throw new Error(
      "The approved batch is no longer pristine; recovery was not started.",
    );
  }

  if (
    options.recovered &&
    (evidence.items.transferred !== EXPECTED_ITEM_COUNT ||
      evidence.payments.transferred !== EXPECTED_ITEM_COUNT ||
      evidence.localTransfers.transferred !== EXPECTED_ITEM_COUNT ||
      evidence.localTransfers.transferredAmountCents !== EXPECTED_TOTAL_CENTS ||
      evidence.ledger.count !== EXPECTED_ITEM_COUNT ||
      evidence.ledger.amountCents !== EXPECTED_TOTAL_CENTS ||
      evidence.providerTransfers.count !== EXPECTED_ITEM_COUNT ||
      evidence.providerTransfers.amountCents !== EXPECTED_TOTAL_CENTS ||
      !["completed", "completed_with_incidents"].includes(evidence.run.status))
  ) {
    throw new Error("Recovered batch evidence did not converge exactly.");
  }
}

function assertRecoveryAdvancedOnce(before, after) {
  if (
    after.localTransfers.transferred !==
      before.localTransfers.transferred + 1 ||
    after.ledger.count !== before.ledger.count + 1 ||
    after.providerTransfers.count !== before.providerTransfers.count + 1 ||
    after.localTransfers.transferred !== after.ledger.count ||
    after.localTransfers.transferred !== after.providerTransfers.count ||
    after.localTransfers.transferredAmountCents !== after.ledger.amountCents ||
    after.localTransfers.transferredAmountCents !==
      after.providerTransfers.amountCents
  ) {
    throw new Error(
      "Recovery evidence diverged after one item; no further item will be processed.",
    );
  }
}

async function readEvidence() {
  const [run] = await get(
    `/rest/v1/payout_scheduler_runs?select=id,status,payout_batch_id,attempts,consecutive_failures,next_retry_at,last_failed_at,last_succeeded_at,last_error_code,last_request_id,worker_id,lease_expires_at&business_date=eq.${businessDate}&limit=1`,
  );
  if (!run?.payout_batch_id)
    throw new Error("Weekly HML run or batch was not found.");

  const [batch] = await get(
    `/rest/v1/payout_batches?select=id,status,item_count,therapist_count,therapist_amount_cents&id=eq.${run.payout_batch_id}&limit=1`,
  );
  const items = await get(
    `/rest/v1/payout_batch_items?select=id,status,amount_cents,session_payment_id,payout_batch_therapist_id,failure_code&payout_batch_id=eq.${run.payout_batch_id}&limit=100`,
  );
  if (!batch || items.length === 0)
    throw new Error("Weekly HML batch items were not found.");

  const itemIds = items.map((item) => item.id);
  const paymentIds = items.map((item) => item.session_payment_id);
  const groupIds = [
    ...new Set(items.map((item) => item.payout_batch_therapist_id)),
  ];
  const [transfers, payments, groups, ledger, providerTransfers, incidents] =
    await Promise.all([
      get(
        `/rest/v1/stripe_transfers?select=id,status,amount_cents,stripe_transfer_id,payout_batch_item_id,connect_account_id,failure_code,failure_message,attempt_count,next_retry_at,lease_expires_at&payout_batch_item_id=in.(${itemIds.join(",")})&limit=100`,
      ),
      get(
        `/rest/v1/session_payments?select=id,transfer_status,transfer_blocked_reason,financial_status,refund_pending,stripe_balance_status,eligible_at&id=in.(${paymentIds.join(",")})&limit=100`,
      ),
      get(
        `/rest/v1/payout_batch_therapists?select=id,connect_account_id,status&id=in.(${groupIds.join(",")})&limit=100`,
      ),
      get(
        `/rest/v1/financial_ledger_entries?select=id,amount_cents&payout_batch_id=eq.${run.payout_batch_id}&entry_type=eq.transfer&limit=100`,
      ),
      listProviderTransfers(run.payout_batch_id),
      get(
        `/rest/v1/payout_operational_incidents?select=incident_type,severity,status&payout_batch_id=eq.${run.payout_batch_id}&limit=100`,
      ),
    ]);
  const accountIds = [
    ...new Set(groups.map((group) => group.connect_account_id)),
  ];
  const accounts = await get(
    `/rest/v1/therapist_connect_accounts?select=id,is_current,operational_status,stripe_transfers_status,payout_status,payout_schedule_interval&id=in.(${accountIds.join(",")})&limit=100`,
  );

  return {
    batch: withoutId(batch),
    accounts: {
      count: accounts.length,
      current: accounts.filter((account) => account.is_current).length,
      operationalStatuses: countValues(accounts, "operational_status"),
      payoutIntervals: countValues(accounts, "payout_schedule_interval"),
      payoutStatuses: countValues(accounts, "payout_status"),
      transferStatuses: countValues(accounts, "stripe_transfers_status"),
    },
    failures: buildFailureSummary({
      accounts,
      groups,
      items,
      payments,
      transfers,
    }),
    items: {
      ...summarizeStates(items, "status"),
      failureCodes: countValues(items, "failure_code", true),
    },
    incidents: {
      count: incidents.length,
      open: incidents.filter((incident) => incident.status === "open").length,
      statuses: countValues(incidents, "status"),
      types: countValues(incidents, "incident_type"),
    },
    ledger: summarizeAmounts(ledger),
    localTransfers: {
      ...summarizeStates(transfers, "status"),
      activeLeases: transfers.filter(
        (transfer) =>
          transfer.lease_expires_at &&
          new Date(transfer.lease_expires_at).getTime() > Date.now(),
      ).length,
      attempts: countValues(transfers, "attempt_count"),
      failureCodes: countValues(transfers, "failure_code", true),
      failureMessages: [
        ...new Set(
          transfers
            .map((transfer) => transfer.failure_message)
            .filter((message) => typeof message === "string" && message.length > 0),
        ),
      ],
      retryableNow: transfers.filter(
        (transfer) =>
          ["failed", "reconciliation_required"].includes(transfer.status) &&
          transfer.next_retry_at &&
          new Date(transfer.next_retry_at).getTime() <= Date.now(),
      ).length,
      nextRetryAt: transfers
        .filter(
          (transfer) =>
            ["failed", "reconciliation_required"].includes(transfer.status) &&
            transfer.next_retry_at,
        )
        .map((transfer) => transfer.next_retry_at)
        .sort(),
      transferredAmountCents: transfers
        .filter((transfer) => transfer.status === "transferred")
        .reduce((sum, transfer) => sum + Number(transfer.amount_cents ?? 0), 0),
      withProviderId: transfers.filter(
        (transfer) => transfer.stripe_transfer_id,
      ).length,
    },
    payments: {
      ...summarizeStates(payments, "transfer_status"),
      blockedReasons: countValues(payments, "transfer_blocked_reason", true),
      financialStatuses: countValues(payments, "financial_status"),
      settlementStatuses: countValues(payments, "stripe_balance_status"),
    },
    providerTransfers: summarizeAmounts(providerTransfers),
    run: withoutWorker(run),
  };
}

async function readStripeLiquidity() {
  const [run] = await get(
    `/rest/v1/payout_scheduler_runs?select=payout_batch_id&business_date=eq.${businessDate}&limit=1`,
  );
  if (!run?.payout_batch_id)
    throw new Error("Weekly HML run or batch was not found.");
  const items = await get(
    `/rest/v1/payout_batch_items?select=session_payment_id&payout_batch_id=eq.${run.payout_batch_id}&limit=100`,
  );
  const paymentIds = items.map((item) => item.session_payment_id);
  const payments = await get(
    `/rest/v1/session_payments?select=stripe_charge_id,gross_amount_cents,therapist_amount_cents,stripe_balance_transaction_id,stripe_balance_status&id=in.(${paymentIds.join(",")})&limit=100`,
  );
  const stripeKey = requireStripeKey();
  const [balance, balanceSettings, providerTransfers, balanceTransactions] =
    await Promise.all([
      stripeGet("/v1/balance", stripeKey),
      stripeGet("/v1/balance_settings", stripeKey),
      listAllProviderTransfers(stripeKey),
      listStripeCollection("/v1/balance_transactions", stripeKey),
    ]);
  const sourceCharges = new Set(
    payments.map((payment) => payment.stripe_charge_id),
  );
  const sourceTransfers = providerTransfers.filter((transfer) => {
    const source =
      typeof transfer.source_transaction === "string"
        ? transfer.source_transaction
        : transfer.source_transaction?.id;
    return sourceCharges.has(source);
  });
  const transferredSourceCharges = new Set(
    sourceTransfers.map((transfer) =>
      typeof transfer.source_transaction === "string"
        ? transfer.source_transaction
        : transfer.source_transaction?.id,
    ),
  );

  const charges = [];
  for (const payment of payments) {
    const charge = await stripeGet(
      `/v1/charges/${encodeURIComponent(payment.stripe_charge_id)}?expand%5B%5D=balance_transaction`,
      stripeKey,
    );
    charges.push(charge);
  }

  const nowEpoch = Math.floor(Date.now() / 1000);
  const pendingTransactions = balanceTransactions.filter(
    (transaction) =>
      transaction.currency === "brl" && transaction.status === "pending",
  );
  return {
    batchCharges: {
      balanceStatuses: countProviderValues(
        charges.map((charge) => charge.balance_transaction),
        "status",
      ),
      count: charges.length,
      grossAmountCents: charges.reduce(
        (sum, charge) => sum + Number(charge.amount ?? 0),
        0,
      ),
      netAmountCents: charges.reduce(
        (sum, charge) => sum + Number(charge.balance_transaction?.net ?? 0),
        0,
      ),
      providerAvailableOnReached: charges.filter(
        (charge) =>
          Number(charge.balance_transaction?.available_on ?? 0) <= nowEpoch,
      ).length,
    },
    existingTransfersUsingBatchCharges: summarizeAmounts(sourceTransfers),
    untransferredSourceCharges: charges
      .filter((charge) => !transferredSourceCharges.has(charge.id))
      .map((charge) => ({
        amountCents: Number(charge.amount ?? 0),
        amountRefundedCents: Number(charge.amount_refunded ?? 0),
        balanceStatus: charge.balance_transaction?.status ?? null,
        captured: charge.captured === true,
        disputed: charge.disputed === true,
        netAmountCents: Number(charge.balance_transaction?.net ?? 0),
        paid: charge.paid === true,
        refunded: charge.refunded === true,
      })),
    platformBalance: {
      availableBrlCents: sumCurrency(balance.available, "brl"),
      availableBrlSourceTypes: currencySourceTypes(balance.available, "brl"),
      connectReservedBrlCents: sumCurrency(balance.connect_reserved, "brl"),
      pendingBrlCents: sumCurrency(balance.pending, "brl"),
      pendingBrlSourceTypes: currencySourceTypes(balance.pending, "brl"),
    },
    platformPayoutSettings: {
      interval: balanceSettings.payments?.payouts?.schedule?.interval ?? null,
      minimumBalanceBrlCents:
        balanceSettings.payments?.payouts?.minimum_balance_by_currency?.brl ??
        0,
      status: balanceSettings.payments?.payouts?.status ?? null,
    },
    pendingBalanceTransactions: {
      amountCents: pendingTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.net ?? 0),
        0,
      ),
      byAvailableDate: pendingTransactions.reduce((dates, transaction) => {
        const date = new Date(Number(transaction.available_on) * 1000)
          .toISOString()
          .slice(0, 10);
        dates[date] = (dates[date] ?? 0) + Number(transaction.net ?? 0);
        return dates;
      }, {}),
      count: pendingTransactions.length,
    },
  };
}

function buildFailureSummary({ accounts, groups, items, payments, transfers }) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const paymentsById = new Map(
    payments.map((payment) => [payment.id, payment]),
  );
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );

  return transfers
    .filter((transfer) => transfer.status !== "transferred")
    .map((transfer) => {
      const item = itemsById.get(transfer.payout_batch_item_id);
      const payment = paymentsById.get(item?.session_payment_id);
      const group = groupsById.get(item?.payout_batch_therapist_id);
      const account = accountsById.get(group?.connect_account_id);
      return {
        accountCurrent: account?.is_current ?? null,
        accountOperationalStatus: account?.operational_status ?? null,
        accountPayoutInterval: account?.payout_schedule_interval ?? null,
        accountPayoutStatus: account?.payout_status ?? null,
        accountTransferStatus: account?.stripe_transfers_status ?? null,
        amountCents: transfer.amount_cents,
        failureCode: transfer.failure_code,
        financialStatus: payment?.financial_status ?? null,
        refundPending: payment?.refund_pending ?? null,
        settlementStatus: payment?.stripe_balance_status ?? null,
        transferBlockedReason: payment?.transfer_blocked_reason ?? null,
      };
    });
}

async function listProviderTransfers(batchId) {
  const key = requireStripeKey();
  const transfers = await listAllProviderTransfers(key);
  return transfers.filter(
    (transfer) => transfer.metadata?.payout_batch_id === batchId,
  );
}

async function listAllProviderTransfers(key) {
  const matches = [];
  let startingAfter = null;

  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);
    const payload = await stripeGet(`/v1/transfers?${query}`, key);
    matches.push(...(payload.data ?? []));
    if (!payload.has_more || !payload.data?.length) break;
    startingAfter = payload.data.at(-1).id;
  }
  return matches;
}

async function listStripeCollection(path, key) {
  const rows = [];
  let startingAfter = null;
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);
    const payload = await stripeGet(`${path}?${query}`, key);
    rows.push(...(payload.data ?? []));
    if (!payload.has_more || !payload.data?.length) break;
    startingAfter = payload.data.at(-1).id;
  }
  return rows;
}

async function stripeGet(path, key) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok)
    throw new Error(`Stripe Test read failed with ${response.status}.`);
  return await response.json();
}

async function stripePost(path, body, key, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    body,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": idempotencyKey,
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError = payload?.error ?? {};
    const type = sanitizeProviderField(providerError.type, "provider_error");
    const code = sanitizeProviderField(providerError.code, "unknown_code");
    const message = sanitizeProviderField(
      providerError.message,
      "Stripe rejected the request.",
      240,
    );
    throw new Error(
      `Stripe Test write failed with ${response.status}: ${type}/${code}: ${message}`,
    );
  }
  return payload;
}

function sanitizeProviderField(value, fallback, limit = 120) {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\r\n]+/g, " ").slice(0, limit) || fallback;
}

function requireStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("HML Stripe key is unavailable.");
  return key;
}

function sumCurrency(entries, currency) {
  return (entries ?? [])
    .filter((entry) => entry.currency === currency)
    .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
}

function currencySourceTypes(entries, currency) {
  const entry = Array.isArray(entries)
    ? entries.find((candidate) => candidate?.currency === currency)
    : null;
  return entry?.source_types ?? {};
}

function countProviderValues(rows, field) {
  return rows.reduce((counts, row) => {
    const key = row?.[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizeStates(rows, field) {
  const summary = summarizeAmounts(rows);
  for (const row of rows) {
    const key = row[field] ?? "unknown";
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}

function summarizeAmounts(rows) {
  return {
    amountCents: rows.reduce(
      (sum, row) => sum + Number(row.amount_cents ?? row.amount ?? 0),
      0,
    ),
    count: rows.length,
  };
}

function countValues(rows, field, omitEmpty = false) {
  return rows.reduce((counts, row) => {
    const value = row[field];
    if (omitEmpty && !value) return counts;
    const key = value ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function withoutId(value) {
  const { id: _id, ...safe } = value;
  return safe;
}

function withoutWorker(value) {
  const { id: _id, worker_id: _workerId, ...safe } = value;
  return safe;
}

async function invoke(functionName, body) {
  const { payload, status } = await invokeRaw(functionName, body);
  if (status < 200 || status >= 300 || payload?.ok !== true) {
    throw new Error(
      `${functionName} failed with ${status}:${payload?.error?.code ?? "unknown"}.`,
    );
  }
  return payload.data;
}

async function invokeRaw(functionName, body) {
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-tes-internal-operations-token": operationsToken,
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  return { payload, status: response.status };
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
  if (!response.ok) throw new Error(`${name} failed with ${response.status}.`);
  return await response.json();
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`HML read failed with ${response.status}.`);
  return await response.json();
}

function readHmlServiceRoleKey() {
  const configured = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (configured) return configured;

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

function requireConfirmation(operation) {
  if (!confirmed) throw new Error(`Refusing ${operation} without --confirm.`);
}

function readArgument(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : null;
}
