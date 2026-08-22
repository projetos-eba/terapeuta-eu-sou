import type { TherapistServiceErrorCode } from "./therapist-services.types";

export type TherapistServicesApiError = {
  code: TherapistServiceErrorCode | "internal_error" | "network_error";
  message: string;
  requestId?: string;
  status?: number;
};

export function normalizeTherapistServicesError(
  input: unknown,
  fallback = "Não foi possível atualizar suas terapias agora.",
): TherapistServicesApiError {
  if (input && typeof input === "object" && "error" in input) {
    const error = (input as { error?: unknown }).error;

    if (error && typeof error === "object") {
      const code = (error as { code?: unknown }).code;
      const message = (error as { message?: unknown }).message;
      const requestId = (error as { requestId?: unknown }).requestId;

      return {
        code:
          typeof code === "string"
            ? (code as TherapistServicesApiError["code"])
            : "internal_error",
        message: typeof message === "string" ? message : fallback,
        requestId: typeof requestId === "string" ? requestId : undefined,
      };
    }
  }

  return {
    code: "internal_error",
    message: fallback,
  };
}
