import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

type Body = {
  bookingId?: string;
};

const runtime = getPaymentsRuntime("confirm-session-by-therapist");

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
    const { profile: therapist, user } = await requireTherapist(
      client,
      request,
    );
    const body = await parseJsonBody<Body>(request);
    const bookingId = requireUuid(body.bookingId);
    const bookings = await client.get<
      Array<{
        id: string;
        starts_at: string;
        status: string;
        therapist_profile_id: string;
      }>
    >(
      `/rest/v1/bookings?select=id,therapist_profile_id,starts_at,status&id=eq.${encodeURIComponent(bookingId)}&limit=1`,
    );
    const booking = bookings[0];

    if (!booking || booking.therapist_profile_id !== therapist.id) {
      throw new DomainError(
        "booking_forbidden",
        403,
        "Sessao nao pertence a este terapeuta.",
      );
    }

    if (new Date(booking.starts_at) > new Date()) {
      throw new DomainError(
        "session_not_started",
        409,
        "A sessao ainda nao chegou ao horario previsto.",
      );
    }

    if (
      ["cancelled_by_patient", "cancelled_by_therapist", "refunded"].includes(
        booking.status,
      )
    ) {
      throw new DomainError(
        "session_blocked",
        409,
        "Esta sessao nao pode ser confirmada.",
      );
    }

    const confirmationId = await client.rpc<string>("confirm_session_service", {
      p_booking_id: booking.id,
      p_confirmed_by_profile_id: user.id,
      p_metadata: { source: "edge_function" },
      p_review_id: null,
      p_source: "therapist_manual",
    });

    return success({ confirmationId });
  } catch (error) {
    return failure(error, requestId);
  }
});

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError("invalid_booking_id", 422, "Identificador invalido.");
  }

  return value;
}

export {};
