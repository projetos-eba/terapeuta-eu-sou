import type { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";

type PaymentsDataClient = Pick<SupabaseRestClient, "rpc">;

type AuthorizationClaim = {
  claimed?: boolean;
  reason?: string;
};

export async function ensurePaidSessionPaymentAuthorization(
  client: PaymentsDataClient,
  input: {
    checkoutMode: unknown;
    checkoutSessionId: string | null;
    eventId: string;
    eventTime: string;
    paymentIntentId: string | null;
    sessionPaymentId: string;
  },
): Promise<void> {
  if (
    input.checkoutMode !== "initial_hold" &&
    input.checkoutMode !== "payment_retry"
  ) return;

  if (!input.checkoutSessionId) {
    throw new Error("session_payment_paid_checkout_missing");
  }

  const body = {
    p_event_created_at: input.eventTime,
    p_request_id: input.eventId,
    p_session_payment_id: input.sessionPaymentId,
    p_stripe_checkout_session_id: input.checkoutSessionId,
    p_stripe_payment_intent_id: input.paymentIntentId,
  };

  if (input.checkoutMode === "initial_hold") {
    // A fully discounted Checkout has no PaymentIntent and cannot represent
    // the failed-card-then-paid race handled by this recovery path.
    if (!input.paymentIntentId) return;

    const recovery = await client.rpc<AuthorizationClaim>(
      "recover_failed_session_payment_authorization_v10",
      {
        p_session_payment_id: body.p_session_payment_id,
        p_stripe_checkout_session_id: body.p_stripe_checkout_session_id,
        p_stripe_payment_intent_id: body.p_stripe_payment_intent_id,
        p_stripe_event_created_at: body.p_event_created_at,
        p_stripe_event_id: body.p_request_id,
      },
    );

    if (recovery?.claimed) return;

    const reason = typeof recovery?.reason === "string" &&
        recovery.reason.length > 0
      ? recovery.reason
      : "unknown";
    throw new Error(
      `session_payment_paid_authorization_not_claimed:initial_hold:${reason}`,
    );
  }

  const claim = await client.rpc<AuthorizationClaim>(
    "claim_session_payment_authorization_v1",
    {
      ...body,
    },
  );

  if (claim?.claimed) return;

  if (claim?.reason === "failed") {
    if (!input.paymentIntentId) {
      throw new Error("session_payment_paid_intent_missing");
    }

    const recovery = await client.rpc<AuthorizationClaim>(
      "recover_failed_session_payment_authorization_v10",
      {
        p_session_payment_id: body.p_session_payment_id,
        p_stripe_checkout_session_id: body.p_stripe_checkout_session_id,
        p_stripe_payment_intent_id: body.p_stripe_payment_intent_id,
        p_stripe_event_created_at: body.p_event_created_at,
        p_stripe_event_id: body.p_request_id,
      },
    );

    if (recovery?.claimed) return;

    const recoveryReason = typeof recovery?.reason === "string" &&
        recovery.reason.length > 0
      ? recovery.reason
      : "unknown";
    throw new Error(
      `session_payment_paid_authorization_not_claimed:payment_retry:${recoveryReason}`,
    );
  }

  const reason = typeof claim?.reason === "string" && claim.reason.length > 0
    ? claim.reason
    : "unknown";
  throw new Error(
    `session_payment_paid_authorization_not_claimed:payment_retry:${reason}`,
  );
}
