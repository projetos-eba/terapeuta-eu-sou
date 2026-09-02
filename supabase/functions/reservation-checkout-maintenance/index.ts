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
    let authorizationCanceled = 0;
    for (const capture of captures ?? []) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        capture.stripe_payment_intent_id,
      );
      if (
        paymentIntent.status === "canceled" ||
        paymentIntent.status === "requires_payment_method"
      ) {
        const payments = await client.get<
          Array<{ stripe_checkout_session_id: string | null }>
        >(
          `/rest/v1/session_payments?select=stripe_checkout_session_id&id=eq.${
            encodeURIComponent(capture.session_payment_id)
          }&limit=1`,
        );
        await client.rpc("apply_session_payment_state_v1", {
          p_financial_status:
            paymentIntent.status === "canceled" ? "canceled" : "failed",
          p_session_payment_id: capture.session_payment_id,
          p_stripe_charge_id: null,
          p_stripe_checkout_session_id:
            payments[0]?.stripe_checkout_session_id ?? null,
          p_stripe_event_created_at: new Date().toISOString(),
          p_stripe_event_id:
            `maintenance:${capture.stripe_payment_intent_id}:${paymentIntent.status}`,
          p_stripe_payment_intent_id: capture.stripe_payment_intent_id,
        });
        continue;
      }
      if (paymentIntent.status !== "requires_capture") continue;
      const claimedAt = new Date(capture.slot_claimed_at).getTime();
      if (Date.now() - claimedAt > 5 * 60_000) {
        await stripe.paymentIntents.cancel(
          capture.stripe_payment_intent_id,
          {},
          {
            idempotencyKey:
              `tes-capture-timeout:${capture.session_payment_id}`,
          },
        );
        authorizationCanceled += 1;
        continue;
      }
      await stripe.paymentIntents.capture(
        capture.stripe_payment_intent_id,
        {},
        { idempotencyKey: `tes-session-capture:${capture.session_payment_id}` },
      );
      captureRecovered += 1;
    }

    return success({
      authorizationCanceled,
      captureRecovered,
      expired: attempts?.length ?? 0,
      orphanedBootstrapsReleased: orphans?.length ?? 0,
      stripeExpired,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
