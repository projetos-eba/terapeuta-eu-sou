import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import { extractCheckoutFinancialSnapshot } from "../_shared/payments/checkout-financials.ts";
import { ensureVideoSessionForPaidSessionPayment } from "../stripe-billing-webhook/session-payment-side-effects.ts";
import { resolveRecoverableCaptureAction } from "./capture-recovery-policy.ts";

type ExpiredAttempt = {
  checkout_session_id: string | null;
  session_payment_id: string;
};

type RecoverableCapture = {
  session_payment_id: string;
  slot_claimed_at: string;
  stripe_payment_intent_id: string;
};

type ExpiredOrphan = {
  booking_id: string;
};

const runtime = getPaymentsRuntime("reservation-checkout-maintenance");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }
    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const attempts = await client.rpc<ExpiredAttempt[]>(
      "expire_due_initial_checkout_attempts_v1",
      { p_limit: 100, p_now: new Date().toISOString() },
    );
    const orphans = await client.rpc<ExpiredOrphan[]>(
      "expire_due_initial_checkout_orphans_v1",
      { p_limit: 100, p_now: new Date().toISOString() },
    );
    const captures = await client.rpc<RecoverableCapture[]>(
      "list_recoverable_session_captures_v1",
      { p_limit: 50, p_now: new Date().toISOString() },
    );

    let stripeExpired = 0;
    for (const attempt of attempts ?? []) {
      if (!attempt.checkout_session_id) continue;
      try {
        const checkout = await stripe.checkout.sessions.retrieve(
          attempt.checkout_session_id,
        );
        if (checkout.status === "open") {
          await stripe.checkout.sessions.expire(attempt.checkout_session_id);
          stripeExpired += 1;
        }
      } catch {
        console.warn(
          JSON.stringify({ code: "RESERVATION_CHECKOUT_EXPIRATION_DEFERRED" }),
        );
      }
    }

    let captureRecovered = 0;
    let captureRecoveryDeferred = 0;
    let paymentRecovered = 0;
    let authorizationCanceled = 0;
    for (const capture of captures ?? []) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          capture.stripe_payment_intent_id,
          { expand: ["latest_charge.balance_transaction"] },
        );
        const payment = await getSessionPaymentContext(
          client,
          capture.session_payment_id,
        );
        const recoveryAction = resolveRecoverableCaptureAction({
          nowMs: Date.now(),
          paymentIntentStatus: paymentIntent.status,
          slotClaimedAt: capture.slot_claimed_at,
        });
        if (
          recoveryAction === "reconcile_canceled" ||
          recoveryAction === "reconcile_failed"
        ) {
          await applyRecoveredPaymentState(client, {
            checkoutSessionId: payment?.stripe_checkout_session_id ?? null,
            paymentIntentId: capture.stripe_payment_intent_id,
            sessionPaymentId: capture.session_payment_id,
            status:
              recoveryAction === "reconcile_canceled" ? "canceled" : "failed",
          });
          continue;
        }
        if (recoveryAction === "reconcile_paid") {
          await reconcileSucceededPayment(client, stripe, {
            checkoutSessionId: payment?.stripe_checkout_session_id ?? null,
            paymentIntent: paymentIntent as unknown as Record<string, unknown>,
            sessionPaymentId: capture.session_payment_id,
          });
          paymentRecovered += 1;
          continue;
        }
        if (recoveryAction === "keep_blocked") continue;
        if (recoveryAction === "cancel_authorization") {
          await stripe.paymentIntents.cancel(
            capture.stripe_payment_intent_id,
            {},
            {
              idempotencyKey: `tes-capture-timeout:${capture.session_payment_id}`,
            },
          );
          await applyRecoveredPaymentState(client, {
            checkoutSessionId: payment?.stripe_checkout_session_id ?? null,
            paymentIntentId: capture.stripe_payment_intent_id,
            sessionPaymentId: capture.session_payment_id,
            status: "canceled",
          });
          authorizationCanceled += 1;
          continue;
        }
        const capturedPaymentIntent = await stripe.paymentIntents.capture(
          capture.stripe_payment_intent_id,
          {},
          {
            idempotencyKey: `tes-session-capture:${capture.session_payment_id}`,
          },
        );
        captureRecovered += 1;
        if (capturedPaymentIntent.status === "succeeded") {
          const expandedPaymentIntent = await stripe.paymentIntents.retrieve(
            capture.stripe_payment_intent_id,
            { expand: ["latest_charge.balance_transaction"] },
          );
          await reconcileSucceededPayment(client, stripe, {
            checkoutSessionId: payment?.stripe_checkout_session_id ?? null,
            paymentIntent: expandedPaymentIntent as unknown as Record<
              string,
              unknown
            >,
            sessionPaymentId: capture.session_payment_id,
          });
          paymentRecovered += 1;
        }
      } catch {
        // Unknown Stripe state stays blocking and is retried by the next run.
        captureRecoveryDeferred += 1;
        console.warn(
          JSON.stringify({ code: "SESSION_CAPTURE_RECOVERY_DEFERRED" }),
        );
      }
    }

    return success({
      authorizationCanceled,
      captureRecovered,
      captureRecoveryDeferred,
      expired: attempts?.length ?? 0,
      orphanedBootstrapsReleased: orphans?.length ?? 0,
      paymentRecovered,
      stripeExpired,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function getSessionPaymentContext(
  client: SupabaseRestClient,
  sessionPaymentId: string,
) {
  const payments = await client.get<
    Array<{ stripe_checkout_session_id: string | null }>
  >(
    `/rest/v1/session_payments?select=stripe_checkout_session_id&id=eq.${encodeURIComponent(
      sessionPaymentId,
    )}&limit=1`,
  );
  return payments[0] ?? null;
}

async function applyRecoveredPaymentState(
  client: SupabaseRestClient,
  input: {
    checkoutSessionId: string | null;
    paymentIntentId: string;
    sessionPaymentId: string;
    status: "canceled" | "failed";
  },
) {
  const now = new Date().toISOString();
  await client.rpc("apply_session_payment_state_v1", {
    p_financial_status: input.status,
    p_session_payment_id: input.sessionPaymentId,
    p_stripe_charge_id: null,
    p_stripe_checkout_session_id: input.checkoutSessionId,
    p_stripe_event_created_at: now,
    p_stripe_event_id: `maintenance:${input.paymentIntentId}:${input.status}`,
    p_stripe_payment_intent_id: input.paymentIntentId,
  });
}

async function reconcileSucceededPayment(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  input: {
    checkoutSessionId: string | null;
    paymentIntent: Record<string, unknown>;
    sessionPaymentId: string;
  },
) {
  const now = new Date().toISOString();
  const paymentIntentId = stringOrNull(input.paymentIntent.id);
  if (!paymentIntentId) throw new Error("payment_intent_id_missing");

  if (input.checkoutSessionId) {
    const checkout = await stripe.checkout.sessions.retrieve(
      input.checkoutSessionId,
    );
    const snapshot = extractCheckoutFinancialSnapshot(
      checkout as unknown as Record<string, unknown>,
    );
    if (snapshot) {
      const reconciliation = await client.rpc<{
        applied: boolean;
        reason?: string;
      }>("reconcile_session_payment_amount_v1", {
        p_charged_amount_cents: snapshot.chargedAmountCents,
        p_discount_amount_cents: snapshot.discountAmountCents,
        p_metadata: snapshot.metadata,
        p_original_amount_cents: snapshot.originalAmountCents,
        p_session_payment_id: input.sessionPaymentId,
        p_stripe_checkout_session_id: input.checkoutSessionId,
      });
      if (!reconciliation?.applied) {
        throw new Error(
          `stripe_amount_reconciliation_failed:${reconciliation?.reason ?? "unknown"}`,
        );
      }
    }
  }

  const charge = asRecord(input.paymentIntent.latest_charge);
  const chargeId =
    typeof input.paymentIntent.latest_charge === "string"
      ? input.paymentIntent.latest_charge
      : stringOrNull(charge.id);
  await client.rpc("apply_session_payment_state_v1", {
    p_financial_status: "paid",
    p_session_payment_id: input.sessionPaymentId,
    p_stripe_charge_id: chargeId,
    p_stripe_checkout_session_id: input.checkoutSessionId,
    p_stripe_event_created_at: now,
    p_stripe_event_id: `maintenance:${paymentIntentId}:paid`,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (chargeId) {
    const balanceTransaction = asRecord(charge.balance_transaction);
    const paymentMethodDetails = asRecord(charge.payment_method_details);
    await client.rpc("record_session_payment_stripe_reconciliation_v1", {
      p_payment_method_type: stringOrNull(paymentMethodDetails.type),
      p_payment_origin: "stripe_checkout",
      p_receipt_url: stringOrNull(charge.receipt_url),
      p_session_payment_id: input.sessionPaymentId,
      p_stripe_balance_transaction_id: stringOrNull(balanceTransaction.id),
      p_stripe_charge_id: chargeId,
      p_stripe_event_created_at: now,
      p_stripe_event_id: `maintenance:${paymentIntentId}:paid`,
      p_stripe_fee_amount_cents: numberOrNull(balanceTransaction.fee),
      p_stripe_net_amount_cents: numberOrNull(balanceTransaction.net),
    });
  }

  const zoomEnvironment = getConfiguredZoomEnvironment();
  if (zoomEnvironment) {
    await ensureVideoSessionForPaidSessionPayment(client, {
      sessionPaymentId: input.sessionPaymentId,
      source: "reservation-checkout-maintenance",
      zoomEnvironment,
    });
  }
}

function getConfiguredZoomEnvironment() {
  const value = runtime.env.get("ZOOM_ENVIRONMENT")?.trim().toLowerCase();
  if (value === "development" || value === "production") return value;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

export {};
