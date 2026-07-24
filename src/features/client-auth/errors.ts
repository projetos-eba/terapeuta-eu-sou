import type { ClientAuthFieldErrors } from "./types";

export type ClientAuthApiError = {
  fieldErrors?: ClientAuthFieldErrors;
  message: string;
};

export const CLIENT_AUTH_CONFIG_ERROR =
  "Cadastro de clientes temporariamente indisponível. Tente novamente em instantes.";

export const CLIENT_AUTH_GENERIC_ERROR =
  "Não foi possível concluir a solicitação agora. Revise os dados e tente novamente.";

export const CLIENT_AUTH_ROLE_ERROR =
  "Use o acesso correspondente ao seu perfil.";

export function getSafeClientSignupError(status?: number) {
  if (status === 422) {
    return "Não foi possível criar esta conta. Verifique os dados informados.";
  }

  if (status === 409) {
    return "Não foi possível criar esta conta. Verifique se o e-mail já está em uso.";
  }

  return CLIENT_AUTH_GENERIC_ERROR;
}
