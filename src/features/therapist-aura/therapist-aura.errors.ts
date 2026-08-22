export type TherapistAuraErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "session_expired"
  | "unavailable";

export class TherapistAuraError extends Error {
  constructor(readonly code: TherapistAuraErrorCode) {
    super(code);
    this.name = "TherapistAuraError";
  }
}

export function getTherapistAuraErrorMessage(code: TherapistAuraErrorCode) {
  const messages: Record<TherapistAuraErrorCode, string> = {
    forbidden:
      "O Assistente Aura está disponível para terapeutas Premium Plus com conta ativa.",
    invalid_contract:
      "Não foi possível concluir esta leitura agora. Tente novamente em instantes.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    unavailable:
      "Não foi possível consultar os sinais da Aura agora. Tente novamente em instantes.",
  };

  return messages[code];
}
