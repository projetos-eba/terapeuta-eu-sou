import { DomainError } from "../payments/http.ts";

export function requireUuid(value: unknown, code = "invalid_booking_id") {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError(code, 422, "Identificador invalido.");
  }

  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
