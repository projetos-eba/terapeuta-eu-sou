import type { AdminAuthFieldErrors, AdminLoginValue } from "./types";

export function validateAdminLogin(
  input: AdminLoginValue,
):
  | { ok: true; value: AdminLoginValue }
  | { fieldErrors: AdminAuthFieldErrors; ok: false } {
  const fieldErrors: AdminAuthFieldErrors = {};
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Informe um e-mail valido.";
  }

  if (!password || password.length < 8) {
    fieldErrors.password = "Informe a senha administrativa.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, ok: false };
  }

  return { ok: true, value: { email, password } };
}
