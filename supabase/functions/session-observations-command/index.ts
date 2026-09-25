import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  isUuid,
  mapSessionObservationDatabaseError,
  type SessionObservationCommandBody,
  validateSessionObservationCommand,
} from "./observation-command.ts";

type ObservationRow = {
  booking_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type BookingRow = {
  ends_at: string;
  id: string;
  status: "cancelled_by_patient" | "cancelled_by_therapist" | "refunded" | string;
};

const runtime = getRuntime("session-observations-command");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError("UNAVAILABLE", 503, "Configuração indisponível.");
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { profile: therapist, user } = await requireTherapist(client, request);

    if (request.method === "GET") {
      const bookingId = new URL(request.url).searchParams.get("bookingId");
      if (!isUuid(bookingId)) {
        throw new DomainError("VALIDATION_ERROR", 422, "Sessão inválida.");
      }

      return success(await getObservationAccess(client, therapist.id, therapist.plan, bookingId));
    }

    if (request.method !== "PUT") {
      throw new DomainError("METHOD_NOT_ALLOWED", 405, "Método não permitido.");
    }

    const command = validateSessionObservationCommand(
      await parseJsonBody<SessionObservationCommandBody>(request),
    );

    try {
      return success(await client.rpc("save_therapist_session_observation_v1", {
        p_actor_user_id: user.id,
        p_booking_id: command.bookingId,
        p_content: command.content,
        p_request_id: command.requestId,
      }));
    } catch (error) {
      logDatabaseFailure(error, correlationId, user.id);
      throw mapSessionObservationDatabaseError(error);
    }
  } catch (error) {
    logFailure(error, correlationId);
    return failure(error, correlationId);
  }
});

async function getObservationAccess(
  client: SupabaseRestClient,
  therapistProfileId: string,
  plan: "free" | "premium" | "premium_plus",
  bookingId: string,
) {
  const bookings = await client.get<BookingRow[]>(
    `/rest/v1/bookings?select=id,ends_at,status&id=eq.${encodeURIComponent(bookingId)}&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&limit=1`,
  );
  const booking = bookings[0];
  if (!booking) {
    throw new DomainError("FORBIDDEN", 403, "Esta sessão não está disponível.");
  }

  const observations = await client.get<ObservationRow[]>(
    `/rest/v1/therapist_session_observations?select=booking_id,content,created_at,updated_at&booking_id=eq.${encodeURIComponent(bookingId)}&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&limit=1`,
  );
  const observation = observations[0];

  return {
    canEdit: plan === "premium_plus" && isSessionEligible(booking),
    observation: observation
      ? {
          bookingId: observation.booking_id,
          content: observation.content,
          createdAt: observation.created_at,
          updatedAt: observation.updated_at,
        }
      : null,
  };
}

function isSessionEligible(booking: BookingRow) {
  return Date.parse(booking.ends_at) <= Date.now() &&
    !["cancelled_by_patient", "cancelled_by_therapist", "refunded"].includes(booking.status);
}

function logFailure(error: unknown, correlationId: string) {
  console.error(JSON.stringify({
    code: error instanceof DomainError ? error.code : "session_observations_failed",
    correlation_id: correlationId,
    operation: "session_observations_command",
  }));
}

function logDatabaseFailure(error: unknown, correlationId: string, userId: string) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(JSON.stringify({
    correlation_id: correlationId,
    details: error.safeDetails,
    operation: "session_observations_command.database",
    status: error.status,
    user_id: userId,
  }));
}
