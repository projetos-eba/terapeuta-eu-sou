import type {
  TherapistPrivateIdentityDocumentType,
  TherapistPrivateIdentityFields,
  TherapistSettingsUpdatePayload,
} from "./therapist-settings.types";

export class TherapistSettingsContractError extends Error {
  readonly reason: string;

  constructor(reason = "invalid_payload") {
    super(reason);
    this.name = "TherapistSettingsContractError";
    this.reason = reason;
  }
}

export function parseTherapistSettingsUpdatePayload(
  input: unknown,
): TherapistSettingsUpdatePayload {
  const value = object(input);
  const payload: TherapistSettingsUpdatePayload = {
    displayName: boundedString(value.displayName, 2, 120),
    phone: optionalPhone(value.phone),
  };

  if (value.identity !== undefined) {
    payload.identity = parsePrivateIdentity(value.identity);
  }

  return payload;
}

export function normalizeDocumentNumber(
  value: string,
  documentType: TherapistPrivateIdentityDocumentType,
) {
  const compact = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (documentType === "cpf" || documentType === "rg") {
    return compact.replace(/[^0-9]/g, "");
  }
  return compact;
}

export function formatDocumentNumber(
  value: string,
  documentType: TherapistPrivateIdentityDocumentType,
) {
  const compact = normalizeDocumentNumber(value, documentType);
  if (documentType === "cpf") {
    return compact
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  if (documentType === "rg" && compact.length <= 9) {
    return compact
      .slice(0, 9)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return compact.slice(0, 20);
}

export function formatPostalCode(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

function parsePrivateIdentity(input: unknown): TherapistPrivateIdentityFields {
  const value = object(input);
  const documentType = parseDocumentType(value.documentType);
  const documentNumber = normalizeDocumentNumber(
    boundedString(value.documentNumber, 6, 20),
    documentType,
  );
  if (documentType === "cpf" && !isValidCpf(documentNumber)) {
    throw invalid("cpf_invalid");
  }
  if (documentType === "rg" && !/^[0-9]{7,14}$/.test(documentNumber)) {
    throw invalid("document_number");
  }
  if (documentType === "passport" && !/^[A-Z0-9]{6,9}$/.test(documentNumber)) {
    throw invalid("document_number");
  }

  const postalCode = value.postalCode;
  if (typeof postalCode !== "string" || !/^\d{5}-?\d{3}$/.test(postalCode)) {
    throw invalid("postal_code");
  }

  return {
    city: boundedString(value.city, 2, 100),
    complement: optionalBoundedString(value.complement, 100),
    documentNumber,
    documentType,
    neighborhood: boundedString(value.neighborhood, 2, 100),
    postalCode: postalCode.replace(/\D/g, ""),
    state: boundedString(value.state, 2, 2).toUpperCase(),
    street: boundedString(value.street, 2, 160),
    streetNumber: boundedString(value.streetNumber, 1, 20),
  };
}

function parseDocumentType(
  value: unknown,
): TherapistPrivateIdentityDocumentType {
  if (value === "cpf" || value === "rg" || value === "passport") return value;
  throw invalid("document_type");
}

function optionalBoundedString(value: unknown, max: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw invalid("string");
  const normalized = value.trim();
  if (normalized.length > max) throw invalid("string_length");
  return normalized;
}

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const calculate = (length: number) => {
    const sum = digits.slice(0, length).reduce((total, digit, index) => {
      return total + digit * (length + 1 - index);
    }, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === digits[9] && calculate(10) === digits[10];
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
