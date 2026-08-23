import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS = new Set([
  "patient_absent",
  "therapist_absent",
  "internet_problem",
  "audio_video_problem",
  "rescheduled",
  "late_cancellation",
  "other",
]);

export type SessionFeedbackCommandBody = {
  bookingId?: string;
  comment?: string;
  notPerformedReason?: string | null;
  outcome?: string;
  rating?: number | null;
};

export type ValidSessionFeedbackCommand = {
  bookingId: string;
  comment: string;
  notPerformedReason: string | null;
  outcome: "completed" | "not_performed";
  rating: number | null;
};

export function validateSessionFeedbackCommand(
  body: SessionFeedbackCommandBody,
): ValidSessionFeedbackCommand {
  if (!body || typeof body !== "object") invalid();

  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const outcome = body.outcome;
  const reason = body.notPerformedReason ?? null;
  const rating = body.rating ?? null;

  if (!isUuid(body.bookingId) || comment.length > 500) invalid();

  if (outcome === "completed") {
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      reason !== null
    ) {
      invalid();
    }
  } else if (
    outcome !== "not_performed" ||
    rating !== null ||
    typeof reason !== "string" ||
    !REASONS.has(reason)
  ) {
    invalid();
  }

  return {
    bookingId: body.bookingId,
    comment,
    notPerformedReason: reason,
    outcome,
    rating,
  };
}

export function mapSessionFeedbackDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";
  if (details.includes("FEEDBACK_REQUEST_CONFLICT")) {
    return new DomainError(
      "REQUEST_CONFLICT",
      409,
      "Este feedback já foi enviado com outros dados.",
    );
  }
  if (details.includes("FEEDBACK_PARTICIPANT_REQUIRED")) {
    return new DomainError(
      "FORBIDDEN",
      403,
      "Este feedback não está disponível para o seu perfil.",
    );
  }
  if (details.includes("FEEDBACK_SESSION_NOT_ELIGIBLE")) {
    return new DomainError(
      "UNAVAILABLE",
      409,
      "O feedback ainda está sendo preparado para esta sessão.",
    );
  }
  if (details.includes("FEEDBACK_ATTENDANCE_REQUIRED")) {
    return new DomainError(
      "UNAVAILABLE",
      409,
      "A avaliação de qualidade só fica disponível depois que os dois participantes entram no encontro.",
    );
  }
  if (details.includes("FEEDBACK_INCIDENT_NOT_AVAILABLE")) {
    return new DomainError(
      "UNAVAILABLE",
      409,
      "Este relato de ocorrência não está disponível para o estado atual do encontro.",
    );
  }
  if (details.includes("FEEDBACK_VALIDATION_ERROR")) {
    return new DomainError("VALIDATION_ERROR", 422, "Revise os dados do feedback.");
  }

  return new DomainError("UNAVAILABLE", error.status >= 500 ? 503 : 400, "Não foi possível registrar o feedback agora.");
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(): never {
  throw new DomainError("VALIDATION_ERROR", 422, "Revise os dados do feedback.");
}
