import type {
  AdminMatchingContract,
  AdminMatchingEvent,
  AdminMatchingInterest,
  AdminMatchingTheme,
} from "./admin-matching.types";

export class AdminMatchingContractError extends Error {
  constructor(message = "Invalid admin matching contract.") {
    super(message);
  }
}

export function parseAdminMatchingContract(value: unknown): AdminMatchingContract {
  const record = asRecord(value);
  if (record.contractVersion !== 1) invalid();

  return {
    contractVersion: 1,
    themes: parseArray(record.themes, parseTheme),
  };
}

function parseTheme(value: unknown): AdminMatchingTheme {
  const record = asRecord(value);

  return {
    createdAt: asString(record.createdAt),
    description: asString(record.description),
    history: parseArray(record.history, parseEvent),
    id: asString(record.id),
    imageUrl: asNullableString(record.imageUrl),
    interests: parseArray(record.interests, parseInterest),
    isActive: asBoolean(record.isActive),
    name: asString(record.name),
    serviceCount: asNumber(record.serviceCount),
    slug: asString(record.slug),
    sortOrder: asNumber(record.sortOrder),
    therapyCount: asNumber(record.therapyCount),
    updatedAt: asString(record.updatedAt),
  };
}

function parseInterest(value: unknown): AdminMatchingInterest {
  const record = asRecord(value);

  return {
    createdAt: asString(record.createdAt),
    history: parseArray(record.history, parseEvent),
    id: asString(record.id),
    isActive: asBoolean(record.isActive),
    name: asString(record.name),
    serviceCount: asNumber(record.serviceCount),
    slug: asString(record.slug),
    sortOrder: asNumber(record.sortOrder),
    themeId: asString(record.themeId),
    updatedAt: asString(record.updatedAt),
  };
}

function parseEvent(value: unknown): AdminMatchingEvent {
  const record = asRecord(value);

  return {
    actorProfileId: asNullableString(record.actorProfileId),
    createdAt: asString(record.createdAt),
    eventType: asString(record.eventType),
    id: asString(record.id),
    reason: asNullableString(record.reason),
  };
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(parser);
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
  throw new AdminMatchingContractError();
}
