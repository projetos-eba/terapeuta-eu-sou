export type TherapistReviewsErrorCode =
  | "forbidden"
  | "invalid_payload"
  | "network_error"
  | "request_conflict"
  | "review_not_found"
  | "session_expired"
  | "unavailable"
  | "validation_error";

export class TherapistReviewsError extends Error {
  constructor(readonly code: TherapistReviewsErrorCode) {
    super(code);
  }
}

export type TherapistReviewsApiError = {
  code: TherapistReviewsErrorCode;
  message: string;
  status?: number;
};

export function normalizeTherapistReviewsError(
  payload: unknown,
): TherapistReviewsApiError {
  const error = isRecord(payload) ? record(payload.error) : {};
  const rawCode = string(error.code);
  const code = normalizeCode(rawCode);

  return {
    code,
    message: string(error.message) || getDefaultMessage(code),
  };
}

export function getDefaultMessage(code: TherapistReviewsErrorCode) {
  const messages: Record<TherapistReviewsErrorCode, string> = {
    forbidden: "Você não tem permissão para responder esta avaliação.",
    invalid_payload: "Revise os dados enviados.",
    network_error: "Não foi possível conectar agora. Tente novamente.",
    request_conflict:
      "Esta ação já foi enviada com dados diferentes. Recarregue a página.",
    review_not_found:
      "A avaliação não foi encontrada ou não está disponível para resposta.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    unavailable:
      "Não foi possível atualizar as avaliações agora. Tente novamente em instantes.",
    validation_error: "Escreva uma resposta entre 3 e 600 caracteres.",
  };

  return messages[code];
}

function normalizeCode(value: string): TherapistReviewsErrorCode {
  if (value === "FORBIDDEN") return "forbidden";
  if (value === "REQUEST_CONFLICT") return "request_conflict";
  if (value === "REVIEW_NOT_FOUND") return "review_not_found";
  if (value === "SESSION_EXPIRED") return "session_expired";
  if (value === "VALIDATION_ERROR") return "validation_error";
  return "unavailable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}
