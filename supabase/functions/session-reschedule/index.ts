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
import type { ServiceAvailableSlotsResponse } from "../session-booking-checkout/booking-checkout-command.ts";
import {
  mapRescheduleDatabaseError,
  rescheduleSlotRangeEnd,
  selectRescheduleSlot,
  validateRescheduleCommand,
  type RescheduleCommandBody,
} from "./reschedule-command.ts";

type BookingRow = {
  booking_version: number;
  id: string;
  service_id: string;
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
      if (command.action === "request") {
        const booking = await getAuthorizedBooking(
          client,
          command.bookingId,
          user.id,
        );

        operation = "get_service_available_slots_v1";
        const slots = await client.rpc<ServiceAvailableSlotsResponse | null>(
          operation,
          {
            p_limit: 50,
            p_range_end: rescheduleSlotRangeEnd(command.proposedStartsAt),
            p_range_start: command.proposedStartsAt,
            p_service_id: booking.service_id,
          },
        );
        const selectedSlot = selectRescheduleSlot(
          slots,
          command.proposedStartsAt,
        );

        operation = "request_booking_reschedule_v1";
        const reschedule = await client.rpc<RescheduleRequestRow>(operation, {
          p_booking_id: booking.id,
          p_expected_booking_version:
            command.expectedBookingVersion ?? booking.booking_version,
          p_expires_in_seconds: 172800,
          p_proposed_ends_at: selectedSlot.endsAt,
          p_proposed_starts_at: selectedSlot.startsAt,
          p_proposed_timezone: selectedSlot.timezone,
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
      const result = await client.rpc<Record<string, unknown>>(operation, {
        p_expected_booking_version: command.expectedBookingVersion,
        p_request_id: command.requestId,
        p_reschedule_request_id: reschedule.id,
        p_resolution: command.resolution,
        p_resolved_by_profile_id: user.id,
      });

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
    `/rest/v1/bookings?select=id,service_id,booking_version:version&id=eq.${encodeURIComponent(
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
