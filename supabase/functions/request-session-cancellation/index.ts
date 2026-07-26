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

type Body = {
  bookingId?: string;
  reason?: string;
};

type CancellationDecision = {
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

  const requestId = crypto.randomUUID();

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
    const body = await parseJsonBody<Body>(request);
    const bookingId = requireUuid(body.bookingId, "invalid_booking_id");
    const reason = normalizeReason(body.reason);
    const [payment] = await client.get<SessionPaymentRow[]>(
      `/rest/v1/session_payments?select=id,booking_id,patient_profile_id,therapist_profile_id,gross_amount_cents,financial_status,transfer_status,stripe_payment_intent_id&booking_id=eq.${encodeURIComponent(
        bookingId,
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

    const [calculatedDecision] = await client.rpc<CancellationDecision[]>(
      "calculate_session_cancellation_policy",
      {
        p_booking_id: bookingId,
        p_now: new Date().toISOString(),
        p_reason: reason,
      },
    );
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

    const [record] = await client.post<Array<{ id: string }>>(
      "/rest/v1/session_cancellation_decisions?select=id",
      {
        booking_id: bookingId,
        decision: decision.decision,
        metadata: { stripeMode: config.stripeMode },
        platform_retained_cents: decision.platform_retained_cents,
        policy_version_id: decision.policy_version_id,
        reason,
        refund_amount_cents: decision.refund_amount_cents,
        requested_by_profile_id: user.id,
        requires_manual_review: decision.requires_manual_review,
        retained_amount_cents: decision.retained_amount_cents,
        review_due_at: decision.review_due_at,
        session_payment_id: decision.session_payment_id,
        therapist_retained_cents: decision.therapist_retained_cents,
      },
      "return=representation",
    );

    if (decision.requires_manual_review || decision.refund_amount_cents <= 0) {
      await blockTransferForReview(client, payment.id);
      await markBookingCanceled(client, bookingId, user.role, reason);
      await cancelVideoSession(client, bookingId);

      return success({
        decision: decision.decision,
        decisionId: record?.id,
        refundAmountCents: decision.refund_amount_cents,
        requiresManualReview: decision.requires_manual_review,
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
      bookingId,
      reason,
    ]);
    const refund = await stripe.refunds.create(
      {
        amount: decision.refund_amount_cents,
        metadata: {
          cancellation_decision_id: record?.id ?? "",
          decision: decision.decision,
          system: "tes",
          tes_session_id: bookingId,
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
        amount_cents: decision.refund_amount_cents,
        currency: "BRL",
        metadata: {
          cancellationDecisionId: record?.id,
          decision: decision.decision,
          retainedAmountCents: decision.retained_amount_cents,
        },
        processed_at: new Date().toISOString(),
        reason,
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
          decision.refund_amount_cents >= payment.gross_amount_cents
            ? "refunded"
            : "partially_refunded",
        refund_pending: true,
        transfer_blocked_reason: "refund",
        transfer_status: "blocked",
      },
      "return=minimal",
    );
    await markBookingCanceled(client, bookingId, user.role, reason);
    await cancelVideoSession(client, bookingId);

    return success({
      decision: decision.decision,
      decisionId: record?.id,
      refundAmountCents: decision.refund_amount_cents,
      refundId: refund.id,
      requiresManualReview: false,
    });
  } catch (error) {
    return failure(error, requestId);
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

function normalizeReason(value: unknown) {
  if (value === "no_show") return "no_show";
  if (value === "therapist_cancellation") return "therapist_cancellation";
  return "patient_cancellation";
}

function applyTherapistCancellationPolicy(
  decision: CancellationDecision,
  payment: SessionPaymentRow,
): CancellationDecision {
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

function requireUuid(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError(code, 422, "Identificador invalido.");
  }

  return value;
}

async function cancelVideoSession(
  client: SupabaseRestClient,
  bookingId: string,
) {
  try {
    await client.rpc("cancel_video_session_for_booking_v1", {
      p_booking_id: bookingId,
      p_source: "request-session-cancellation",
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        code: "VIDEO_SESSION_CANCEL_NOT_APPLIED",
        message: error instanceof Error ? error.message : "UNKNOWN",
        bookingId,
      }),
    );
  }
}

export {};
