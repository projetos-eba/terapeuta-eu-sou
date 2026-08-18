import type { TherapistProfileErrorCode } from "./therapist-profile-editor.types";

export type TherapistProfileApiError = {
  code: TherapistProfileErrorCode;
  message: string;
  requestId?: string;
  status?: number;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
  ok?: false;
};

const fallbackMessages: Record<TherapistProfileErrorCode, string> = {
  CAPABILITY_NOT_ALLOWED: "Seu plano atual não permite este recurso.",
  FORBIDDEN: "Use uma conta de terapeuta para continuar.",
  PROFILE_LOCKED: "Este perfil não pode ser alterado agora.",
  PROFILE_NOT_FOUND: "Perfil profissional não encontrado.",
  SLUG_INVALID: "Use de 3 a 40 caracteres para criar seu link.",
  SLUG_RESERVED: "Este endereço é reservado pela plataforma.",
  SLUG_TAKEN: "Este link acabou de ser escolhido. Tente outra opção.",
  UNAVAILABLE: "Não foi possível acessar o perfil agora.",
  VALIDATION_ERROR: "Revise os dados do perfil antes de continuar.",
  VERSION_CONFLICT:
    "Seu perfil foi alterado em outra sessão. Atualize e tente novamente.",
  network_error: "Não foi possível conectar agora. Tente novamente.",
  unknown: "Não foi possível concluir a operação agora.",
};

export function normalizeTherapistProfileError(
  error: unknown,
): TherapistProfileApiError {
  if (isErrorEnvelope(error)) {
    const code = normalizeCode(error.error?.code);
    return {
      code,
      message: error.error?.message ?? fallbackMessages[code],
      requestId: error.error?.requestId,
    };
  }

  return {
    code: "unknown",
    message: fallbackMessages.unknown,
  };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return Boolean(value && typeof value === "object" && "ok" in value);
}

function normalizeCode(value: string | undefined): TherapistProfileErrorCode {
  if (
    value === "CAPABILITY_NOT_ALLOWED" ||
    value === "FORBIDDEN" ||
    value === "PROFILE_LOCKED" ||
    value === "PROFILE_NOT_FOUND" ||
    value === "SLUG_INVALID" ||
    value === "SLUG_RESERVED" ||
    value === "SLUG_TAKEN" ||
    value === "UNAVAILABLE" ||
    value === "VALIDATION_ERROR" ||
    value === "VERSION_CONFLICT"
  ) {
    return value;
  }

  if (value === "unauthorized" || value === "role_mismatch") {
    return "FORBIDDEN";
  }

  return "unknown";
}
