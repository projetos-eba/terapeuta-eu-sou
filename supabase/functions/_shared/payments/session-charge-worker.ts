import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

type ClaimedSchedule = {
  scheduleId: string;
  bookingId: string;
  bookingVersion: number;
  sessionPaymentId: string;
  stripeEnvironment: "test" | "live";
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
};

type ChargeClient = Pick<SupabaseRestClient, "rpc">;
type ChargeStripe = Pick<StripeClient, "paymentIntents">;

export async function runSessionChargeWorker(input: {
  client: ChargeClient;
  stripe: ChargeStripe;
  environment: "test" | "live";
  now: string;
  workerId: string;
  limit: number;
}) {
  // A pending therapist-led reschedule fences the original scheduled charge.
  // Expire decisions first so a request whose deadline is the payment window
  // cannot keep the original booking unpaid indefinitely.  The database
  // preserves the original appointment for an unchosen future reschedule.
  await input.client.rpc<number>("expire_booking_reschedule_requests_v1", {
    p_now: input.now,
  });

  const claimed = await input.client.rpc<{ claims: unknown[] }>(
    "claim_due_session_payment_schedules_v10",
    {
      p_now: input.now,
      p_worker_id: input.workerId,
      p_limit: input.limit,
      p_lease_minutes: 5,
    },
  );
  const result = {
    claimed: claimed.claims.length,
    paid: 0,
    processing: 0,
    customerActionRequired: 0,
    retryScheduled: 0,
    failed: 0,
  };

  for (const raw of claimed.claims) {
    const claim = parseClaim(raw);
    if (claim.stripeEnvironment !== input.environment) {
      throw new Error("session_charge_environment_mismatch");
    }
    try {
      const intent = await input.stripe.paymentIntents.create(
        {
          amount: claim.amountCents,
          currency: claim.currency.toLowerCase(),
          customer: claim.stripeCustomerId,
          payment_method: claim.stripePaymentMethodId,
          payment_method_types: ["card"],
          confirm: true,
          off_session: true,
          metadata: {
            payment_type: "therapy_session",
            tes_checkout_mode: "t24_charge",
            tes_payment_flow_version: "v10",
            tes_session_id: claim.bookingId,
            tes_booking_version: String(claim.bookingVersion),
            tes_session_payment_id: claim.sessionPaymentId,
            tes_schedule_id: claim.scheduleId,
          },
        },
        { idempotencyKey: claim.idempotencyKey },
      );
      const state = await recordIntent(
        input.client,
        claim,
        intent,
        stripeObjectCreatedAt(intent),
      );
      countState(result, state);
    } catch (error) {
      const intent = stripeIntentFromError(error);
      if (intent) {
        const state = await recordIntent(
          input.client,
          claim,
          intent,
          stripeObjectCreatedAt(intent),
        );
        countState(result, state);
        continue;
      }
      // Unknown Stripe outcomes are retried with the SAME idempotency key.
      // Never create a second logical charge for this booking version.
      const failure = await input.client.rpc<{ status: string }>(
        "fail_session_payment_schedule_attempt_v10",
        {
          p_schedule_id: claim.scheduleId,
          p_worker_id: input.workerId,
          p_error_code: classifyTransientError(error),
          p_now: input.now,
        },
      );
      if (failure.status === "failed") result.failed += 1;
      else result.retryScheduled += 1;
    }
  }
  return result;
}

function stripeObjectCreatedAt(intent: { created?: unknown }) {
  // Use Stripe's own instant so the signed succeeded event can enrich the
  // payment without being misclassified as older than a local worker clock.
  if (
    typeof intent.created !== "number" ||
    !Number.isSafeInteger(intent.created) ||
    intent.created <= 0
  ) {
    throw new Error("session_charge_intent_created_at_invalid");
  }
  return new Date(intent.created * 1000).toISOString();
}

function parseClaim(value: unknown): ClaimedSchedule {
  if (!value || typeof value !== "object") {
    throw new Error("session_charge_claim_invalid");
  }
  const claim = value as Record<string, unknown>;
  for (const key of [
    "scheduleId",
    "bookingId",
    "sessionPaymentId",
    "stripeCustomerId",
    "stripePaymentMethodId",
    "idempotencyKey",
    "currency",
  ]) {
    if (typeof claim[key] !== "string" || !claim[key]) {
      throw new Error("session_charge_claim_invalid");
    }
  }
  if (
    claim.stripeEnvironment !== "test" &&
    claim.stripeEnvironment !== "live"
  ) {
    throw new Error("session_charge_claim_invalid");
  }
  if (
    !Number.isInteger(claim.amountCents) ||
    Number(claim.amountCents) <= 0 ||
    !Number.isInteger(claim.bookingVersion) ||
    Number(claim.bookingVersion) <= 0
  ) {
    throw new Error("session_charge_claim_invalid");
  }
  return claim as ClaimedSchedule;
}

function stripeIntentFromError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    payment_intent?: unknown;
    raw?: { payment_intent?: unknown };
  };
  const intent = value.payment_intent ?? value.raw?.payment_intent;
  return intent && typeof intent === "object" && "id" in intent
    ? (intent as Awaited<ReturnType<StripeClient["paymentIntents"]["create"]>>)
    : null;
}

async function recordIntent(
  client: ChargeClient,
  claim: ClaimedSchedule,
  intent: Awaited<ReturnType<StripeClient["paymentIntents"]["create"]>>,
  eventCreatedAt: string,
) {
  if (
    ![
      "succeeded",
      "processing",
      "requires_action",
      "requires_payment_method",
      "canceled",
    ].includes(intent.status)
  ) {
    throw new Error("session_charge_intent_status_unexpected");
  }
  const chargeId =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : (intent.latest_charge?.id ?? null);
  const result = await client.rpc<{ scheduleStatus: string }>(
    "record_session_payment_intent_v10",
    {
      p_schedule_id: claim.scheduleId,
      p_session_payment_id: claim.sessionPaymentId,
      p_booking_id: claim.bookingId,
      p_booking_version: claim.bookingVersion,
      p_stripe_environment: claim.stripeEnvironment,
      p_payment_intent_id: intent.id,
      p_status: intent.status,
      p_amount_cents: intent.amount,
      p_currency: intent.currency,
      p_stripe_customer_id:
        typeof intent.customer === "string"
          ? intent.customer
          : (intent.customer?.id ?? null),
      p_stripe_payment_method_id:
        typeof intent.payment_method === "string"
          ? intent.payment_method
          : (intent.payment_method?.id ?? null),
      p_stripe_charge_id: chargeId,
      p_event_id: intent.status === "succeeded" ? `worker:${intent.id}` : null,
      p_event_created_at: intent.status === "succeeded" ? eventCreatedAt : null,
    },
  );
  return result.scheduleStatus;
}

function classifyTransientError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "ETIMEDOUT" || code === "api_connection_error") {
    return "stripe_timeout";
  }
  return "stripe_state_unknown";
}

function countState(
  result: {
    paid: number;
    processing: number;
    customerActionRequired: number;
    retryScheduled: number;
    failed: number;
  },
  state: string,
) {
  if (state === "paid") result.paid += 1;
  else if (state === "processing") result.processing += 1;
  else if (state === "requires_customer_action")
    result.customerActionRequired += 1;
  else if (state === "failed") result.failed += 1;
  else if (state === "retry_scheduled") result.retryScheduled += 1;
  else throw new Error("session_charge_schedule_status_unexpected");
}
