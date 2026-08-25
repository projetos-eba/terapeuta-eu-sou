export type TherapistAuraErrorCode =
  | "forbidden"
  | "invalid_recommendation"
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
      "A Assessora Aura está disponível para terapeutas Premium Plus com conta ativa.",
    invalid_recommendation:
      "A Aura não conseguiu confirmar esta recomendação nesta janela. Ela pode ter sido atualizada ou dispensada em outra sessão. Atualize a página para ver apenas recomendações válidas.",
    invalid_contract:
      "Não foi possível concluir esta leitura agora. Tente novamente em instantes.",
    session_expired: "Sua sessão expirou. Entre novamente para continuar.",
    unavailable:
      "Não foi possível consultar os sinais da Aura agora. Tente novamente em instantes.",
  };

  return messages[code];
}
