import { TherapistPlan } from "@/domain/tes";

import type {
  TherapistAuthValidationResult,
  TherapistLoginInput,
  TherapistLoginValue,
  TherapistSignupInput,
  TherapistSignupValue,
} from "./types";
import { validatePhoneNumber } from "@/lib/phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 18;

export function normalizeTherapistPlan(value?: string | null) {
  if (
    value === TherapistPlan.Free ||
    value === TherapistPlan.Premium ||
    value === TherapistPlan.PremiumPlus
  ) {
    return value;
  }

  return TherapistPlan.Free;
}

export function getTherapistPlanLabel(plan: TherapistPlan) {
  const labels: Record<TherapistPlan, string> = {
    [TherapistPlan.Free]: "Free",
    [TherapistPlan.Premium]: "Premium",
    [TherapistPlan.PremiumPlus]: "Premium Plus",
  };

  return labels[plan];
}

export function validateTherapistSignup(
  input: TherapistSignupInput,
  now = new Date(),
): TherapistAuthValidationResult<TherapistSignupValue> {
  const fieldErrors: Record<string, string> = {};
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  const phoneDigits = input.phone.replace(/\D/g, "");
  const phoneCountryCode = input.phoneCountryCode || "55";
  const birthDate = input.birthDate.trim();
  const plan = normalizeTherapistPlan(input.plan);

  if (fullName.length < 3) {
    fieldErrors.fullName = "Informe seu nome completo.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Informe um e-mail válido.";
  }

  const phoneError = validatePhoneNumber(phoneCountryCode, phoneDigits, true);
  if (phoneError) fieldErrors.phone = phoneError;

  if (!birthDate) {
    fieldErrors.birthDate = "Informe sua data de nascimento.";
  } else if (!isAtLeastAge(birthDate, MIN_AGE, now)) {
    fieldErrors.birthDate =
      "Cadastro permitido apenas para maiores de 18 anos.";
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = "Use pelo menos 8 caracteres.";
  }

  if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "As senhas precisam ser iguais.";
  }

  if (!input.termsAccepted) {
    fieldErrors.termsAccepted =
      "Você precisa aceitar os termos e a política de privacidade.";
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
      fullName,
      phoneDigits,
      phoneCountryCode,
      plan,
      termsAccepted: true,
    },
  };
}

export function validateTherapistLogin(
  input: TherapistLoginInput,
): TherapistAuthValidationResult<TherapistLoginValue> {
  const fieldErrors: Record<string, string> = {};
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Informe um e-mail válido.";
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
