import type { TherapistAuthFieldErrors } from "./types";

export type TherapistAuthApiError = {
  fieldErrors?: TherapistAuthFieldErrors;
  message: string;
};

export const THERAPIST_AUTH_CONFIG_ERROR =
  "Cadastro de terapeutas temporariamente indisponivel. Tente novamente em instantes.";

export const THERAPIST_AUTH_GENERIC_ERROR =
  "Nao foi possivel concluir a solicitacao agora. Revise os dados e tente novamente.";

export const THERAPIST_AUTH_ROLE_ERROR =
  "Use o acesso correspondente ao seu perfil.";

export function getSafeSignupError(status?: number) {
  if (status === 422) {
    return "Nao foi possivel criar esta conta. Verifique os dados informados.";
  }

  if (status === 409) {
    return "Nao foi possivel criar esta conta. Verifique se o e-mail ja esta em uso.";
  }

  return THERAPIST_AUTH_GENERIC_ERROR;
}
