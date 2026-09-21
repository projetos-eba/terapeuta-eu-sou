import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

type Client = Pick<SupabaseRestClient, "get" | "rpc">;
type Provider = Pick<StripeClient, "charges" | "refunds" | "transfers">;

type Decision = {
  decisionId: string;
  amountCents: number;
  chargeId: string;
  transferId: string | null;
  reversalState: string;
  refundState: string;
  existing: boolean;
};

type PaymentBinding = {
  stripe_payment_intent_id: string;
  stripe_connect_account_id_snapshot: string;
  gross_amount_cents: number;
};

export type FullSessionRefundResult = {
  status: "completed" | "pending" | "needs_review";
  decisionId: string;
};

/** Provider calls are deliberately one-shot. An uncertain response is only
 * reconciled by reading Stripe, never by issuing a second POST. */
export async function runFullSessionRefundV10(input: {
  client: Client;
  stripe: Provider;
  environment: "test" | "live";
  actorUserId: string;
  paymentId: string;
  requestId: string;
  reason: string;
}): Promise<FullSessionRefundResult> {
  const { client, stripe, paymentId } = input;
  const previous = await client.get<Array<{
    id: string; actor_user_id: string; session_payment_id: string;
    request_id: string; reason: string; amount_cents: number;
    stripe_charge_id: string; stripe_transfer_id: string | null;
    reversal_state: string; refund_state: string;
  }>>(`/rest/v1/session_refund_decisions_v10?select=id,actor_user_id,session_payment_id,request_id,reason,amount_cents,stripe_charge_id,stripe_transfer_id,reversal_state,refund_state&request_id=eq.${encodeURIComponent(input.requestId)}&limit=1`);
  const existing = previous[0];
  if (existing && (existing.actor_user_id !== input.actorUserId ||
    existing.session_payment_id !== paymentId ||
    existing.reason !== input.reason.trim())) {
    throw new Error("full_refund_request_binding_mismatch");
  }
  const decision: Decision = existing ? {
    decisionId: existing.id, amountCents: existing.amount_cents,
    chargeId: existing.stripe_charge_id, transferId: existing.stripe_transfer_id,
    reversalState: existing.reversal_state, refundState: existing.refund_state,
    existing: true,
  } : await client.rpc<Decision>("claim_full_session_refund_v10_v3", {
    p_actor_user_id: input.actorUserId,
    p_session_payment_id: paymentId,
    p_request_id: input.requestId,
    p_reason: input.reason,
  });
  const [binding] = await client.get<PaymentBinding[]>(
    `/rest/v1/session_payments?select=stripe_payment_intent_id,stripe_connect_account_id_snapshot,gross_amount_cents&id=eq.${encodeURIComponent(paymentId)}&limit=1`,
  );
  if (!binding || binding.gross_amount_cents !== decision.amountCents) {
    throw new Error("full_refund_payment_binding_mismatch");
  }
  const charge = await stripe.charges.retrieve(decision.chargeId);
  if (!charge.paid || charge.status !== "succeeded" || charge.amount !== decision.amountCents ||
    charge.currency !== "brl" || charge.livemode !== (input.environment === "live") ||
    objectId(charge.payment_intent) !== binding.stripe_payment_intent_id) {
    throw new Error("full_refund_charge_binding_mismatch");
  }
  const refunds = await stripe.refunds.list({ charge: decision.chargeId, limit: 100 });
  if (refunds.has_more || refunds.data.length > 1 ||
    (refunds.data.length === 1 && refunds.data[0].amount !== decision.amountCents)) {
    throw new Error("full_refund_provider_history_requires_review");
  }

  let recoveryUncertain = false;
  if (decision.transferId) {
    const transfer = await stripe.transfers.retrieve(decision.transferId);
    if (transfer.source_transaction !== decision.chargeId ||
      transfer.destination !== binding.stripe_connect_account_id_snapshot ||
      transfer.currency !== "brl" || transfer.livemode !== (input.environment === "live")) {
      throw new Error("full_refund_transfer_binding_mismatch");
    }
    const reversals = await stripe.transfers.listReversals(decision.transferId, { limit: 100 });
    if (reversals.has_more) throw new Error("full_refund_reversal_history_incomplete");
    let reversed = 0;
    for (const reversal of reversals.data) {
      reversed += reversal.amount;
      await client.rpc("reconcile_session_transfer_reversal_v10", {
        p_stripe_transfer_id: transfer.id, p_stripe_reversal_id: reversal.id,
        p_amount_cents: reversal.amount, p_currency: reversal.currency.toUpperCase(),
        p_stripe_event_id: `tes:v10:refund-review:${reversal.id}`,
        p_occurred_at: new Date(reversal.created * 1000).toISOString(),
      });
    }
    if (reversed > transfer.amount) throw new Error("full_refund_reversal_exceeds_transfer");
    if (reversed === transfer.amount) {
      if (decision.reversalState === "attempting" || decision.reversalState === "unknown") {
        await transition(client, decision.decisionId, "reversal", "complete");
      }
    } else if (reversed > 0) {
      recoveryUncertain = true;
    } else if (decision.reversalState === "not_attempted") {
      await transition(client, decision.decisionId, "reversal", "attempting");
      try {
        const reversal = await stripe.transfers.createReversal(
          transfer.id,
          { amount: transfer.amount, metadata: { tes_refund_decision_id: decision.decisionId } },
          { idempotencyKey: `tes:v10:full-reversal:${decision.decisionId}` },
        );
        await client.rpc("reconcile_session_transfer_reversal_v10", {
          p_stripe_transfer_id: transfer.id, p_stripe_reversal_id: reversal.id,
          p_amount_cents: reversal.amount, p_currency: reversal.currency.toUpperCase(),
          p_stripe_event_id: `tes:v10:refund-command:${reversal.id}`,
          p_occurred_at: new Date(reversal.created * 1000).toISOString(),
        });
        await transition(client, decision.decisionId, "reversal", "complete");
      } catch (error) {
        const state = isInsufficientConnectedBalance(error) ? "unavailable" : "unknown";
        await transition(client, decision.decisionId, "reversal", state);
        recoveryUncertain = state === "unknown";
      }
    } else if (decision.reversalState !== "unavailable") {
      recoveryUncertain = true;
    }
  }

  let refund = refunds.data[0];
  if (!refund && decision.refundState === "not_attempted") {
    await transition(client, decision.decisionId, "refund", "attempting");
    try {
      refund = await stripe.refunds.create(
        { charge: decision.chargeId, amount: decision.amountCents,
          metadata: { tes_refund_decision_id: decision.decisionId } },
        { idempotencyKey: `tes:v10:full-refund:${decision.decisionId}` },
      );
    } catch {
      await transition(client, decision.decisionId, "refund", "unknown");
      return { status: "needs_review", decisionId: decision.decisionId };
    }
  }
  if (!refund) return { status: "needs_review", decisionId: decision.decisionId };
  await client.rpc("reconcile_session_refund_event_v10", {
    p_session_payment_id: paymentId, p_stripe_refund_id: refund.id,
    p_amount_cents: refund.amount, p_currency: refund.currency.toUpperCase(),
    p_status: refund.status, p_reason: refund.reason ?? null,
    p_stripe_event_id: `tes:v10:refund-command:${refund.id}`,
    p_occurred_at: new Date(refund.created * 1000).toISOString(),
  });
  if (refund.status === "succeeded") {
    const reconciliation = await client.rpc<{ status: string }>(
      "reconcile_full_session_refund_debt_v10_v2", { p_session_payment_id: paymentId },
    );
    await client.rpc("finalize_attendance_refund_financials_v1", {
      p_session_payment_id: paymentId,
    });
    const completed = reconciliation.status === "reconciled" && !recoveryUncertain;
    if (completed) {
      await client.rpc("complete_therapist_change_refund_v1", {
        p_actor_user_id: input.actorUserId,
        p_request_id: input.requestId,
        p_session_payment_id: paymentId,
      });
    }
    return { status: completed ? "completed" : "needs_review", decisionId: decision.decisionId };
  }
  if (decision.refundState === "attempting" || decision.refundState === "not_attempted") {
    await transition(client, decision.decisionId, "refund",
      refund.status === "pending" || refund.status === "requires_action" ? "pending" : "failed");
  }
  return { status: refund.status === "pending" || refund.status === "requires_action"
    ? "pending" : "needs_review", decisionId: decision.decisionId };
}

function transition(client: Client, id: string, step: string, state: string) {
  return client.rpc("transition_full_session_refund_step_v10", {
    p_decision_id: id, p_step: step, p_state: state,
  });
}

function objectId(value: unknown) {
  return typeof value === "string" ? value :
    value && typeof value === "object" && "id" in value ? String(value.id) : null;
}

function isInsufficientConnectedBalance(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "balance_insufficient" || error.code === "insufficient_funds";
}
