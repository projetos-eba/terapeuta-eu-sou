import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PatientReviewCommandBody = {
  action?: "save" | "hide" | "publish";
  comment?: string;
  rating?: number | null;
  requestId?: string;
  therapistProfileId?: string;
};

export type ValidPatientReviewCommand = {
  action: "save" | "hide" | "publish";
  comment: string;
  rating: number | null;
  requestId: string;
  therapistProfileId: string;
};

export function validatePatientReviewCommand(
  body: PatientReviewCommandBody,
): ValidPatientReviewCommand {
  const action = body?.action;
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const rating = body?.rating ?? null;

  if (
    !body ||
    (action !== "save" && action !== "hide" && action !== "publish") ||
    !isUuid(body.requestId) ||
    !isUuid(body.therapistProfileId) ||
    comment.length > 1000
  ) {
    invalid();
  }
  if (
    action !== "hide" &&
    (typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5)
  ) {
    invalid();
  }

  return {
    action,
    comment,
    rating: action === "hide" ? null : rating,
    requestId: body.requestId,
    therapistProfileId: body.therapistProfileId,
  };
}

export function mapPatientReviewDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;
  const details = error.safeDetails ?? "";

  if (details.includes("PATIENT_REVIEW_REQUEST_CONFLICT")) {
    return new DomainError(
      "REQUEST_CONFLICT",
      409,
      "Esta operação já foi enviada com outros dados.",
    );
  }
  if (details.includes("PATIENT_REVIEW_RELATION_NOT_ELIGIBLE")) {
    return new DomainError(
      "NOT_ELIGIBLE",
      403,
      "A avaliação pública fica disponível após seu primeiro encontro realizado com este terapeuta.",
    );
  }
  if (details.includes("PATIENT_REVIEW_NOT_FOUND")) {
    return new DomainError("NOT_FOUND", 404, "A avaliação não foi encontrada.");
  }
  if (details.includes("PATIENT_REVIEW_PATIENT_REQUIRED")) {
    return new DomainError("FORBIDDEN", 403, "Esta ação não está disponível para o seu perfil.");
  }
  if (details.includes("PATIENT_REVIEW_VALIDATION_ERROR")) {
    return new DomainError("VALIDATION_ERROR", 422, "Revise os dados da avaliação.");
  }
  return new DomainError(
    "UNAVAILABLE",
    error.status >= 500 ? 503 : 400,
    "Não foi possível atualizar a avaliação agora.",
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(): never {
  throw new DomainError("VALIDATION_ERROR", 422, "Revise os dados da avaliação.");
}
