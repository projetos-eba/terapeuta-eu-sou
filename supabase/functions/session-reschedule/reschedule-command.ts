import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  selectAvailableSlot,
  slotRangeEnd,
  type ServiceAvailableSlotsResponse,
} from "../session-booking-checkout/booking-checkout-command.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RescheduleCommandBody =
  | {
      action?: "request";
      bookingId?: string;
      expectedBookingVersion?: number;
      proposedStartsAt?: string;
      reason?: string | null;
      requestId?: string;
    }
  | {
      action?: "resolve";
      expectedBookingVersion?: number;
      requestId?: string;
      rescheduleRequestId?: string;
      resolution?: "accepted" | "cancelled" | "rejected";
    };

export type ValidRescheduleCommand =
  | {
      action: "request";
      bookingId: string;
      expectedBookingVersion: number | null;
      proposedStartsAt: string;
      reason: string | null;
      requestId: string;
    }
  | {
      action: "resolve";
      expectedBookingVersion: number | null;
      requestId: string;
      rescheduleRequestId: string;
      resolution: "accepted" | "cancelled" | "rejected";
    };

export type SelectedRescheduleSlot = {
  endsAt: string;
  startsAt: string;
  timezone: string;
};

export function validateRescheduleCommand(
  body: RescheduleCommandBody,
): ValidRescheduleCommand {
  if (body.action === "request") {
    if (
      !isUuid(body.bookingId) ||
      !isUuid(body.requestId) ||
      !isIsoInstant(body.proposedStartsAt) ||
      !isOptionalVersion(body.expectedBookingVersion) ||
      (body.reason !== null &&
        body.reason !== undefined &&
        (typeof body.reason !== "string" || body.reason.length > 500))
    ) {
      invalid();
    }

    const proposedStartsAt = new Date(body.proposedStartsAt).toISOString();

    if (new Date(proposedStartsAt).getTime() <= Date.now()) {
      throw new DomainError(
        "invalid_reschedule_payload",
        422,
        "Escolha um horario futuro para reagendar.",
      );
    }

    return {
      action: "request",
      bookingId: body.bookingId,
      expectedBookingVersion: body.expectedBookingVersion ?? null,
      proposedStartsAt,
      reason: body.reason?.trim() || null,
      requestId: body.requestId,
    };
  }

  if (body.action === "resolve") {
    if (
      !isUuid(body.rescheduleRequestId) ||
      !isUuid(body.requestId) ||
      !isOptionalVersion(body.expectedBookingVersion) ||
      !["accepted", "cancelled", "rejected"].includes(body.resolution ?? "")
    ) {
      invalid();
    }

    return {
      action: "resolve",
      expectedBookingVersion: body.expectedBookingVersion ?? null,
      requestId: body.requestId,
      rescheduleRequestId: body.rescheduleRequestId,
      resolution: body.resolution as "accepted" | "cancelled" | "rejected",
    };
  }

  invalid();
}

export function selectRescheduleSlot(
  response: ServiceAvailableSlotsResponse | null,
  proposedStartsAt: string,
): SelectedRescheduleSlot {
  return selectAvailableSlot(response, proposedStartsAt);
}

export function rescheduleSlotRangeEnd(proposedStartsAt: string) {
  return slotRangeEnd(proposedStartsAt);
}

export function mapRescheduleDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";

  if (
    details.includes("SLOT_HELD_BY_ANOTHER_USER") ||
    details.includes("BOOKING_CONFLICT")
  ) {
    return new DomainError(
      "reschedule_slot_conflict",
      409,
      "Este horario entrou em conflito com outra reserva.",
    );
  }
  if (
    details.includes("SLOT_NOT_AVAILABLE") ||
    details.includes("INVALID_AVAILABILITY_RANGE")
  ) {
    return new DomainError(
      "reschedule_slot_not_available",
      409,
      "Este horario nao esta mais disponivel.",
    );
  }
  if (details.includes("BOOKING_VERSION_CONFLICT")) {
    return new DomainError(
      "booking_version_conflict",
      409,
      "Esta sessao foi alterada. Atualize a pagina e tente novamente.",
    );
  }
  if (
    details.includes("BOOKING_CANNOT_BE_RESCHEDULED") ||
    details.includes("BOOKING_RESCHEDULE_ALREADY_PENDING") ||
    details.includes("BOOKING_RESCHEDULE_ALREADY_RESOLVED") ||
    details.includes("IDEMPOTENCY_KEY_REUSED")
  ) {
    return new DomainError(
      "reschedule_not_allowed",
      409,
      "Esta sessao nao pode ser reagendada neste momento.",
    );
  }
  if (
    details.includes("BOOKING_ACTOR_FORBIDDEN") ||
    details.includes("BOOKING_NOT_FOUND") ||
    details.includes("BOOKING_RESCHEDULE_NOT_FOUND")
  ) {
    return new DomainError(
      "reschedule_forbidden",
      403,
      "Voce nao pode alterar este reagendamento.",
    );
  }
  if (
    details.includes("INVALID_IDEMPOTENCY_KEY") ||
    details.includes("INVALID_RESCHEDULE_RESOLUTION") ||
    details.includes("INVALID_TIMEZONE")
  ) {
    return new DomainError(
      "invalid_reschedule_payload",
      422,
      "Revise os dados do reagendamento.",
    );
  }

  return error;
}

function invalid(): never {
  throw new DomainError(
    "invalid_reschedule_payload",
    422,
    "Revise os dados do reagendamento.",
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

function isOptionalVersion(value: unknown) {
  return (
    value === undefined ||
    (Number.isInteger(value) && Number(value) >= 1)
  );
}
