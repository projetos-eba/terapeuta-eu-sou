export type TherapistFinanceErrorCode =
  | "forbidden"
  | "invalid_contract"
  | "session_expired"
  | "unavailable"
  | "validation_error";

export class TherapistFinanceError extends Error {
  constructor(readonly code: TherapistFinanceErrorCode) {
    super(code);
  }
}

export function getTherapistFinanceErrorMessage(
  code: TherapistFinanceErrorCode,
) {
  switch (code) {
    case "forbidden":
      return "Use uma conta de terapeuta ativa para acessar seu financeiro.";
    case "invalid_contract":
      return "Os dados financeiros retornaram em um formato inesperado.";
    case "session_expired":
      return "Sua sessão expirou. Entre novamente para continuar.";
    case "validation_error":
      return "Revise os filtros financeiros e tente novamente.";
    case "unavailable":
    default:
      return "Não foi possível consultar seu financeiro agora. Tente novamente em alguns instantes.";
  }
}
