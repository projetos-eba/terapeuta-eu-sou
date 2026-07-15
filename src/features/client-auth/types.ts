export type ClientAuthField =
  | "name"
  | "email"
  | "phone"
  | "birthDate"
  | "password"
  | "confirmPassword"
  | "termsAccepted";

export type ClientSignupInput = {
  birthDate: string;
  confirmPassword: string;
  email: string;
  name: string;
  password: string;
  phone: string;
  termsAccepted: boolean;
};

export type ClientLoginInput = {
  email: string;
  password: string;
};

export type ClientSignupValue = Omit<ClientSignupInput, "termsAccepted"> & {
  email: string;
  name: string;
  phoneDigits: string;
  termsAccepted: true;
};

export type ClientLoginValue = {
  email: string;
  password: string;
};

export type ClientAuthFieldErrors = Partial<Record<ClientAuthField, string>>;

export type ClientAuthValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      fieldErrors: ClientAuthFieldErrors;
      formError?: string;
    };
