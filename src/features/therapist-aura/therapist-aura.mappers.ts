import { TherapistAuraError } from "./therapist-aura.errors";
import { auraActionRoutes } from "./therapist-aura.routes";
import { buildAuraRecommendations } from "./therapist-aura.rules";
import type {
  AuraActionRouteKey,
  AuraDismissal,
  AuraPersistedRecommendation,
  AuraSampledRate,
  TherapistAuraMeta,
  TherapistAuraPageData,
  TherapistAuraSignals,
} from "./therapist-aura.types";

export function mapTherapistAuraSignals(input: unknown): TherapistAuraPageData {
  try {
    const value = record(input);
    const meta = mapMeta(value.meta);
    const signals = mapSignals(value.signals);
    const dismissals = array(value.dismissals).map(mapDismissal);

    return {
      contractVersion: literal(value.contractVersion, 1),
      dismissals,
      meta,
      recommendations: [
        ...buildAuraRecommendations({ dismissals, meta, signals }),
        ...array(value.recommendations).map(mapPersistedRecommendation),
      ].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title)),
      ruleRegistryVersion: literal(value.ruleRegistryVersion, 1),
      signals,
      therapist: {
        plan: literal(record(value.therapist).plan, "premium_plus"),
        profileId: nonEmptyString(record(value.therapist).profileId),
      },
    };
  } catch (error) {
    if (error instanceof TherapistAuraError) throw error;
    throw new TherapistAuraError("invalid_contract");
  }
}

function mapSignals(input: unknown): TherapistAuraSignals {
  const value = record(input);
  const bookingReadiness = record(value.bookingReadiness);
  const reviews = record(value.reviews);
  const sessions = record(value.sessions);
  const continuity = record(value.continuity);

  return {
    bookingReadiness: {
      publicBookableServices: nonNegativeInteger(
        bookingReadiness.publicBookableServices,
      ),
      servicesWithFutureAvailability: nonNegativeInteger(
        bookingReadiness.servicesWithFutureAvailability,
      ),
      status: oneOf(bookingReadiness.status, "empty", "ready"),
      windowDays: literal(bookingReadiness.windowDays, 14),
    },
    continuity: {
      returnRate: sampledRate(record(continuity.returnRate)),
    },
    reviews: {
      pendingReplyCount: nonNegativeInteger(reviews.pendingReplyCount),
      status: oneOf(reviews.status, "empty", "ready"),
    },
    sessions: {
      cancellationRate: sampledRate(record(sessions.cancellationRate)),
      noShowRate: sampledRate(record(sessions.noShowRate)),
    },
  };
}

function mapMeta(input: unknown): TherapistAuraMeta {
  const value = record(input);
  return {
    computedAt: dateTime(value.computedAt),
    freshThrough: dateTime(value.freshThrough),
    periodDays: oneOf(value.periodDays, 30, 90),
    periodEnd: dateTime(value.periodEnd),
    periodStart: dateTime(value.periodStart),
    previousPeriodEnd: dateTime(value.previousPeriodEnd),
    previousPeriodStart: dateTime(value.previousPeriodStart),
    timezone: nonEmptyString(value.timezone),
  };
}

function sampledRate(value: Record<string, unknown>): AuraSampledRate {
  const status = oneOf(value.status, "insufficient_sample", "ready");
  const base = {
    minimumSample: literal(value.minimumSample, 10),
    observedSample: nonNegativeInteger(value.observedSample),
    status,
    unit: literal(value.unit, "percent"),
  };

  if (status === "insufficient_sample") {
    if (
      value.value !== null ||
      value.previousValue !== null ||
      value.direction !== null
    ) {
      throw new Error("Protected Aura metric leaked partial data.");
    }

    return {
      ...base,
      direction: null,
      previousValue: null,
      value: null,
    };
  }

  return {
    ...base,
    direction: oneOf(value.direction, "down", "stable", "up"),
    previousValue: nullableNonNegativeNumber(value.previousValue),
    value: nonNegativeNumber(value.value),
  };
}

function mapDismissal(input: unknown): AuraDismissal {
  const value = record(input);
  return {
    dismissedAt: dateTime(value.dismissedAt),
    periodEnd: dateTime(value.periodEnd),
    periodStart: dateTime(value.periodStart),
    recommendationKey: nonEmptyString(value.recommendationKey),
    ruleKey: nonEmptyString(value.ruleKey),
    ruleVersion: positiveInteger(value.ruleVersion),
  };
}

function mapPersistedRecommendation(
  input: unknown,
): ReturnType<typeof buildAuraRecommendations>[number] {
  const value = mapPersistedRecommendationRow(input);
  const actionRouteKey = value.actionRouteKey ?? "insights";
  return {
    actionHref: auraActionRoutes[actionRouteKey],
    actionLabel: "Ver detalhe",
    actionRouteKey,
    body: value.body,
    evidenceLabel: "Recomendação registrada por regra determinística.",
    id: `persisted:${value.id}`,
    priority: value.priority,
    ruleKey: value.ruleKey,
    ruleVersion: value.ruleVersion,
    title: value.title,
    tone: "opportunity",
  };
}

function mapPersistedRecommendationRow(
  input: unknown,
): AuraPersistedRecommendation {
  const value = record(input);
  return {
    actionRouteKey:
      value.actionRouteKey === null
        ? null
        : oneOf(
            value.actionRouteKey,
            "agenda",
            "insights",
            "profile",
            "reviews",
            "services",
            "sessions",
          ),
    body: nonEmptyString(value.body),
    evidence: record(value.evidence),
    expiresAt: value.expiresAt === null ? null : dateTime(value.expiresAt),
    generatedAt: dateTime(value.generatedAt),
    id: nonEmptyString(value.id),
    priority: nonNegativeInteger(value.priority),
    ruleKey: nonEmptyString(value.ruleKey),
    ruleVersion: positiveInteger(value.ruleVersion),
    title: nonEmptyString(value.title),
  };
}

function dateTime(value: unknown) {
  const parsed = nonEmptyString(value);
  if (Number.isNaN(Date.parse(parsed))) throw new Error("Invalid date.");
  return parsed;
}

function positiveInteger(value: unknown) {
  const parsed = nonNegativeInteger(value);
  if (parsed < 1) throw new Error("Invalid positive integer.");
  return parsed;
}

function nonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid non-negative integer.");
  }
  return value;
}

function nonNegativeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid non-negative number.");
  }
  return value;
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null) return null;
  return nonNegativeNumber(value);
}

function nonEmptyString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Invalid string.");
  }
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid array.");
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid record.");
  }
  return value as Record<string, unknown>;
}

function literal<const T extends string | number>(
  value: unknown,
  expected: T,
): T {
  if (value !== expected) throw new Error("Invalid literal.");
  return expected;
}

function oneOf<const T extends readonly (string | number)[]>(
  value: unknown,
  ...allowed: T
): T[number] {
  if (!allowed.includes(value as T[number])) {
    throw new Error("Invalid enum value.");
  }
  return value as T[number];
}
