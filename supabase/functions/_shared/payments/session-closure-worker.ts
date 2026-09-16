import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

type ClosureClient = Pick<SupabaseRestClient, "rpc">;
type ClosureStripe = Pick<StripeClient, "paymentIntents">;

type ClosureCandidate = {
  amountCents: number;
  bookingId: string;
  bookingVersion: number;
  currency: string;
  idempotencyKey: string;
  scheduleId: string;
  scheduleStatus: string;
  sessionPaymentId: string;
  stripeCustomerId: string;
  stripeEnvironment: "live" | "test";
  stripePaymentIntentId: string | null;
  stripePaymentMethodId: string;
};

export async function runSessionClosureWorker(input: {
  client: ClosureClient;
  environment: "live" | "test";
  limit: number;
  now: string;
  stripe: ClosureStripe;
}) {
  const response = await input.client.rpc<{ items: unknown[] }>(
    "list_due_session_payment_closures_v10",
    { p_limit: input.limit, p_now: input.now },
  );
  const result = {
    candidates: response.items.length,
    closed: 0,
    paid: 0,
    pending: 0,
  };

  for (const raw of response.items) {
    const candidate = parseClosureCandidate(raw);
    if (candidate.stripeEnvironment !== input.environment) {
      throw new Error("session_closure_environment_mismatch");
    }

    if (!candidate.stripePaymentIntentId) {
      if (candidate.scheduleStatus === "scheduled") {
        await close(input.client, candidate, "not_created", input.now);
        result.closed += 1;
      } else {
        await openIncident(
          input.client,
          candidate.scheduleId,
          "payment_state_unknown_at_session_start",
        );
        result.pending += 1;
      }
      continue;
    }

    let intent = await input.stripe.paymentIntents.retrieve(
      candidate.stripePaymentIntentId,
    );
    if (
      intent.status === "requires_action" ||
      intent.status === "requires_payment_method"
    ) {
      try {
        intent = await input.stripe.paymentIntents.cancel(
          intent.id,
          {},
          { idempotencyKey: `${candidate.idempotencyKey}:cancel-at-start` },
        );
      } catch {
        // Stripe may have completed the PaymentIntent between retrieve and
        // cancel. Read it again before deciding whether the slot can close.
        intent = await input.stripe.paymentIntents.retrieve(intent.id);
      }
    }

    if (intent.status === "succeeded") {
      await recordSucceededIntent(input.client, candidate, intent, input.now);
      result.paid += 1;
      continue;
    }

    if (intent.status === "canceled") {
      await close(input.client, candidate, "canceled", input.now);
      result.closed += 1;
      continue;
    }

    await openIncident(
      input.client,
      candidate.scheduleId,
      intent.status === "processing"
        ? "payment_processing_at_session_start"
        : "payment_state_unknown_at_session_start",
    );
    result.pending += 1;
  }

  return result;
}

function parseClosureCandidate(value: unknown): ClosureCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("session_closure_candidate_invalid");
  }
  const row = value as Record<string, unknown>;
  for (const key of [
    "bookingId",
    "currency",
    "idempotencyKey",
    "scheduleId",
    "scheduleStatus",
    "sessionPaymentId",
    "stripeCustomerId",
    "stripePaymentMethodId",
  ]) {
    if (typeof row[key] !== "string" || !row[key]) {
      throw new Error("session_closure_candidate_invalid");
    }
  }
  if (
    (row.stripeEnvironment !== "test" && row.stripeEnvironment !== "live") ||
    !Number.isInteger(row.amountCents) ||
    Number(row.amountCents) <= 0 ||
    !Number.isInteger(row.bookingVersion) ||
    Number(row.bookingVersion) <= 0 ||
    (row.stripePaymentIntentId !== null &&
      typeof row.stripePaymentIntentId !== "string")
  ) {
    throw new Error("session_closure_candidate_invalid");
  }
  return row as ClosureCandidate;
}

async function recordSucceededIntent(
  client: ClosureClient,
  candidate: ClosureCandidate,
  intent: Awaited<ReturnType<StripeClient["paymentIntents"]["retrieve"]>>,
  now: string,
) {
  const chargeId =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : (intent.latest_charge?.id ?? null);
  const customerId =
    typeof intent.customer === "string"
      ? intent.customer
      : (intent.customer?.id ?? null);
  const paymentMethodId =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : (intent.payment_method?.id ?? null);
  await client.rpc("record_session_payment_intent_v10", {
    p_amount_cents: intent.amount,
    p_booking_id: candidate.bookingId,
    p_booking_version: candidate.bookingVersion,
    p_currency: intent.currency,
    p_event_created_at: now,
    p_event_id: `closure-worker:${intent.id}`,
    p_payment_intent_id: intent.id,
    p_schedule_id: candidate.scheduleId,
    p_session_payment_id: candidate.sessionPaymentId,
    p_status: "succeeded",
    p_stripe_charge_id: chargeId,
    p_stripe_customer_id: customerId,
    p_stripe_environment: candidate.stripeEnvironment,
    p_stripe_payment_method_id: paymentMethodId,
  });
}

async function close(
  client: ClosureClient,
  candidate: ClosureCandidate,
  observedStatus: "canceled" | "not_created",
  now: string,
) {
  await client.rpc("close_unpaid_session_payment_v10", {
    p_booking_id: candidate.bookingId,
    p_now: now,
    p_observed_stripe_status: observedStatus,
    p_schedule_id: candidate.scheduleId,
  });
}

async function openIncident(
  client: ClosureClient,
  scheduleId: string,
  code:
    | "payment_processing_at_session_start"
    | "payment_state_unknown_at_session_start",
) {
  await client.rpc("open_session_charge_incident_v10", {
    p_code: code,
    p_schedule_id: scheduleId,
  });
}
