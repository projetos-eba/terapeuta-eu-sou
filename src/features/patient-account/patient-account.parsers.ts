import type {
  PatientAccountEditableFields,
  PatientAddress,
} from "./patient-account.types";

export class PatientAccountContractError extends Error {
  constructor(message = "Invalid patient account payload.") {
    super(message);
    this.name = "PatientAccountContractError";
  }
}

export function parsePatientAccountUpdatePayload(
  input: unknown,
): PatientAccountEditableFields {
  const value = object(input);
  return {
    address: parseAddress(value.address),
    name: boundedString(value.name, 2, 120),
    phone: optionalPhone(value.phone),
  };
}

export function formatPatientPostalCode(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

function parseAddress(input: unknown): PatientAddress {
  const value = object(input);
  const address = {
    city: optionalBoundedString(value.city, 100),
    complement: optionalBoundedString(value.complement, 100),
    neighborhood: optionalBoundedString(value.neighborhood, 100),
    postalCode: compactPostalCode(optionalBoundedString(value.postalCode, 9)),
    state: optionalBoundedString(value.state, 2).toUpperCase(),
    street: optionalBoundedString(value.street, 160),
    streetNumber: optionalBoundedString(value.streetNumber, 20),
  };

  if (address.postalCode && !/^\d{8}$/.test(address.postalCode)) {
    throw invalid("postal_code");
  }
  if (address.state && !/^[A-Z]{2}$/.test(address.state)) {
    throw invalid("state");
  }

  return address;
}

function compactPostalCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
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

function optionalBoundedString(value: unknown, max: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw invalid("string");
  const normalized = value.trim();
  if (normalized.length > max) throw invalid("string_length");
  return normalized;
}

function boundedString(value: unknown, min: number, max: number) {
  if (typeof value !== "string") throw invalid("string");
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw invalid("string_length");
  }
  return normalized;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("object");
  }
  return value as Record<string, unknown>;
}

function invalid(reason: string) {
  return new PatientAccountContractError(reason);
}
