import type { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";

type PaymentsDataClient = Pick<SupabaseRestClient, "rpc">;

type AuthorizationClaim = {
  claimed?: boolean;
  reason?: string;
};

export async function ensurePaidPaymentRetryAuthorization(
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
  if (input.checkoutMode !== "payment_retry") return;

  if (!input.checkoutSessionId) {
    throw new Error("session_payment_paid_retry_checkout_missing");
  }

  const claim = await client.rpc<AuthorizationClaim>(
    "claim_session_payment_authorization_v1",
    {
      p_event_created_at: input.eventTime,
      p_request_id: input.eventId,
      p_session_payment_id: input.sessionPaymentId,
      p_stripe_checkout_session_id: input.checkoutSessionId,
      p_stripe_payment_intent_id: input.paymentIntentId,
    },
  );

  if (claim?.claimed) return;

  const reason = typeof claim?.reason === "string" && claim.reason.length > 0
    ? claim.reason
    : "unknown";
  throw new Error(`session_payment_paid_retry_not_claimed:${reason}`);
}
