export type TherapistMetricsErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "session_expired"
  | "unavailable";

export class TherapistMetricsError extends Error {
  constructor(readonly code: TherapistMetricsErrorCode) {
    super(code);
  }
}

export function getTherapistMetricsErrorMessage(
  code: TherapistMetricsErrorCode,
) {
  const messages: Record<TherapistMetricsErrorCode, string> = {
    forbidden:
      "Seu plano ou perfil não permite consultar estas métricas no momento.",
    invalid_contract:
      "Os dados recebidos não puderam ser apresentados com segurança.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    unavailable:
      "Não foi possível consultar suas métricas agora. Tente novamente em instantes.",
  };

  return messages[code];
}
