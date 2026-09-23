import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

type Client = Pick<SupabaseRestClient, "get" | "rpc">;
type Provider = Pick<StripeClient, "balance" | "transfers">;

type RefundDecision = {
  id: string;
  actor_user_id: string;
  session_payment_id: string;
  request_id: string;
  reversal_attempted_at: string;
  stripe_transfer_id: string;
};

type PaymentBinding = {
  stripe_connect_account_id_snapshot: string;
};

export type RefundReconciliationResult = {
  decisionId: string;
  paymentId: string;
  status:
    | "completed"
    | "awaiting_provider_evidence"
    | "partial_reversal_requires_review"
    | "provider_history_requires_review";
  reversedCents: number;
  connectedAvailableCents?: number;
  debtCents?: number;
};

/**
 * Reconciles ambiguous Transfer reversals using provider reads only. It never
 * repeats createReversal: after the grace period, an absent reversal plus an
 * insufficient connected available balance is definitive evidence that the
 * unrecovered amount must become therapist debt. A later provider reversal is
 * still absorbed idempotently by the existing debt reconciliation RPC.
 */
export async function reconcileUnknownFullSessionRefundsV10(input: {
  client: Client;
  stripe: Provider;
  environment: "test" | "live";
  now?: Date;
  gracePeriodMs?: number;
  limit?: number;
}): Promise<RefundReconciliationResult[]> {
  const now = input.now ?? new Date();
  const gracePeriodMs = input.gracePeriodMs ?? 5 * 60 * 1000;
  const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
  const attemptedBefore = new Date(now.getTime() - gracePeriodMs).toISOString();
  const decisions = await input.client.get<RefundDecision[]>(
    "/rest/v1/session_refund_decisions_v10" +
      "?select=id,actor_user_id,session_payment_id,request_id,reversal_attempted_at,stripe_transfer_id" +
      "&reversal_state=eq.unknown" +
      "&stripe_transfer_id=not.is.null" +
      `&reversal_attempted_at=lt.${encodeURIComponent(attemptedBefore)}` +
      "&order=reversal_attempted_at.asc" +
      `&limit=${limit}`,
  );
  const results: RefundReconciliationResult[] = [];

  for (const decision of decisions) {
    const [binding] = await input.client.get<PaymentBinding[]>(
      "/rest/v1/session_payments" +
        "?select=stripe_connect_account_id_snapshot" +
        `&id=eq.${encodeURIComponent(decision.session_payment_id)}` +
        "&limit=1",
    );
    if (!binding?.stripe_connect_account_id_snapshot) {
      results.push(baseResult(decision, "provider_history_requires_review", 0));
      continue;
    }

    const transfer = await input.stripe.transfers.retrieve(
      decision.stripe_transfer_id,
    );
    if (
      transfer.destination !== binding.stripe_connect_account_id_snapshot ||
      transfer.currency !== "brl" ||
      transfer.livemode !== (input.environment === "live")
    ) {
      results.push(baseResult(decision, "provider_history_requires_review", 0));
      continue;
    }

    const reversals = await input.stripe.transfers.listReversals(
      decision.stripe_transfer_id,
      { limit: 100 },
    );
    if (reversals.has_more) {
      results.push(baseResult(decision, "provider_history_requires_review", 0));
      continue;
    }

    let reversedCents = 0;
    for (const reversal of reversals.data) {
      reversedCents += reversal.amount;
      await input.client.rpc("reconcile_session_transfer_reversal_v10", {
        p_stripe_transfer_id: transfer.id,
        p_stripe_reversal_id: reversal.id,
        p_amount_cents: reversal.amount,
        p_currency: reversal.currency.toUpperCase(),
        p_stripe_event_id: `tes:v10:refund-reconcile:${reversal.id}`,
        p_occurred_at: new Date(reversal.created * 1000).toISOString(),
      });
    }
    if (
      reversedCents > transfer.amount ||
      (typeof transfer.amount_reversed === "number" &&
        transfer.amount_reversed !== reversedCents)
    ) {
      results.push(
        baseResult(decision, "provider_history_requires_review", reversedCents),
      );
      continue;
    }

    if (reversedCents === transfer.amount) {
      await transition(input.client, decision.id, "complete");
      const reconciliation = await finishReconciliation(input.client, decision);
      results.push({
        ...baseResult(
          decision,
          reconciliation.status === "reconciled"
            ? "completed"
            : "provider_history_requires_review",
          reversedCents,
        ),
        debtCents: numberFrom(reconciliation.debtCents),
      });
      continue;
    }

    const balance = await input.stripe.balance.retrieve(
      {},
      { stripeContext: binding.stripe_connect_account_id_snapshot },
    );
    const connectedAvailableCents = balance.available
      .filter((entry) => entry.currency === "brl")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const remainingCents = transfer.amount - reversedCents;

    if (connectedAvailableCents < remainingCents) {
      await transition(input.client, decision.id, "unavailable");
      const reconciliation = await finishReconciliation(input.client, decision);
      results.push({
        ...baseResult(
          decision,
          reconciliation.status === "reconciled"
            ? "completed"
            : "provider_history_requires_review",
          reversedCents,
        ),
        connectedAvailableCents,
        debtCents: numberFrom(reconciliation.debtCents),
      });
      continue;
    }

    results.push({
      ...baseResult(
        decision,
        reversedCents > 0
          ? "partial_reversal_requires_review"
          : "awaiting_provider_evidence",
        reversedCents,
      ),
      connectedAvailableCents,
    });
  }

  return results;
}

function baseResult(
  decision: RefundDecision,
  status: RefundReconciliationResult["status"],
  reversedCents: number,
): RefundReconciliationResult {
  return {
    decisionId: decision.id,
    paymentId: decision.session_payment_id,
    reversedCents,
    status,
  };
}

function transition(client: Client, decisionId: string, state: string) {
  return client.rpc("transition_full_session_refund_step_v10", {
    p_decision_id: decisionId,
    p_step: "reversal",
    p_state: state,
  });
}

async function finishReconciliation(
  client: Client,
  decision: RefundDecision,
): Promise<Record<string, unknown>> {
  const reconciliation = await client.rpc<Record<string, unknown>>(
    "reconcile_full_session_refund_debt_v10_v2",
    { p_session_payment_id: decision.session_payment_id },
  );
  if (reconciliation.status !== "reconciled") return reconciliation;

  await client.rpc("finalize_attendance_refund_financials_v1", {
    p_session_payment_id: decision.session_payment_id,
  });
  await client.rpc("complete_therapist_change_refund_v1", {
    p_actor_user_id: decision.actor_user_id,
    p_request_id: decision.request_id,
    p_session_payment_id: decision.session_payment_id,
  });
  return reconciliation;
}

function numberFrom(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
