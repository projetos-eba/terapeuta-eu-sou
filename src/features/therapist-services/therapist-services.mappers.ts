import {
  parsePlatformTherapyStatus,
  parseTherapistServiceStatus,
} from "./therapist-services.parsers";
import {
  therapistServiceDeliveryFormats,
  type TherapistServiceDeliveryFormat,
  type TherapistServiceMutationResult,
  type TherapistServiceSummary,
  type TherapistServicesContract,
  type TherapyCatalogContract,
  type TherapyCatalogOption,
} from "./therapist-services.types";

export function mapTherapyCatalogContract(
  input: unknown,
): TherapyCatalogContract {
  const value = record(input);
  return {
    contractVersion: literalOne(value.contractVersion),
    items: array(value.items).map(mapTherapyCatalogOption),
    plan: plan(value.plan),
    serviceLimit: nullableNumber(value.serviceLimit),
    therapistProfileId: string(value.therapistProfileId),
  };
}

export function mapTherapistServicesContract(
  input: unknown,
): TherapistServicesContract {
  const value = record(input);
  return {
    contractVersion: literalOne(value.contractVersion),
    items: array(value.items).map(mapTherapistServiceSummary),
    plan: plan(value.plan),
    serviceLimit: nullableNumber(value.serviceLimit),
    therapistProfileId: string(value.therapistProfileId),
  };
}

export function mapTherapistServiceMutationResult(
  input: unknown,
): TherapistServiceMutationResult {
  const value = record(input);

  return {
    contractVersion: literalOne(value.contractVersion),
    idempotentReplay: boolean(value.idempotentReplay),
    service: mapTherapistServiceSummary(value.service),
  };
}

export function mapTherapistServiceSummary(
  input: unknown,
): TherapistServiceSummary {
  const value = record(input);
  const therapy = record(value.therapy);
  const category = record(value.category);
  const metrics = record(value.metrics);

  return {
    archivedAt: nullableString(value.archivedAt),
    blockingReason: nullableString(value.blockingReason),
    category: {
      id: string(category.id),
      name: string(category.name),
      slug: string(category.slug),
    },
    createdAt: string(value.createdAt),
    currency: currency(value.currency),
    deliveryFormat: deliveryFormat(value.deliveryFormat),
    description: nullableString(value.description),
    durationMinutes: number(value.durationMinutes),
    isBookable: boolean(value.isBookable),
    isReservable: boolean(value.isReservable),
    metrics: {
      bookingCount: number(metrics.bookingCount),
      bookingCountDeltaPercent: nullableNumber(
        metrics.bookingCountDeltaPercent,
      ),
      bookingsLast30Days: number(metrics.bookingsLast30Days),
    },
    onlineOnly: boolean(value.onlineOnly),
    position: number(value.position),
    priceCents: number(value.priceCents),
    serviceId: string(value.serviceId),
    status: parseTherapistServiceStatus(value.status),
    therapy: {
      id: string(therapy.id),
      isAvailableForServices: boolean(therapy.isAvailableForServices),
      isPubliclyVisible: boolean(therapy.isPubliclyVisible),
      name: string(therapy.name),
      slug: string(therapy.slug),
      status: parsePlatformTherapyStatus(therapy.status),
    },
    therapyId: string(value.therapyId),
    title: string(value.title),
    updatedAt: string(value.updatedAt),
    version: number(value.version),
  };
}

function mapTherapyCatalogOption(input: unknown): TherapyCatalogOption {
  const value = record(input);
  const category = record(value.category);

  return {
    category: {
      id: string(category.id),
      name: string(category.name),
      slug: string(category.slug),
    },
    isAvailableForServices: boolean(value.isAvailableForServices),
    isPubliclyVisible: boolean(value.isPubliclyVisible),
    isVisibleInMatching: boolean(value.isVisibleInMatching),
    name: string(value.name),
    shortDescription: string(value.shortDescription),
    slug: string(value.slug),
    status: parsePlatformTherapyStatus(value.status),
    therapyId: string(value.therapyId),
  };
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid array.");
  return value;
}

function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid boolean.");
  return value;
}

function currency(value: unknown): "BRL" {
  if (value !== "BRL") throw new Error("Invalid currency.");
  return value;
}

function deliveryFormat(value: unknown): TherapistServiceDeliveryFormat {
  if (
    typeof value !== "string" ||
    !therapistServiceDeliveryFormats.includes(
      value as TherapistServiceDeliveryFormat,
    )
  ) {
    throw new Error("Invalid delivery format.");
  }
  return value as TherapistServiceDeliveryFormat;
}

function literalOne(value: unknown): 1 {
  if (value !== 1) throw new Error("Invalid contract version.");
  return 1;
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  return number(value);
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return string(value);
}

function number(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid number.");
  }
  return value;
}

function plan(value: unknown): "free" | "premium" | "premium_plus" {
  if (value !== "free" && value !== "premium" && value !== "premium_plus") {
    throw new Error("Invalid plan.");
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid record.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid string.");
  return value;
}
