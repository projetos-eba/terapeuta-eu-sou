import {
  adminTherapyStatuses,
  type AdminTherapy,
  type AdminTherapyCatalogContract,
  type AdminTherapyCatalogRequest,
  type AdminTherapyCategory,
  type AdminTherapyImpact,
  type AdminTherapyPublicContent,
  type AdminTherapyStatus,
} from "./admin-therapy-catalog.types";

export class AdminTherapyCatalogContractError extends Error {
  constructor(message = "Invalid admin therapy catalog contract.") {
    super(message);
  }
}

export function parseAdminTherapyCatalogContract(
  value: unknown,
): AdminTherapyCatalogContract {
  const record = asRecord(value);
  if (record.contractVersion !== 1) invalid();

  return {
    categories: parseArray(record.categories, parseCategory),
    contractVersion: 1,
    items: parseArray(record.items, parseTherapy),
    requests: parseArray(record.requests, parseRequest),
  };
}

function parseCategory(value: unknown): AdminTherapyCategory {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    isActive: asBoolean(record.isActive),
    name: asString(record.name),
    slug: asString(record.slug),
    sortOrder: asNumber(record.sortOrder),
  };
}

function parseTherapy(value: unknown): AdminTherapy {
  const record = asRecord(value);
  const status = asString(record.status);

  if (!adminTherapyStatuses.includes(status as AdminTherapyStatus)) {
    invalid();
  }

  return {
    aliases: parseStringArray(record.aliases),
    archivedAt: asNullableString(record.archivedAt),
    calendarColorKey: asString(record.calendarColorKey) || "neutral",
    categoryId: asString(record.categoryId),
    categoryIsActive: asBoolean(record.categoryIsActive),
    categoryName: asString(record.categoryName),
    categorySlug: asString(record.categorySlug),
    deprecatedAt: asNullableString(record.deprecatedAt),
    description: asNullableString(record.description),
    hasPublishedMatchWeights: asBoolean(record.hasPublishedMatchWeights),
    history: parseArray(record.history, (item) => {
      const row = asRecord(item);
      return {
        actorProfileId: asNullableString(row.actorProfileId),
        createdAt: asString(row.createdAt),
        eventType: asString(row.eventType),
        id: asString(row.id),
        reason: asNullableString(row.reason),
      };
    }),
    id: asString(record.id),
    imageUrl: asNullableString(record.imageUrl),
    impact: parseImpact(record.impact),
    isAvailableForServices: asBoolean(record.isAvailableForServices),
    isFeatured: asBoolean(record.isFeatured),
    isPubliclyVisible: asBoolean(record.isPubliclyVisible),
    isVisibleInMatching: asBoolean(record.isVisibleInMatching),
    name: asString(record.name),
    publicContent: parsePublicContent(record.publicContent),
    publishedAt: asNullableString(record.publishedAt),
    replacementTherapyId: asNullableString(record.replacementTherapyId),
    shortDescription: asString(record.shortDescription),
    slug: asString(record.slug),
    status: status as AdminTherapyStatus,
    updatedAt: asString(record.updatedAt),
  };
}

function parseImpact(value: unknown): AdminTherapyImpact {
  const record = asRecord(value);

  return {
    activeServiceCount: asNumber(record.activeServiceCount),
    futureBookingCount: asNumber(record.futureBookingCount),
    isAvailableForServices: asBoolean(record.isAvailableForServices),
    isPubliclyVisible: asBoolean(record.isPubliclyVisible),
    isVisibleInMatching: asBoolean(record.isVisibleInMatching),
    publicProfileCount: asNumber(record.publicProfileCount),
    serviceCount: asNumber(record.serviceCount),
    therapistCount: asNumber(record.therapistCount),
  };
}

function parsePublicContent(value: unknown): AdminTherapyPublicContent {
  const record = asRecord(value);

  return {
    approachIconKey: asNullableString(record.approachIconKey),
    approachLabel: asNullableString(record.approachLabel),
    benefits: parseArray(record.benefits, (item) => {
      const row = asRecord(item);
      return {
        description: asNullableString(row.description),
        iconKey: asString(row.iconKey) || "sparkles",
        title: asString(row.title),
      };
    }),
    complementaryDescription: asNullableString(record.complementaryDescription),
    faqs: parseArray(record.faqs, (item) => {
      const row = asRecord(item);
      return {
        answer: asString(row.answer),
        question: asString(row.question),
      };
    }),
    heroFocalPoint: parseFocalPoint(record.heroFocalPoint),
    heroImageUrl: asNullableString(record.heroImageUrl),
    highlights: parseArray(record.highlights, (item) => {
      const row = asRecord(item);
      return {
        iconKey: asString(row.iconKey) || "sparkles",
        title: asString(row.title),
      };
    }),
    introduction: asNullableString(record.introduction),
    safetyNote: asNullableString(record.safetyNote),
    seoDescription: asNullableString(record.seoDescription),
    seoTitle: asNullableString(record.seoTitle),
    subtitle: asNullableString(record.subtitle),
    visualThemeKey: parseVisualTheme(record.visualThemeKey),
  };
}

function parseRequest(value: unknown): AdminTherapyCatalogRequest {
  const record = asRecord(value);

  return {
    createdAt: asString(record.createdAt),
    decision: asNullableString(record.decision),
    description: asNullableString(record.description),
    id: asString(record.id),
    informedName: asString(record.informedName),
    justification: asNullableString(record.justification),
    relatedTherapyId: asNullableString(record.relatedTherapyId),
    status: asString(record.status) as AdminTherapyCatalogRequest["status"],
  };
}

function parseFocalPoint(
  value: unknown,
): AdminTherapyPublicContent["heroFocalPoint"] {
  if (value === "left" || value === "right") return value;
  return "center";
}

function parseVisualTheme(
  value: unknown,
): AdminTherapyPublicContent["visualThemeKey"] {
  if (value === "oracle" || value === "systemic") return value;
  return "energy";
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parser);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function invalid(): never {
  throw new AdminTherapyCatalogContractError();
}
