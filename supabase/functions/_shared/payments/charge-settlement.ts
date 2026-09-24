import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

export type ChargeSettlementSnapshot = {
  amountCents: number;
  availableOn: string;
  balanceTransactionId: string;
  currency: string;
  feeAmountCents: number | null;
  netAmountCents: number | null;
  receiptUrl: string | null;
  sourceChargeId: string;
  status: "available" | "pending";
};

type SettlementCandidate = {
  id: string;
  needs_receipt: boolean;
  needs_settlement: boolean;
  stripe_charge_id: string;
};

type RecoverableConnectCandidate = {
  id: string;
};

export async function refreshRecoverableConnectPayments(input: {
  client: SupabaseRestClient;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 500);
  const rows = await input.client.get<RecoverableConnectCandidate[]>(
    `/rest/v1/session_payments?select=id&financial_status=in.(paid,partially_refunded)&transfer_status=eq.blocked&transfer_blocked_reason=eq.connect_not_ready&order=updated_at.asc&limit=${limit}`,
  );
  const results = [];

  for (const row of rows) {
    const refreshed = await input.client.rpc<Record<string, unknown>>(
      "refresh_session_transfer_eligibility",
      { p_session_payment_id: row.id },
    );
    results.push({ paymentId: row.id, refreshed });
  }

  return results;
}

export function extractChargeSettlementSnapshot(
  charge: Record<string, unknown>,
): ChargeSettlementSnapshot | null {
  const chargeId = stringOrNull(charge.id);
  const transaction = asRecord(charge.balance_transaction);
  const transactionId = stringOrNull(transaction.id);
  const status = transaction.status;
  const availableOn = unixTimeToIso(transaction.available_on);
  const source = objectId(transaction.source);
  const amount = numberOrNull(transaction.amount);
  const currency = stringOrNull(transaction.currency)?.toLowerCase();

  if (
    !chargeId ||
    !transactionId ||
    !availableOn ||
    !amount ||
    amount <= 0 ||
    !currency ||
    source !== chargeId ||
    (status !== "pending" && status !== "available")
  ) {
    return null;
  }

  return {
    amountCents: amount,
    availableOn,
    balanceTransactionId: transactionId,
    currency,
    feeAmountCents: numberOrNull(transaction.fee),
    netAmountCents: numberOrNull(transaction.net),
    receiptUrl: stripeReceiptUrlOrNull(charge.receipt_url),
    sourceChargeId: chargeId,
    status,
  };
}

export async function retrieveChargeSettlementSnapshot(
  stripe: StripeClient,
  chargeId: string,
) {
  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  });
  return extractChargeSettlementSnapshot(
    charge as unknown as Record<string, unknown>,
  );
}

export async function persistChargeSettlementSnapshot(input: {
  client: SupabaseRestClient;
  eventCreatedAt: string;
  eventId: string;
  paymentId: string;
  snapshot: ChargeSettlementSnapshot;
}) {
  return input.client.rpc<Record<string, unknown>>(
    "record_session_payment_stripe_reconciliation_v2",
    {
      p_balance_amount_cents: input.snapshot.amountCents,
      p_balance_available_on: input.snapshot.availableOn,
      p_balance_currency: input.snapshot.currency,
      p_balance_source_charge_id: input.snapshot.sourceChargeId,
      p_balance_status: input.snapshot.status,
      p_payment_method_type: null,
      p_payment_origin: "stripe_checkout",
      p_receipt_url: input.snapshot.receiptUrl,
      p_session_payment_id: input.paymentId,
      p_stripe_balance_transaction_id: input.snapshot.balanceTransactionId,
      p_stripe_charge_id: input.snapshot.sourceChargeId,
      p_stripe_event_created_at: input.eventCreatedAt,
      p_stripe_event_id: input.eventId,
      p_stripe_fee_amount_cents: input.snapshot.feeAmountCents,
      p_stripe_net_amount_cents: input.snapshot.netAmountCents,
    },
  );
}

export async function persistChargeReceiptUrl(input: {
  client: SupabaseRestClient;
  paymentId: string;
  receiptUrl: string;
  sourceChargeId: string;
}) {
  return input.client.rpc<Record<string, unknown>>(
    "record_session_payment_receipt_url_v1",
    {
      p_receipt_url: input.receiptUrl,
      p_session_payment_id: input.paymentId,
      p_stripe_charge_id: input.sourceChargeId,
    },
  );
}

export async function reconcileChargeSettlements(input: {
  client: SupabaseRestClient;
  limit?: number;
  observedAt?: string;
  stripe: StripeClient;
}) {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 500);
  const rows = await input.client.rpc<SettlementCandidate[]>(
    "get_session_payment_charge_reconciliation_candidates_v2",
    { p_limit: limit },
  );
  const observedAt = input.observedAt ?? new Date().toISOString();
  const results = [];

  for (const row of rows) {
    const snapshot = await retrieveChargeSettlementSnapshot(
      input.stripe,
      row.stripe_charge_id,
    );
    if (!snapshot) {
      results.push({ paymentId: row.id, reconciled: false });
      continue;
    }
    if (row.needs_settlement) {
      const persisted = await persistChargeSettlementSnapshot({
        client: input.client,
        eventCreatedAt: observedAt,
        eventId: `settlement-reconcile:${row.id}:${snapshot.status}:${snapshot.balanceTransactionId}`,
        paymentId: row.id,
        snapshot,
      });
      results.push({
        paymentId: row.id,
        receiptReconciled: row.needs_receipt && snapshot.receiptUrl !== null,
        reconciled: true,
        settlementReconciled: true,
        persisted,
      });
      continue;
    }

    if (row.needs_receipt && snapshot.receiptUrl) {
      const persisted = await persistChargeReceiptUrl({
        client: input.client,
        paymentId: row.id,
        receiptUrl: snapshot.receiptUrl,
        sourceChargeId: snapshot.sourceChargeId,
      });
      results.push({
        paymentId: row.id,
        receiptReconciled: true,
        reconciled: true,
        settlementReconciled: false,
        persisted,
      });
      continue;
    }

    results.push({
      paymentId: row.id,
      receiptReconciled: false,
      reconciled: false,
      settlementReconciled: false,
    });
  }

  return results;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function objectId(value: unknown) {
  return typeof value === "string" ? value : stringOrNull(asRecord(value).id);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stripeReceiptUrlOrNull(value: unknown) {
  const receiptUrl = stringOrNull(value);
  if (!receiptUrl) return null;
  try {
    const url = new URL(receiptUrl);
    return url.protocol === "https:" && url.hostname === "pay.stripe.com"
      ? receiptUrl
      : null;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function unixTimeToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

export function isChargeSettlementAvailable(
  snapshot: ChargeSettlementSnapshot | null,
  expected: {
    amountCents: number;
    balanceTransactionId: string;
    chargeId: string;
    currency?: string;
    operationInstant?: string;
  },
) {
  return Boolean(
    snapshot &&
    snapshot.status === "available" &&
    snapshot.amountCents === expected.amountCents &&
    snapshot.balanceTransactionId === expected.balanceTransactionId &&
    snapshot.sourceChargeId === expected.chargeId &&
    snapshot.currency === (expected.currency ?? "brl").toLowerCase() &&
    Date.parse(snapshot.availableOn) <=
      (expected.operationInstant
        ? Date.parse(expected.operationInstant)
        : Date.now()),
  );
}
