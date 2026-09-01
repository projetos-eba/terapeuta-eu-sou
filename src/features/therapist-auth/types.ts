import type { TherapistPlan } from "@/domain/tes";

export type TherapistAuthField =
  | "fullName"
  | "email"
  | "phone"
  | "birthDate"
  | "password"
  | "confirmPassword"
  | "termsAccepted"
  | "plan";

export type TherapistSignupInput = {
  birthDate: string;
  confirmPassword: string;
  email: string;
  fullName: string;
  password: string;
  phone: string;
  phoneCountryCode?: string;
  plan?: string | null;
  termsAccepted: boolean;
};

export type TherapistLoginInput = {
  email: string;
  password: string;
};

export type TherapistSignupValue = Omit<
  TherapistSignupInput,
  "plan" | "termsAccepted"
> & {
  email: string;
  fullName: string;
  phoneDigits: string;
  phoneCountryCode: string;
  plan: TherapistPlan;
  termsAccepted: true;
};

export type TherapistLoginValue = {
  email: string;
  password: string;
};

export type TherapistAuthFieldErrors = Partial<
  Record<TherapistAuthField, string>
>;

export type TherapistAuthValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      fieldErrors: TherapistAuthFieldErrors;
      formError?: string;
    };
