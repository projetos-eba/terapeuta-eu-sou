import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  mapCancellationDatabaseError,
  resolveCancellationReason,
  validateCancellationCommand,
  type CancellationCommandBody,
} from "./cancellation-command.ts";

type CalculatedCancellationDecision = {
  booking_id: string;
  decision: string;
  platform_retained_cents: number;
  policy_version_id: string;
  refund_amount_cents: number;
  requires_manual_review: boolean;
  retained_amount_cents: number;
  review_due_at: string | null;
  session_payment_id: string;
  therapist_retained_cents: number;
};

type CancellationDecisionRecord = {
  booking_id: string;
  decision: string;
  id: string;
  platform_retained_cents: number;
  policy_version_id: string;
  reason: string;
  refund_amount_cents: number;
  request_id: string;
  requested_by_profile_id: string | null;
  requested_by_role: "admin" | "patient" | "therapist";
  requires_manual_review: boolean;
  retained_amount_cents: number;
  review_due_at: string | null;
  session_payment_id: string | null;
  therapist_retained_cents: number;
};

type SessionPaymentRow = {
  booking_id: string;
  financial_status: string;
  gross_amount_cents: number;
  id: string;
  patient_profile_id: string;
  stripe_payment_intent_id: string | null;
  therapist_profile_id: string;
  transfer_status: string;
};

const runtime = getPaymentsRuntime("request-session-cancellation");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const user = await requireUser(client, request);
    const command = validateCancellationCommand(
      await parseJsonBody<CancellationCommandBody>(request),
    );
    const reason = resolveCancellationReason(command.reason, user.role);
    const [payment] = await client.get<SessionPaymentRow[]>(
      `/rest/v1/session_payments?select=id,booking_id,patient_profile_id,therapist_profile_id,gross_amount_cents,financial_status,transfer_status,stripe_payment_intent_id&booking_id=eq.${encodeURIComponent(
        command.bookingId,
      )}&limit=1`,
    );

    if (!payment) {
      throw new DomainError(
        "session_payment_not_found",
        404,
        "Pagamento da sessao nao encontrado.",
      );
    }

    await assertCanCancel(client, payment, user);

    const [calculatedDecision] = await client.rpc<
      CalculatedCancellationDecision[]
    >("calculate_session_cancellation_policy", {
      p_booking_id: command.bookingId,
      p_now: new Date().toISOString(),
      p_reason: reason,
    });
    const decision =
      reason === "therapist_cancellation" && calculatedDecision
        ? applyTherapistCancellationPolicy(calculatedDecision, payment)
        : calculatedDecision;

    if (!decision) {
      throw new DomainError(
        "cancellation_policy_not_found",
        404,
        "Politica de cancelamento nao encontrada.",
      );
    }

    const [record] = await client.rpc<CancellationDecisionRecord[]>(
      "claim_session_cancellation_decision_v1",
      {
        p_booking_id: command.bookingId,
        p_decision: decision.decision,
        p_metadata: { stripeMode: config.stripeMode },
        p_platform_retained_cents: decision.platform_retained_cents,
        p_policy_version_id: decision.policy_version_id,
        p_reason: reason,
        p_refund_amount_cents: decision.refund_amount_cents,
        p_request_id: command.requestId,
        p_requested_by_profile_id: user.id,
        p_requested_by_role: user.role,
        p_requires_manual_review: decision.requires_manual_review,
        p_retained_amount_cents: decision.retained_amount_cents,
        p_review_due_at: decision.review_due_at,
        p_session_payment_id: decision.session_payment_id,
        p_therapist_retained_cents: decision.therapist_retained_cents,
      },
    );

    if (!record) {
      throw new DomainError(
        "cancellation_decision_not_created",
        503,
        "Nao foi possivel registrar o cancelamento agora.",
      );
    }

    if (record.requires_manual_review || record.refund_amount_cents <= 0) {
      await blockTransferForReview(client, payment.id);
      await transitionBookingCancellation(client, record);
      await markCancellationDecisionProcessed(client, record.id);

      return success({
        decision: record.decision,
        decisionId: record.id,
        refundAmountCents: record.refund_amount_cents,
        requiresManualReview: record.requires_manual_review,
      });
    }

    if (!payment.stripe_payment_intent_id) {
      throw new DomainError(
        "stripe_payment_intent_missing",
        409,
        "Pagamento Stripe ainda nao esta pronto para reembolso.",
      );
    }

    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "session_refund",
      record.request_id,
    ]);
    const refund = await stripe.refunds.create(
      {
        amount: record.refund_amount_cents,
        metadata: {
          cancellation_decision_id: record.id,
          decision: record.decision,
          system: "tes",
          tes_session_id: record.booking_id,
          tes_session_payment_id: payment.id,
        },
        payment_intent: payment.stripe_payment_intent_id,
        reason: "requested_by_customer",
      },
      { idempotencyKey },
    );

    await client.post(
      "/rest/v1/session_refunds?on_conflict=stripe_refund_id",
      {
        amount_cents: record.refund_amount_cents,
        currency: "BRL",
        metadata: {
          cancellationDecisionId: record.id,
          decision: record.decision,
          retainedAmountCents: record.retained_amount_cents,
        },
        processed_at: new Date().toISOString(),
        reason: record.reason,
        requested_by: user.id,
        session_payment_id: payment.id,
        status: refund.status,
        stripe_refund_id: refund.id,
      },
      "resolution=merge-duplicates,return=minimal",
    );
    await client.patch(
      `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
      {
        financial_status:
          record.refund_amount_cents >= payment.gross_amount_cents
            ? "refunded"
            : "partially_refunded",
        refund_pending: true,
        transfer_blocked_reason: "refund",
        transfer_status: "blocked",
      },
      "return=minimal",
    );
    await transitionBookingCancellation(client, record);
    await markCancellationDecisionProcessed(client, record.id);

    return success({
      decision: record.decision,
      decisionId: record.id,
      refundAmountCents: record.refund_amount_cents,
      refundId: refund.id,
      requiresManualReview: false,
    });
  } catch (error) {
    return failure(mapCancellationDatabaseError(error), correlationId);
  }
});

async function assertCanCancel(
  client: SupabaseRestClient,
  payment: SessionPaymentRow,
  user: { id: string; role: "admin" | "patient" | "therapist" },
) {
  if (user.role === "admin") return;

  if (user.role === "patient") {
    const rows = await client.get<Array<{ id: string }>>(
      `/rest/v1/patient_profiles?select=id&id=eq.${encodeURIComponent(
        payment.patient_profile_id,
      )}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    if (rows[0]) return;
  }

  if (user.role === "therapist") {
    const rows = await client.get<Array<{ id: string }>>(
      `/rest/v1/therapist_profiles?select=id&id=eq.${encodeURIComponent(
        payment.therapist_profile_id,
      )}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    if (rows[0]) return;
  }

  throw new DomainError(
    "cancellation_forbidden",
    403,
    "Voce nao pode cancelar esta sessao.",
  );
}

async function blockTransferForReview(
  client: SupabaseRestClient,
  sessionPaymentId: string,
) {
  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(sessionPaymentId)}`,
    {
      refund_pending: true,
      transfer_blocked_reason: "manual_refund_review",
      transfer_status: "blocked",
    },
    "return=minimal",
  );
}

async function markBookingCanceled(
  client: SupabaseRestClient,
  bookingId: string,
  role: "admin" | "patient" | "therapist",
  reason: string,
) {
  await client.patch(
    `/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`,
    {
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      status:
        role === "therapist"
          ? "cancelled_by_therapist"
          : "cancelled_by_patient",
    },
    "return=minimal",
  );
}

function applyTherapistCancellationPolicy(
  decision: CalculatedCancellationDecision,
  payment: SessionPaymentRow,
): CalculatedCancellationDecision {
  return {
    ...decision,
    decision: "therapist_cancellation_full_refund",
    platform_retained_cents: 0,
    refund_amount_cents: payment.gross_amount_cents,
    requires_manual_review:
      decision.requires_manual_review ||
      payment.transfer_status === "batched" ||
      payment.transfer_status === "transferred",
    retained_amount_cents: 0,
    therapist_retained_cents: 0,
  };
}

async function transitionBookingCancellation(
  client: SupabaseRestClient,
  decision: CancellationDecisionRecord,
) {
  await client.rpc("transition_booking_status_v1", {
    p_actor_profile_id:
      decision.requested_by_role === "admin"
        ? null
        : decision.requested_by_profile_id,
    p_booking_id: decision.booking_id,
    p_expected_version: null,
    p_reason: decision.reason,
    p_request_id: decision.request_id,
    p_source:
      decision.requested_by_role === "admin"
        ? "admin"
        : "request_session_cancellation",
    p_target_status:
      decision.requested_by_role === "therapist" ||
      decision.reason === "no_show"
        ? "cancelled_by_therapist"
        : "cancelled_by_patient",
  });
}

async function markCancellationDecisionProcessed(
  client: SupabaseRestClient,
  decisionId: string,
) {
  await client.patch(
    `/rest/v1/session_cancellation_decisions?id=eq.${encodeURIComponent(
      decisionId,
    )}`,
    { processed_at: new Date().toISOString() },
    "return=minimal",
  );
}

export {};
