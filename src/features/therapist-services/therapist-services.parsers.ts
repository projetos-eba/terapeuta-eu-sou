import {
  platformTherapyStatuses,
  therapistServiceDeliveryFormats,
  therapistServiceStatuses,
  type PlatformTherapyStatus,
  type TherapistServicesCommand,
  type TherapistServiceDeliveryFormat,
  type TherapistServiceStatus,
} from "./therapist-services.types";
import {
  THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH,
  THERAPIST_SERVICE_DURATION_MAX_MINUTES,
  THERAPIST_SERVICE_DURATION_MIN_MINUTES,
} from "./therapist-services.constants";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TherapistServicesContractError extends Error {
  constructor(readonly code = "invalid_payload") {
    super("Therapist services payload does not match contract v1.");
  }
}

export function parseTherapistServicesCommand(
  input: unknown,
): TherapistServicesCommand {
  const value = record(input);
  const action = string(value.action);

  if (action === "catalog" || action === "list") {
    return { action };
  }

  if (action === "create") {
    return {
      action,
      currency: optionalCurrency(value.currency),
      deliveryFormat: optionalDeliveryFormat(value.deliveryFormat),
      description: optionalNullableString(
        value.description,
        THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH,
      ),
      durationMinutes: boundedInteger(
        value.durationMinutes,
        THERAPIST_SERVICE_DURATION_MIN_MINUTES,
        THERAPIST_SERVICE_DURATION_MAX_MINUTES,
      ),
      interestIds: uuidArray(value.interestIds, 0, 9),
      priceCents: boundedInteger(value.priceCents, 1000, 2000000),
      requestId: uuid(value.requestId),
      themeIds: uuidArray(value.themeIds, 1, 3),
      therapyId: uuid(value.therapyId),
      title: boundedString(value.title, 1, 120),
    };
  }

  if (action === "update") {
    return {
      action,
      currency: optionalCurrency(value.currency),
      deliveryFormat: optionalDeliveryFormat(value.deliveryFormat),
      description: optionalNullableString(
        value.description,
        THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH,
      ),
      durationMinutes: optionalInteger(
        value.durationMinutes,
        THERAPIST_SERVICE_DURATION_MIN_MINUTES,
        THERAPIST_SERVICE_DURATION_MAX_MINUTES,
      ),
      expectedVersion: boundedInteger(value.expectedVersion, 1, 999999999),
      interestIds:
        value.interestIds === undefined
          ? undefined
          : uuidArray(value.interestIds, 0, 9),
      isBookable: optionalBoolean(value.isBookable),
      priceCents: optionalInteger(value.priceCents, 0, 2000000),
      requestId: uuid(value.requestId),
      serviceId: uuid(value.serviceId),
      themeIds:
        value.themeIds === undefined
          ? undefined
          : uuidArray(value.themeIds, 1, 3),
      therapyId:
        value.therapyId === undefined ? undefined : uuid(value.therapyId),
      title:
        value.title === undefined
          ? undefined
          : boundedString(value.title, 1, 120),
    };
  }

  if (action === "activate" || action === "pause" || action === "archive") {
    return {
      action,
      expectedVersion: boundedInteger(value.expectedVersion, 1, 999999999),
      requestId: uuid(value.requestId),
      serviceId: uuid(value.serviceId),
    };
  }

  if (action === "reorder") {
    const serviceIds = array(value.serviceIds).map(uuid);
    if (serviceIds.length === 0 || serviceIds.length > 100) invalid();
    if (new Set(serviceIds).size !== serviceIds.length) invalid();

    return {
      action,
      requestId: uuid(value.requestId),
      serviceIds,
    };
  }

  invalid();
}

export function parseTherapistServiceStatus(
  value: unknown,
): TherapistServiceStatus {
  const candidate = string(value);
  if (!therapistServiceStatuses.includes(candidate as TherapistServiceStatus)) {
    invalid();
  }
  return candidate as TherapistServiceStatus;
}

export function parsePlatformTherapyStatus(
  value: unknown,
): PlatformTherapyStatus {
  const candidate = string(value);
  if (!platformTherapyStatuses.includes(candidate as PlatformTherapyStatus)) {
    invalid();
  }
  return candidate as PlatformTherapyStatus;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalid();
  return value;
}

function boundedInteger(value: unknown, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    invalid();
  }
  return Number(value);
}

function boundedString(value: unknown, min: number, max: number) {
  const result = string(value).trim();
  if (result.length < min || result.length > max) invalid();
  return result;
}

function invalid(): never {
  throw new TherapistServicesContractError();
}

function optionalBoolean(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") invalid();
  return value;
}

function optionalCurrency(value: unknown) {
  if (value === undefined) return undefined;
  if (value !== "BRL") invalid();
  return value;
}

function optionalDeliveryFormat(
  value: unknown,
): TherapistServiceDeliveryFormat | undefined {
  if (value === undefined) return undefined;
  const candidate = string(value);
  if (
    !therapistServiceDeliveryFormats.includes(
      candidate as TherapistServiceDeliveryFormat,
    )
  ) {
    invalid();
  }
  return candidate as TherapistServiceDeliveryFormat;
}

function optionalInteger(value: unknown, min: number, max: number) {
  if (value === undefined) return undefined;
  return boundedInteger(value, min, max);
}

function optionalNullableString(
  value: unknown,
  max: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const result = string(value).trim();
  if (result.length > max) invalid();
  return result.length ? result : null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function uuid(value: unknown): string {
  const result = string(value);
  if (!UUID.test(result)) invalid();
  return result;
}

function uuidArray(value: unknown, min: number, max: number): string[] {
  const items = array(value).map(uuid);
  if (items.length < min || items.length > max) invalid();
  if (new Set(items).size !== items.length) invalid();
  return items;
}
