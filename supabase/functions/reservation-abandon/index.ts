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

type Body = { bookingId?: string; requestId?: string };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const runtime = getRuntime("reservation-abandon");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const correlationId = crypto.randomUUID();
  try {
    if (request.method !== "POST")
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey)
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { profile } = await requirePatient(client, request);
    const body = (await parseJsonBody<Body>(request)) ?? {};
    if (
      !body.bookingId ||
      !UUID.test(body.bookingId) ||
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
    if (!["draft", "pending_payment"].includes(booking.status))
      return success({ released: false, status: booking.status });
    const payments = await client.get<Array<{ financial_status: string }>>(
      `/rest/v1/session_payments?select=financial_status&booking_id=eq.${booking.id}&order=created_at.desc&limit=1`,
    );
    if (
      payments[0] &&
      !["pending", "failed", "canceled"].includes(payments[0].financial_status)
    ) {
      return success({ released: false, status: booking.status });
    }
    const released = await client.rpc<{ status?: string }>(
      "transition_booking_status_v1",
      {
        p_actor_profile_id: profile.user_id,
        p_booking_id: booking.id,
        p_expected_version: null,
        p_reason: "reservation_abandoned",
        p_request_id: body.requestId,
        p_source: "reservation_abandon",
        p_target_status: "cancelled_by_patient",
      },
    );
    return success({
      released: true,
      status: released?.status ?? "cancelled_by_patient",
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
