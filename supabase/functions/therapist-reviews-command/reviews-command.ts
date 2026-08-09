import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TherapistReviewsCommandBody = {
  action?: "reply";
  body?: string;
  requestId?: string;
  reviewId?: string;
};

export type ValidTherapistReviewsCommand = {
  action: "reply";
  body: string;
  requestId: string;
  reviewId: string;
};

export function validateTherapistReviewsCommand(
  body: TherapistReviewsCommandBody,
): ValidTherapistReviewsCommand {
  if (body.action !== "reply") invalid();

  const replyBody = typeof body.body === "string" ? body.body.trim() : "";

  if (
    !isUuid(body.reviewId) ||
    !isUuid(body.requestId) ||
    replyBody.length < 3 ||
    replyBody.length > 600
  ) {
    invalid();
  }

  return {
    action: "reply",
    body: replyBody,
    requestId: body.requestId,
    reviewId: body.reviewId,
  };
}

export function mapTherapistReviewsDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";

  if (details.includes("REQUEST_CONFLICT")) {
    return new DomainError(
      "REQUEST_CONFLICT",
      409,
      "Esta resposta ja foi enviada com outros dados.",
    );
  }
  if (details.includes("REVIEW_NOT_FOUND")) {
    return new DomainError(
      "REVIEW_NOT_FOUND",
      404,
      "A avaliacao nao foi encontrada.",
    );
  }
  if (details.includes("VALIDATION_ERROR")) {
    return new DomainError(
      "VALIDATION_ERROR",
      422,
      "Revise os dados da resposta.",
    );
  }
  if (
    details.includes("PROFILE_NOT_FOUND") ||
    details.includes("CAPABILITY_NOT_ALLOWED")
  ) {
    return new DomainError(
      "FORBIDDEN",
      403,
      "Esta acao nao esta disponivel para o seu perfil.",
    );
  }

  return new DomainError(
    "UNAVAILABLE",
    error.status >= 500 ? 503 : 400,
    "Nao foi possivel atualizar as avaliacoes agora.",
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(): never {
  throw new DomainError(
    "VALIDATION_ERROR",
    422,
    "Revise os dados da resposta.",
  );
}
