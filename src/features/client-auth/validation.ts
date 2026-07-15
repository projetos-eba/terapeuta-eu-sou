import type {
  ClientAuthValidationResult,
  ClientLoginInput,
  ClientLoginValue,
  ClientSignupInput,
  ClientSignupValue,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 18;

export function validateClientSignup(
  input: ClientSignupInput,
  now = new Date(),
): ClientAuthValidationResult<ClientSignupValue> {
  const fieldErrors: Record<string, string> = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const phoneDigits = input.phone.replace(/\D/g, "");
  const birthDate = input.birthDate.trim();

  if (name.length < 2) {
    fieldErrors.name = "Informe como podemos chamar voce.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Informe um e-mail valido.";
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    fieldErrors.phone = "Informe um celular com DDD.";
  }

  if (!birthDate) {
    fieldErrors.birthDate = "Informe sua data de nascimento.";
  } else if (!isAtLeastAge(birthDate, MIN_AGE, now)) {
    fieldErrors.birthDate = "Cadastro permitido apenas para maiores de 18 anos.";
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = "Use pelo menos 8 caracteres.";
  }

  if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "As senhas precisam ser iguais.";
  }

  if (!input.termsAccepted) {
    fieldErrors.termsAccepted =
      "Voce precisa aceitar os termos e a politica de privacidade.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      ...input,
      birthDate,
      email,
      name,
      phoneDigits,
      termsAccepted: true,
    },
  };
}

export function validateClientLogin(
  input: ClientLoginInput,
): ClientAuthValidationResult<ClientLoginValue> {
  const fieldErrors: Record<string, string> = {};
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Informe um e-mail valido.";
  }

  if (!input.password) {
    fieldErrors.password = "Informe sua senha.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      email,
      password: input.password,
    },
  };
}

function isAtLeastAge(dateValue: string, age: number, now: Date) {
  const birthDate = parseIsoDate(dateValue);

  if (!birthDate || birthDate > now) {
    return false;
  }

  const minimumBirthDate = new Date(
    now.getFullYear() - age,
    now.getMonth(),
    now.getDate(),
  );

  return birthDate <= minimumBirthDate;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
