import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BookingCheckoutCommandBody = {
  holdTtlSeconds?: number;
  requestId?: string;
  serviceId?: string;
  startsAt?: string;
};

export type ValidBookingCheckoutCommand = {
  holdTtlSeconds: number;
  requestId: string;
  serviceId: string;
  startsAt: string;
};

export type ServiceAvailableSlotsResponse = {
  contractVersion?: number;
  service?: {
    id?: string;
  };
  slots?: Array<{
    endsAt?: string;
    startsAt?: string;
  }>;
  timezone?: string;
};

export type SelectedServiceSlot = {
  endsAt: string;
  startsAt: string;
  timezone: string;
};

export function validateBookingCheckoutCommand(
  body: BookingCheckoutCommandBody,
): ValidBookingCheckoutCommand {
  const ttl = body.holdTtlSeconds ?? 600;

  if (
    !isUuid(body.requestId) ||
    !isUuid(body.serviceId) ||
    !isIsoInstant(body.startsAt) ||
    !Number.isInteger(ttl) ||
    ttl < 60 ||
    ttl > 900
  ) {
    throw new DomainError(
      "invalid_booking_checkout_payload",
      422,
      "Revise os dados da reserva.",
    );
  }

  return {
    holdTtlSeconds: ttl,
    requestId: body.requestId,
    serviceId: body.serviceId,
    startsAt: new Date(body.startsAt).toISOString(),
  };
}

export function selectAvailableSlot(
  response: ServiceAvailableSlotsResponse | null,
  startsAt: string,
): SelectedServiceSlot {
  if (
    response?.contractVersion !== 1 ||
    typeof response.timezone !== "string" ||
    response.timezone.trim().length === 0 ||
    !Array.isArray(response.slots)
  ) {
    throw new DomainError(
      "slot_not_available",
      409,
      "Este horario nao esta mais disponivel.",
    );
  }

  const requested = new Date(startsAt).getTime();
  const slot = response.slots.find(
    (candidate) =>
      isIsoInstant(candidate.startsAt) &&
      isIsoInstant(candidate.endsAt) &&
      new Date(candidate.startsAt).getTime() === requested,
  );

  if (!slot?.startsAt || !slot.endsAt) {
    throw new DomainError(
      "slot_not_available",
      409,
      "Este horario nao esta mais disponivel.",
    );
  }

  return {
    endsAt: new Date(slot.endsAt).toISOString(),
    startsAt: new Date(slot.startsAt).toISOString(),
    timezone: response.timezone,
  };
}

export function slotRangeEnd(startsAt: string) {
  const date = new Date(startsAt);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function mapBookingCheckoutDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";

  if (details.includes("SLOT_HELD_BY_ANOTHER_USER")) {
    return new DomainError(
      "slot_held_by_another_user",
      409,
      "Este horario acabou de ser reservado por outra pessoa.",
    );
  }
  if (
    details.includes("SLOT_NOT_AVAILABLE") ||
    details.includes("invalid_slot_range")
  ) {
    return new DomainError(
      "slot_not_available",
      409,
      "Este horario nao esta mais disponivel.",
    );
  }
  if (details.includes("BOOKING_CONFLICT")) {
    return new DomainError(
      "booking_conflict",
      409,
      "Este horario entrou em conflito com outra reserva.",
    );
  }
  if (details.includes("IDEMPOTENCY_KEY_REUSED")) {
    return new DomainError(
      "idempotency_key_reused",
      409,
      "Esta tentativa de reserva ja foi usada com outros dados.",
    );
  }
  if (
    details.includes("SERVICE_NOT_FOUND") ||
    details.includes("PATIENT_NOT_FOUND") ||
    details.includes("BOOKING_HOLD_NOT_FOUND")
  ) {
    return new DomainError(
      "booking_checkout_not_found",
      404,
      "Nao encontramos os dados desta reserva.",
    );
  }
  if (
    details.includes("INVALID_AVAILABILITY_RANGE") ||
    details.includes("INVALID_TIMEZONE") ||
    details.includes("INVALID_HOLD_TTL") ||
    details.includes("INVALID_IDEMPOTENCY_KEY")
  ) {
    return new DomainError(
      "invalid_booking_checkout_payload",
      422,
      "Revise os dados da reserva.",
    );
  }

  return error;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}
