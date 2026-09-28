import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

type Client = Pick<SupabaseRestClient, "rpc">;
type Provider = Pick<StripeClient, "transfers">;

export type SessionDisputeProjectionV10 = {
  applied: boolean;
  disputeStatus: string;
  paymentFlowVersion: string;
  providerReversalAmountCents: number;
  recoveryAmountCents: number;
  recoveryState: string;
  sessionPaymentId: string;
  stripeAccountId: string | null;
  stripeChargeId: string;
  stripeDisputeId: string;
  stripeEnvironment: "test" | "live" | null;
  stripeTransferId: string | null;
  therapistProfileId: string;
};

/**
 * Recovers therapist exposure only after Stripe definitively closes a dispute
 * as lost. Provider writes are one-shot: an ambiguous outcome is persisted for
 * reconciliation and never retried blindly by a later webhook delivery.
 */
export async function runLostSessionDisputeRecoveryV10(input: {
  client: Client;
  eventId: string;
  eventTime: string;
  projection: SessionDisputeProjectionV10;
  stripe: Provider;
}) {
  const { client, projection, stripe } = input;
  if (projection.paymentFlowVersion !== "v10") {
    return { status: "no_action" as const };
  }
  if (
    projection.recoveryState === "unknown" ||
    projection.recoveryState === "requires_review"
  ) {
    await recordRecoveryIncident(client, projection, projection.recoveryState);
    return { status: "needs_review" as const };
  }
  if (
    projection.disputeStatus !== "lost" ||
    projection.recoveryState === "not_needed" ||
    projection.recoveryState === "complete" ||
    projection.recoveryState === "pending_resolution"
  ) {
    return { status: "no_action" as const };
  }

  const claimed = await client.rpc<boolean>(
    "claim_session_dispute_recovery_v10",
    { p_stripe_dispute_id: projection.stripeDisputeId },
  );

  if (!claimed && projection.recoveryState !== "attempting") {
    return { status: "already_claimed" as const };
  }

  if (projection.providerReversalAmountCents === 0) {
    await client.rpc("complete_session_dispute_recovery_v10", {
      p_definitive_provider_shortfall: true,
      p_stripe_dispute_id: projection.stripeDisputeId,
    });
    return { status: "debt_recorded" as const };
  }

  if (
    !projection.stripeTransferId ||
    !projection.stripeAccountId ||
    !projection.stripeEnvironment
  ) {
    await markNeedsReview(client, projection, "transfer_binding_missing");
    return { status: "needs_review" as const };
  }

  let transfer: Awaited<ReturnType<Provider["transfers"]["retrieve"]>>;
  let reversals: Array<{
    amount: number;
    created: number;
    currency: string;
    id: string;
    metadata?: Record<string, string> | null;
  }> = [];
  try {
    transfer = await stripe.transfers.retrieve(projection.stripeTransferId);
    for await (
      const reversal of stripe.transfers.listReversals(
        projection.stripeTransferId,
        { limit: 100 },
      )
    ) {
      reversals.push(reversal);
    }
  } catch {
    await markNeedsReview(client, projection, "provider_read_ambiguous", "unknown");
    return { status: "needs_review" as const };
  }

  if (
    transfer.amount < projection.providerReversalAmountCents ||
    transfer.currency !== "brl" ||
    transfer.destination !== projection.stripeAccountId ||
    transfer.source_transaction !== projection.stripeChargeId ||
    transfer.livemode !== (projection.stripeEnvironment === "live")
  ) {
    await markNeedsReview(client, projection, "transfer_binding_mismatch");
    return { status: "needs_review" as const };
  }

  const matching = reversals.filter(
    (reversal) =>
      reversal.metadata?.tes_stripe_dispute_id === projection.stripeDisputeId,
  );
  if (matching.length > 1) {
    await markNeedsReview(client, projection, "multiple_dispute_reversals");
    return { status: "needs_review" as const };
  }
  if (matching.length === 1) {
    const reversal = matching[0];
    if (
      reversal.amount !== projection.providerReversalAmountCents ||
      reversal.currency !== "brl"
    ) {
      await markNeedsReview(client, projection, "dispute_reversal_mismatch");
      return { status: "needs_review" as const };
    }
    await reconcileReversal(client, projection, reversal, input.eventId);
    await client.rpc("complete_session_dispute_recovery_v10", {
      p_definitive_provider_shortfall: false,
      p_stripe_dispute_id: projection.stripeDisputeId,
    });
    return { status: "recovered" as const };
  }

  if (reversals.length > 0) {
    await markNeedsReview(client, projection, "unrelated_transfer_reversal");
    return { status: "needs_review" as const };
  }

  if (!claimed) {
    await markNeedsReview(
      client,
      projection,
      "provider_write_outcome_unknown",
      "unknown",
    );
    return { status: "needs_review" as const };
  }

  try {
    const reversal = await stripe.transfers.createReversal(
      projection.stripeTransferId,
      {
        amount: projection.providerReversalAmountCents,
        metadata: {
          tes_session_payment_id: projection.sessionPaymentId,
          tes_stripe_dispute_id: projection.stripeDisputeId,
        },
      },
      {
        idempotencyKey: `tes:v10:dispute-reversal:${projection.stripeDisputeId}`,
      },
    );
    await reconcileReversal(client, projection, reversal, input.eventId);
    await client.rpc("complete_session_dispute_recovery_v10", {
      p_definitive_provider_shortfall: false,
      p_stripe_dispute_id: projection.stripeDisputeId,
    });
    return { status: "recovered" as const };
  } catch (error) {
    if (isInsufficientConnectedBalance(error)) {
      await client.rpc("complete_session_dispute_recovery_v10", {
        p_definitive_provider_shortfall: true,
        p_stripe_dispute_id: projection.stripeDisputeId,
      });
      return { status: "debt_recorded" as const };
    }
    await markNeedsReview(
      client,
      projection,
      "provider_write_outcome_unknown",
      "unknown",
    );
    return { status: "needs_review" as const };
  }
}

async function reconcileReversal(
  client: Client,
  projection: SessionDisputeProjectionV10,
  reversal: { amount: number; created: number; currency: string; id: string },
  eventId: string,
) {
  await client.rpc("reconcile_session_dispute_transfer_reversal_v10", {
    p_amount_cents: reversal.amount,
    p_currency: reversal.currency.toUpperCase(),
    p_occurred_at: new Date(reversal.created * 1000).toISOString(),
    p_stripe_dispute_id: projection.stripeDisputeId,
    p_stripe_event_id: eventId,
    p_stripe_reversal_id: reversal.id,
    p_stripe_transfer_id: projection.stripeTransferId,
  });
}

async function markNeedsReview(
  client: Client,
  projection: SessionDisputeProjectionV10,
  code: string,
  state: "requires_review" | "unknown" = "requires_review",
) {
  await client.rpc("mark_session_dispute_recovery_review_v10", {
    p_state: state,
    p_stripe_dispute_id: projection.stripeDisputeId,
  });
  await recordRecoveryIncident(client, projection, code);
}

async function recordRecoveryIncident(
  client: Client,
  projection: SessionDisputeProjectionV10,
  code: string,
) {
  await client.rpc("record_payout_operational_incident_v1", {
    p_error_code: code,
    p_error_message: "A recuperação da contestação exige conferência.",
    p_incident_key: `session-dispute:${projection.stripeDisputeId}:recovery`,
    p_incident_type: "session_dispute_recovery_requires_review",
    p_metadata: {
      sessionPaymentId: projection.sessionPaymentId,
      stripeDisputeId: projection.stripeDisputeId,
    },
    p_severity: "critical",
    p_therapist_profile_id: projection.therapistProfileId,
  });
}

function isInsufficientConnectedBalance(error: unknown) {
  const records = [asRecord(error)];
  records.push(asRecord(records[0].raw), asRecord(records[0].cause));
  if (
    records.some(
      (record) =>
        record.code === "balance_insufficient" ||
        record.code === "insufficient_funds",
    )
  ) {
    return true;
  }
  const status = records
    .map((record) => record.statusCode ?? record.status)
    .find((value) => typeof value === "number");
  if (status !== 400) return false;
  return records.some(
    (record) =>
      typeof record.message === "string" &&
      /\b(?:insufficient (?:funds|balance)|does not have sufficient funds)\b/i.test(
        record.message,
      ),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
