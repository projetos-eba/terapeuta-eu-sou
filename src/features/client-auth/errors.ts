import type { ClientAuthFieldErrors } from "./types";

export type ClientAuthApiError = {
  fieldErrors?: ClientAuthFieldErrors;
  message: string;
};

export const CLIENT_AUTH_CONFIG_ERROR =
  "Cadastro de clientes temporariamente indisponivel. Tente novamente em instantes.";

export const CLIENT_AUTH_GENERIC_ERROR =
  "Nao foi possivel concluir a solicitacao agora. Revise os dados e tente novamente.";

export const CLIENT_AUTH_ROLE_ERROR =
  "Use o acesso correspondente ao seu perfil.";

export function getSafeClientSignupError(status?: number) {
  if (status === 422) {
    return "Nao foi possivel criar esta conta. Verifique os dados informados.";
  }

  if (status === 409) {
    return "Nao foi possivel criar esta conta. Verifique se o e-mail ja esta em uso.";
  }

  return CLIENT_AUTH_GENERIC_ERROR;
}
