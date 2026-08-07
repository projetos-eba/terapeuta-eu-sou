import type { TherapistSettingsUpdatePayload } from "./therapist-settings.types";

export class TherapistSettingsContractError extends Error {
  constructor(message = "Invalid therapist settings payload.") {
    super(message);
    this.name = "TherapistSettingsContractError";
  }
}

export function parseTherapistSettingsUpdatePayload(
  input: unknown,
): TherapistSettingsUpdatePayload {
  const value = object(input);

  return {
    displayName: boundedString(value.displayName, 2, 120),
    phone: optionalPhone(value.phone),
  };
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw invalid("object");
  }
  return input as Record<string, unknown>;
}

function boundedString(value: unknown, min: number, max: number) {
  if (typeof value !== "string") throw invalid("string");
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw invalid("string_length");
  }
  return normalized;
}

function optionalPhone(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw invalid("phone");
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.length > 30 || !/^[+()0-9\s-]+$/.test(normalized)) {
    throw invalid("phone");
  }
  return normalized;
}

function invalid(reason: string) {
  return new TherapistSettingsContractError(reason);
}
