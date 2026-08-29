export function mapCheckoutError(error: { code?: string; status: number }) {
  if (error.status === 409 && error.code === "patient_schedule_conflict") {
    return {
      code: "PATIENT_SCHEDULE_CONFLICT",
      message:
        "Você já tem outro encontro nesse horário. Escolha outro momento.",
    };
  }
  if (error.status === 401) {
    return {
      code: "UNAUTHENTICATED",
      message: "Entre na sua conta de cliente para continuar.",
    };
  }
  if (error.status === 403) {
    return {
      code: "FORBIDDEN",
      message: "Use o acesso correspondente ao seu perfil.",
    };
  }
  if (error.status === 409) {
    return {
      code: "SLOT_CONFLICT",
      message: "Este horário não está mais disponível. Escolha outro momento.",
    };
  }
  if (error.status === 422) {
    return { code: "INVALID_REQUEST", message: "Revise os dados da reserva." };
  }
  if (error.status === 428) {
    return {
      code: "LEGAL_DOCUMENTS_REQUIRED",
      message: "Não foi possível iniciar a reserva agora.",
    };
  }
  if (error.status === 503) {
    return {
      code: "STRIPE_CONFIGURATION_ERROR",
      message:
        "O pagamento está temporariamente indisponível. Tente novamente.",
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "Não conseguimos iniciar o pagamento agora.",
  };
}
