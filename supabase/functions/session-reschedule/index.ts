import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  mapRescheduleDatabaseError,
  validateRescheduleCommand,
  type RescheduleCommandBody,
} from "./reschedule-command.ts";

type BookingRow = {
  booking_version: number;
  id: string;
  service_duration_minutes_snapshot: number;
  timezone: string;
};

type RescheduleRequestRow = {
  booking_id: string;
  id: string;
  requested_by_profile_id: string;
};

const runtime = getRuntime("session-reschedule");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  let operation = "session_reschedule";

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
    const user = await requireUser(client, request);
    const command = validateRescheduleCommand(
      await parseJsonBody<RescheduleCommandBody>(request),
    );

    try {
      if (command.action === "availability") {
        operation = "get_booking_reschedule_availability_v1";
        const availability = await client.rpc<Record<string, unknown>>(
          operation,
          {
            p_actor_profile_id: user.id,
            p_anchor: command.anchor,
            p_booking_id: command.bookingId,
            p_limit: command.scope === "next" ? 500 : 1000,
            p_scope: command.scope,
          },
        );

        return success(availability);
      }

      if (command.action === "request") {
        const booking = await getAuthorizedBooking(
          client,
          command.bookingId,
          user.id,
        );

        const proposedStartsAt = new Date(command.proposedStartsAt);
        const proposedEndsAt = new Date(
          proposedStartsAt.getTime() +
            booking.service_duration_minutes_snapshot * 60_000,
        ).toISOString();

        operation = "request_booking_reschedule_v1";
        const reschedule = await client.rpc<RescheduleRequestRow>(operation, {
          p_booking_id: booking.id,
          p_expected_booking_version:
            command.expectedBookingVersion ?? booking.booking_version,
          p_expires_in_seconds: 172800,
          p_proposed_ends_at: proposedEndsAt,
          p_proposed_starts_at: proposedStartsAt.toISOString(),
          p_proposed_timezone: booking.timezone,
          p_reason: command.reason,
          p_request_id: command.requestId,
          p_requested_by_profile_id: user.id,
        });

        return success({
          bookingId: booking.id,
          expiresInSeconds: 172800,
          rescheduleRequestId: reschedule.id,
          status: "pending",
        });
      }

      const reschedule = await getAuthorizedReschedule(
        client,
        command.rescheduleRequestId,
        user.id,
      );

      operation = "resolve_booking_reschedule_v1";
      let result: Record<string, unknown>;
      try {
        result = await client.rpc<Record<string, unknown>>(operation, {
          p_expected_booking_version: command.expectedBookingVersion,
          p_request_id: command.requestId,
          p_reschedule_request_id: reschedule.id,
          p_resolution: command.resolution,
          p_resolved_by_profile_id: user.id,
        });
      } catch (error) {
        if (
          command.resolution === "accepted" &&
          isSlotAvailabilityError(error)
        ) {
          operation = "invalidate_booking_reschedule_request_v1";
          await client.rpc(operation, {
            p_actor_profile_id: user.id,
            p_request_id: `${command.requestId}:unavailable`,
            p_reschedule_request_id: reschedule.id,
          });
        }
        throw error;
      }

      return success(result);
    } catch (error) {
      throw mapRescheduleDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "authenticated",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code:
          error instanceof DomainError
            ? error.code
            : "session_reschedule_failed",
        operation,
      }),
    );
    return failure(error, correlationId);
  }
});

async function getAuthorizedBooking(
  client: SupabaseRestClient,
  bookingId: string,
  userId: string,
) {
  await assertParticipant(client, bookingId, userId);

  const [booking] = await client.get<BookingRow[]>(
    `/rest/v1/bookings?select=id,booking_version:version,service_duration_minutes_snapshot,timezone&id=eq.${encodeURIComponent(
      bookingId,
    )}&limit=1`,
  );

  if (!booking) {
    throw new DomainError(
      "reschedule_forbidden",
      403,
      "Voce nao pode alterar este reagendamento.",
    );
  }

  return booking;
}

function isSlotAvailabilityError(error: unknown) {
  if (!(error instanceof Error) || !("safeDetails" in error)) return false;
  const details = String(Reflect.get(error, "safeDetails") ?? "");
  return [
    "BOOKING_CONFLICT",
    "PATIENT_SCHEDULE_CONFLICT",
    "SLOT_HELD_BY_ANOTHER_USER",
    "SLOT_NOT_AVAILABLE",
  ].some((code) => details.includes(code));
}

async function getAuthorizedReschedule(
  client: SupabaseRestClient,
  rescheduleRequestId: string,
  userId: string,
) {
  const [request] = await client.get<RescheduleRequestRow[]>(
    `/rest/v1/booking_reschedule_requests?select=id,booking_id,requested_by_profile_id&id=eq.${encodeURIComponent(
      rescheduleRequestId,
    )}&limit=1`,
  );

  if (!request) {
    throw new DomainError(
      "reschedule_forbidden",
      403,
      "Voce nao pode alterar este reagendamento.",
    );
  }

  await assertParticipant(client, request.booking_id, userId);

  return request;
}

async function assertParticipant(
  client: SupabaseRestClient,
  bookingId: string,
  userId: string,
) {
  const isParticipant = await client.rpc<boolean>(
    "is_booking_participant_profile_v1",
    {
      p_booking_id: bookingId,
      p_profile_id: userId,
    },
  );

  if (!isParticipant) {
    throw new DomainError(
      "reschedule_forbidden",
      403,
      "Voce nao pode alterar este reagendamento.",
    );
  }
}

export {};
