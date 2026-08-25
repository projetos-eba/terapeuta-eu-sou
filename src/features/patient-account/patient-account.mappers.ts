import { emptyPatientAddress, type PatientAddress } from "./patient-account.types";

export function mapPatientAddress(value: unknown): PatientAddress {
  const record = object(value);
  return {
    city: stringOr(record.city),
    complement: stringOr(record.complement),
    neighborhood: stringOr(record.neighborhood),
    postalCode: stringOr(record.postalCode),
    state: stringOr(record.state).toUpperCase(),
    street: stringOr(record.street),
    streetNumber: stringOr(record.streetNumber),
  };
}

export function getPatientAddressFromMetadata(value: unknown): PatientAddress {
  const metadata = object(value);
  const account = object(metadata.account);
  return mapPatientAddress(account.address);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOr(value: unknown) {
  return typeof value === "string" ? value : "";
}

export { emptyPatientAddress };
