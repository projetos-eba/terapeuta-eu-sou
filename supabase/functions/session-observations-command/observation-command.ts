import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SessionObservationCommandBody = {
  bookingId?: string;
  content?: string;
  requestId?: string;
};

export type ValidSessionObservationCommand = {
  bookingId: string;
  content: string;
  requestId: string;
};

export function validateSessionObservationCommand(
  body: SessionObservationCommandBody,
): ValidSessionObservationCommand {
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!body || typeof body !== "object" || !isUuid(body.bookingId) ||
    !isUuid(body.requestId) || content.length < 1 || content.length > 4000) {
    throw new DomainError("VALIDATION_ERROR", 422, "Revise suas observações.");
  }

  return { bookingId: body.bookingId, content, requestId: body.requestId };
}

export function mapSessionObservationDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";
  if (details.includes("SESSION_OBSERVATION_PREMIUM_PLUS_REQUIRED")) {
    return new DomainError(
      "FORBIDDEN",
      403,
      "As observações da sessão estão disponíveis no Premium Plus.",
    );
  }
  if (details.includes("SESSION_OBSERVATION_NOT_AVAILABLE")) {
    return new DomainError(
      "UNAVAILABLE",
      409,
      "As observações ficam disponíveis depois do término da sessão.",
    );
  }
  if (details.includes("SESSION_OBSERVATION_NOT_FOUND") ||
    details.includes("SESSION_OBSERVATION_THERAPIST_REQUIRED")) {
    return new DomainError("FORBIDDEN", 403, "Esta sessão não está disponível.");
  }
  if (details.includes("SESSION_OBSERVATION_REQUEST_CONFLICT")) {
    return new DomainError(
      "REQUEST_CONFLICT",
      409,
      "As observações foram atualizadas. Atualize a página antes de salvar novamente.",
    );
  }
  if (details.includes("SESSION_OBSERVATION_VALIDATION_ERROR")) {
    return new DomainError("VALIDATION_ERROR", 422, "Revise suas observações.");
  }

  return new DomainError(
    "UNAVAILABLE",
    error.status >= 500 ? 503 : 400,
    "Não foi possível salvar as observações agora.",
  );
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
