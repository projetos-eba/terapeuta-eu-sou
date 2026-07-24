import type { TherapistAuthFieldErrors } from "./types";

export type TherapistAuthApiError = {
  fieldErrors?: TherapistAuthFieldErrors;
  message: string;
};

export const THERAPIST_AUTH_CONFIG_ERROR =
  "Cadastro de terapeutas temporariamente indisponível. Tente novamente em instantes.";

export const THERAPIST_AUTH_GENERIC_ERROR =
  "Não foi possível concluir a solicitação agora. Revise os dados e tente novamente.";

export const THERAPIST_AUTH_ROLE_ERROR =
  "Use o acesso correspondente ao seu perfil.";

export function getSafeSignupError(status?: number) {
  if (status === 422) {
    return "Não foi possível criar esta conta. Verifique os dados informados.";
  }

  if (status === 409) {
    return "Não foi possível criar esta conta. Verifique se o e-mail já está em uso.";
  }

  return THERAPIST_AUTH_GENERIC_ERROR;
}
