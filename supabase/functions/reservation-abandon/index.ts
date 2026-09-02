import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  expireOpenCheckoutForAbandonment,
  isCurrentCheckoutForAbandonment,
} from "../_shared/payments/checkout-abandonment.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = {
  bookingId?: string;
  checkoutSessionId?: string;
  reason?: string;
  requestId?: string;
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const runtime = getPaymentsRuntime("reservation-abandon");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const correlationId = crypto.randomUUID();
  try {
    if (request.method !== "POST")
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const { profile } = await requirePatient(client, request);
    const body = (await parseJsonBody<Body>(request)) ?? {};
    if (
      !body.bookingId ||
      !UUID.test(body.bookingId) ||
      !body.checkoutSessionId?.startsWith("cs_") ||
      !body.requestId ||
      !UUID.test(body.requestId)
    ) {
      throw new DomainError(
        "invalid_reservation_abandon_payload",
        422,
        "Reserva invalida.",
      );
    }
    const bookings = await client.get<
      Array<{ id: string; status: string; patient_profile_id: string }>
    >(
      `/rest/v1/bookings?select=id,status,patient_profile_id&id=eq.${body.bookingId}&patient_profile_id=eq.${profile.id}&limit=1`,
    );
    const booking = bookings[0];
    if (!booking)
      throw new DomainError(
        "booking_not_found",
        404,
        "Reserva nao encontrada.",
      );
    if (
      !["draft", "pending_payment", "cancelled_by_payment"].includes(
        booking.status,
      )
    )
      return success({ released: false, status: booking.status });
    const payments = await client.get<
      Array<{
        financial_status: string;
        stripe_checkout_session_id: string | null;
      }>
    >(
      `/rest/v1/session_payments?select=financial_status,stripe_checkout_session_id&booking_id=eq.${booking.id}&order=created_at.desc&limit=1`,
    );
    const currentPayment = payments[0];
    if (
      !currentPayment ||
      !isCurrentCheckoutForAbandonment({
        currentCheckoutSessionId: currentPayment.stripe_checkout_session_id,
        requestedCheckoutSessionId: body.checkoutSessionId,
      })
    ) {
      return success({ released: false, status: booking.status });
    }
    if (
      !["pending", "failed", "canceled"].includes(
        currentPayment.financial_status,
      )
    ) {
      return success({ released: false, status: booking.status });
    }
    if (
      !(await expireOpenCheckoutForAbandonment({
        checkoutSessionId: body.checkoutSessionId,
        stripe,
      }))
    ) {
      return success({ released: false, status: booking.status });
    }
    const released = await client.rpc<{ released?: boolean; reason?: string }>(
      "cancel_reservation_checkout_attempt_v1",
      {
        p_booking_id: booking.id,
        p_reason:
          body.reason === "reservation_expired"
            ? "reservation_expired"
            : "reservation_abandoned",
        p_stripe_checkout_session_id: body.checkoutSessionId,
      },
    );
    return success({
      released: released?.released === true,
      status: released?.reason ?? booking.status,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "patient",
        correlation_id: correlationId,
        error_code:
          error instanceof DomainError
            ? error.code
            : "reservation_abandon_failed",
      }),
    );
    return failure(error, correlationId);
  }
});

export {};
