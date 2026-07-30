import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requirePatient,
  success,
} from "../_shared/payments/http.ts";
import {
  mapBookingCheckoutDatabaseError,
  selectAvailableSlot,
  slotRangeEnd,
  type BookingCheckoutCommandBody,
  type ServiceAvailableSlotsResponse,
  validateBookingCheckoutCommand,
} from "./booking-checkout-command.ts";

type BookingHoldRow = {
  expires_at: string;
  id: string;
};

type BookingRow = {
  id: string;
};

type CheckoutResponse = {
  ok: true;
  data: {
    clientSecret: string | null;
    checkoutSessionId: string;
    sessionPaymentId: string;
    url: string | null;
  };
};

const runtime = getRuntime("session-booking-checkout");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  let operation = "session_booking_checkout";

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const bearerToken = requireBearerToken(request);
    const { profile: patient } = await requirePatient(client, request);
    const command = validateBookingCheckoutCommand(
      await parseJsonBody<BookingCheckoutCommandBody>(request),
    );

    try {
      operation = "get_service_available_slots_v1";
      const slots = await client.rpc<ServiceAvailableSlotsResponse | null>(
        operation,
        {
          p_limit: 50,
          p_range_end: slotRangeEnd(command.startsAt),
          p_range_start: command.startsAt,
          p_service_id: command.serviceId,
        },
      );
      const selectedSlot = selectAvailableSlot(slots, command.startsAt);

      operation = "reserve_booking_hold_v1";
      const hold = await client.rpc<BookingHoldRow>(operation, {
        p_ends_at: selectedSlot.endsAt,
        p_idempotency_key: command.requestId,
        p_patient_profile_id: patient.id,
        p_service_id: command.serviceId,
        p_starts_at: selectedSlot.startsAt,
        p_timezone: selectedSlot.timezone,
        p_ttl_seconds: command.holdTtlSeconds,
      });

      operation = "consume_booking_hold_v1";
      const booking = await client.rpc<BookingRow>(operation, {
        p_hold_id: hold.id,
        p_idempotency_key: command.requestId,
      });

      operation = "stripe-create-session-payment";
      const checkout = await invokeSessionPaymentCheckout({
        bearerToken,
        bookingId: booking.id,
        serviceRoleKey,
        supabaseUrl,
      });

      return success({
        bookingId: booking.id,
        clientSecret: checkout.data.clientSecret,
        checkoutSessionId: checkout.data.checkoutSessionId,
        holdExpiresAt: hold.expires_at,
        holdId: hold.id,
        sessionPaymentId: checkout.data.sessionPaymentId,
        url: checkout.data.url,
      });
    } catch (error) {
      throw mapBookingCheckoutDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "patient",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code:
          error instanceof DomainError
            ? error.code
            : "session_booking_checkout_failed",
        operation,
      }),
    );
    return failure(error, correlationId);
  }
});

async function invokeSessionPaymentCheckout(input: {
  bearerToken: string;
  bookingId: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  const response = await fetch(
    `${input.supabaseUrl}/functions/v1/stripe-create-session-payment`,
    {
      body: JSON.stringify({
        bookingId: input.bookingId,
        checkoutUiMode: "embedded",
      }),
      headers: {
        apikey: input.serviceRoleKey,
        Authorization: `Bearer ${input.bearerToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | CheckoutResponse
    | {
        ok: false;
        error?: { code?: string; message?: string };
      }
    | null;

  if (!response.ok || payload?.ok !== true) {
    throw new DomainError(
      payload?.ok === false && payload.error?.code
        ? payload.error.code
        : "session_payment_checkout_failed",
      response.status || 502,
      payload?.ok === false && payload.error?.message
        ? payload.error.message
        : "Nao conseguimos iniciar o pagamento agora.",
    );
  }

  return payload;
}

function requireBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new DomainError(
      "unauthorized",
      401,
      "Entre na sua conta para continuar.",
    );
  }

  return token;
}

export {};
