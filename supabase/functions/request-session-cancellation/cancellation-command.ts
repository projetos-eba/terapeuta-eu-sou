import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CancellationCommandBody = {
  bookingId?: string;
  reason?: string;
  requestId?: string;
};

export type ValidCancellationCommand = {
  bookingId: string;
  reason: string | null;
  requestId: string;
};

export function validateCancellationCommand(
  body: CancellationCommandBody,
): ValidCancellationCommand {
  if (
    !isUuid(body.bookingId) ||
    !isUuid(body.requestId) ||
    (body.reason !== undefined &&
      (typeof body.reason !== "string" || body.reason.length > 500))
  ) {
    throw new DomainError(
      "invalid_cancellation_payload",
      422,
      "Revise os dados do cancelamento.",
    );
  }

  return {
    bookingId: body.bookingId,
    reason: body.reason?.trim() || null,
    requestId: body.requestId,
  };
}

export function resolveCancellationReason(
  reason: string | null,
  role: "admin" | "patient" | "therapist",
) {
  if (role === "therapist") {
    return reason === "no_show" ? "no_show" : "therapist_cancellation";
  }

  if (role === "admin" && reason === "no_show") return "no_show";

  return "patient_cancellation";
}

export function mapCancellationDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";
  if (
    details.includes("IDEMPOTENCY_KEY_REUSED") ||
    details.includes("INVALID_STATE_TRANSITION") ||
    details.includes("BOOKING_VERSION_CONFLICT")
  ) {
    return new DomainError(
      "cancellation_conflict",
      409,
      "Esta sessao foi alterada. Atualize a pagina e tente novamente.",
    );
  }

  if (
    details.includes("BOOKING_ACTOR_FORBIDDEN") ||
    details.includes("BOOKING_NOT_FOUND")
  ) {
    return new DomainError(
      "cancellation_forbidden",
      403,
      "Voce nao pode cancelar esta sessao.",
    );
  }

  if (
    details.includes("INVALID_CANCELLATION_ACTOR_ROLE") ||
    details.includes("INVALID_CANCELLATION_DECISION")
  ) {
    return new DomainError(
      "invalid_cancellation_payload",
      422,
      "Revise os dados do cancelamento.",
    );
  }

  return error;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
