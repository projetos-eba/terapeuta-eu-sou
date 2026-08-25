import type Stripe from "stripe";

export type PayoutBalanceDecision =
  | { kind: "ready"; sourceType: "bank_account" | "card" }
  | { availableAmountCents: number; kind: "pending_balance" }
  | { kind: "reconciliation_required"; reason: string };

export function selectConnectedPayoutBalance(
  balance: Pick<Stripe.Balance, "available">,
  amountCents: number,
): PayoutBalanceDecision {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { kind: "reconciliation_required", reason: "invalid_amount" };
  }

  const brl = balance.available.filter((entry) => entry.currency === "brl");
  const total = brl.reduce((sum, entry) => sum + entry.amount, 0);
  if (total < amountCents) {
    return { availableAmountCents: total, kind: "pending_balance" };
  }

  const eligibleSourceTypes = brl
    .filter((entry) => entry.amount >= amountCents)
    .map((entry) => entry.source_types ?? {})
    .flatMap((sourceTypes) =>
      (["bank_account", "card"] as const).filter(
        (sourceType) => (sourceTypes[sourceType] ?? 0) >= amountCents,
      ),
    );

  const unique = [...new Set(eligibleSourceTypes)];
  if (unique.length !== 1) {
    return {
      kind: "reconciliation_required",
      reason: unique.length === 0 ? "mixed_source_types" : "ambiguous_source_type",
    };
  }

  return { kind: "ready", sourceType: unique[0] };
}

export function buildConnectedPayoutParams(input: {
  amountCents: number;
  batchId: string;
  payoutBatchTherapistId: string;
  sourceType: "bank_account" | "card";
  therapistProfileId: string;
}): Stripe.PayoutCreateParams {
  return {
    amount: input.amountCents,
    currency: "brl",
    description: "Repasse semanal TES",
    metadata: {
      tes_payout_batch_id: input.batchId,
      tes_payout_batch_therapist_id: input.payoutBatchTherapistId,
      tes_therapist_profile_id: input.therapistProfileId,
      tes_system: "tes",
    },
    method: "standard",
    source_type: input.sourceType,
  };
}

export type ProviderFailureDisposition =
  | "blocked"
  | "reconciliation_required"
  | "transient";

export function classifyProviderFailure(error: unknown): {
  code: string;
  disposition: ProviderFailureDisposition;
  message: string;
} {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    rawType?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };
  const code = typeof candidate?.code === "string" ? candidate.code : "provider_error";
  const statusCode = typeof candidate?.statusCode === "number" ? candidate.statusCode : null;
  const type = typeof candidate?.type === "string" ? candidate.type : "";
  const message = sanitizeProviderMessage(candidate?.message);

  if (
    type.includes("Connection") ||
    type.includes("Timeout") ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET"
  ) {
    return { code: "provider_response_unknown", disposition: "reconciliation_required", message };
  }
  if (statusCode === 409 || statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return { code, disposition: "transient", message };
  }

  return { code, disposition: "blocked", message };
}

function sanitizeProviderMessage(value: unknown) {
  if (typeof value !== "string") return "Operacao financeira nao confirmada.";
  return value
    .replace(/\b(?:acct|po|tr|ch|pi|bt)_[A-Za-z0-9_]+\b/g, "[identificador]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 300);
}
