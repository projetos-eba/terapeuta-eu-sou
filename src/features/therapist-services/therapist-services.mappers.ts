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
import { TherapistPlan } from "@/domain/tes";

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
  const currentPlan = plan(value.plan);
  return {
    contractVersion: literalOne(value.contractVersion),
    items: array(value.items).map((item) =>
      mapTherapistServiceSummary(item, currentPlan),
    ),
    plan: currentPlan,
    serviceLimit: nullableNumber(value.serviceLimit),
    therapistProfileId: string(value.therapistProfileId),
  };
}

export function mapTherapistServiceMutationResult(
  input: unknown,
  currentPlan: TherapistPlan = TherapistPlan.Free,
): TherapistServiceMutationResult {
  const value = record(input);

  return {
    contractVersion: literalOne(value.contractVersion),
    idempotentReplay: boolean(value.idempotentReplay),
    service: mapTherapistServiceSummary(value.service, currentPlan),
  };
}

export function mapTherapistServiceSummary(
  input: unknown,
  currentPlan?: TherapistPlan,
): TherapistServiceSummary {
  const value = record(input);
  const therapy = record(value.therapy);
  const metrics = record(value.metrics);
  const matching = optionalRecord(value.matching);

  return {
    archivedAt: nullableString(value.archivedAt),
    blockingReason: nullableString(value.blockingReason),
    createdAt: string(value.createdAt),
    currency: currency(value.currency),
    deliveryFormat: deliveryFormat(value.deliveryFormat),
    description: nullableString(value.description),
    durationMinutes: number(value.durationMinutes),
    isBookable: boolean(value.isBookable),
    isReservable: boolean(value.isReservable),
    metrics:
      currentPlan === TherapistPlan.Free
        ? {
            bookingCount: 0,
            bookingCountDeltaPercent: null,
            bookingsLast30Days: 0,
          }
        : {
            bookingCount: number(metrics.bookingCount),
            bookingCountDeltaPercent: nullableNumber(
              metrics.bookingCountDeltaPercent,
            ),
            bookingsLast30Days: number(metrics.bookingsLast30Days),
          },
    matching: {
      interestIds: stringArray(matching?.interestIds),
      themeIds: stringArray(matching?.themeIds),
    },
    onlineOnly: boolean(value.onlineOnly),
    position: number(value.position),
    priceCents: number(value.priceCents),
    serviceId: string(value.serviceId),
    status: parseTherapistServiceStatus(value.status),
    therapy: {
      id: string(therapy.id),
      imageUrl: optionalNullableString(therapy.imageUrl),
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

  return {
    isAvailableForServices: boolean(value.isAvailableForServices),
    isPubliclyVisible: boolean(value.isPubliclyVisible),
    isVisibleInMatching: boolean(value.isVisibleInMatching),
    imageUrl: optionalNullableString(value.imageUrl),
    matchingThemes: optionalArray(value.matchingThemes).map(mapMatchingTheme),
    name: string(value.name),
    shortDescription: string(value.shortDescription),
    slug: string(value.slug),
    status: parsePlatformTherapyStatus(value.status),
    therapyId: string(value.therapyId),
  };
}

function mapMatchingTheme(input: unknown): TherapyCatalogOption["matchingThemes"][number] {
  const value = record(input);

  return {
    id: string(value.id),
    interests: array(value.interests).map((item) => {
      const interest = record(item);

      return {
        id: string(interest.id),
        name: string(interest.name),
        slug: string(interest.slug),
        sortOrder: number(interest.sortOrder),
        themeId: string(interest.themeId),
      };
    }),
    name: string(value.name),
    slug: string(value.slug),
    sortOrder: number(value.sortOrder),
  };
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid array.");
  return value;
}

function optionalArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return array(value);
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

function optionalNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
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

function optionalRecord(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  return record(value);
}

function string(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid string.");
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
