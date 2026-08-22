import { TherapistMetricsError } from "./therapist-metrics.errors";
import type {
  TherapistMetricCounter,
  TherapistMetricDirection,
  TherapistMetricDirectionCopyKey,
  TherapistMetricsFoundation,
  TherapistMetricsOverview,
} from "./therapist-metrics.types";

const metricContracts = {
  peopleServed: {
    copyKeyPrefix: "therapist_metrics.people_served",
    unit: "people",
  },
  serviceMinutes: {
    copyKeyPrefix: "therapist_metrics.service_minutes",
    unit: "minutes",
  },
  sessionsCompleted: {
    copyKeyPrefix: "therapist_metrics.sessions_completed",
    unit: "sessions",
  },
} as const;

const overviewMetricContracts = {
  bookingFlowStarts: {
    copyKeyPrefix: "therapist_metrics.booking_flow_starts",
    unit: "events",
  },
  profileViews: {
    copyKeyPrefix: "therapist_metrics.profile_views",
    unit: "events",
  },
  searchImpressions: {
    copyKeyPrefix: "therapist_metrics.search_impressions",
    unit: "events",
  },
  therapyBookings: {
    copyKeyPrefix: "therapist_metrics.therapy_bookings",
    unit: "sessions",
  },
} as const;

export function mapTherapistMetricsFoundation(
  input: unknown,
): TherapistMetricsFoundation {
  try {
    const value = record(input);
    const therapist = record(value.therapist);
    const meta = record(value.meta);
    const counters = record(value.counters);

    return {
      contractVersion: literalOne(value.contractVersion),
      counters: {
        peopleServed: metricCounter(
          counters.peopleServed,
          metricContracts.peopleServed,
        ),
        serviceMinutes: metricCounter(
          counters.serviceMinutes,
          metricContracts.serviceMinutes,
        ),
        sessionsCompleted: metricCounter(
          counters.sessionsCompleted,
          metricContracts.sessionsCompleted,
        ),
      },
      meta: {
        computedAt: dateTime(meta.computedAt),
        freshThrough: dateTime(meta.freshThrough),
        periodDays: literalThirty(meta.periodDays),
        periodEnd: dateTime(meta.periodEnd),
        periodStart: dateTime(meta.periodStart),
        previousPeriodEnd: dateTime(meta.previousPeriodEnd),
        previousPeriodStart: dateTime(meta.previousPeriodStart),
        timezone: nonEmptyString(meta.timezone),
      },
      metricDefinitionVersion: literalOne(value.metricDefinitionVersion),
      therapist: {
        plan: metricsPlan(therapist.plan),
        profileId: nonEmptyString(therapist.profileId),
      },
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

export function mapTherapistMetricsOverview(
  input: unknown,
): TherapistMetricsOverview {
  try {
    const value = record(input);
    const therapist = record(value.therapist);
    const meta = record(value.meta);
    const counters = record(value.counters);
    const activity = record(value.activity);
    const discovery = record(value.discovery);
    const stages = record(discovery.stages);
    const funnel = record(discovery.funnel);
    const ranking = record(value.therapyRanking);
    const occupancy = record(value.occupancy);

    return {
      activity: {
        freshThrough: dateTime(activity.freshThrough),
        points: array(activity.points).map(activityPoint),
        status: emptyOrReady(activity.status),
      },
      contractVersion: literalOne(value.contractVersion),
      counters: {
        peopleServed: metricCounter(
          counters.peopleServed,
          metricContracts.peopleServed,
        ),
        serviceMinutes: metricCounter(
          counters.serviceMinutes,
          metricContracts.serviceMinutes,
        ),
        sessionsCompleted: metricCounter(
          counters.sessionsCompleted,
          metricContracts.sessionsCompleted,
        ),
      },
      discovery: {
        freshThrough: nullableDateTime(discovery.freshThrough),
        funnel: {
          profileToBooking: sampledMetric(
            funnel.profileToBooking,
            "therapist_metrics.profile_to_booking",
            "percent",
          ),
          searchToProfile: sampledMetric(
            funnel.searchToProfile,
            "therapist_metrics.search_to_profile",
            "percent",
          ),
        },
        reason: discoveryReason(discovery.reason),
        stages: {
          bookingFlowStarts: metricCounter(
            stages.bookingFlowStarts,
            overviewMetricContracts.bookingFlowStarts,
          ),
          profileViews: metricCounter(
            stages.profileViews,
            overviewMetricContracts.profileViews,
          ),
          searchImpressions: metricCounter(
            stages.searchImpressions,
            overviewMetricContracts.searchImpressions,
          ),
        },
        status: discoveryStatus(discovery.status),
      },
      meta: {
        computedAt: dateTime(meta.computedAt),
        freshThrough: dateTime(meta.freshThrough),
        periodDays: overviewPeriod(meta.periodDays),
        periodEnd: dateTime(meta.periodEnd),
        periodStart: dateTime(meta.periodStart),
        previousPeriodEnd: dateTime(meta.previousPeriodEnd),
        previousPeriodStart: dateTime(meta.previousPeriodStart),
        timezone: nonEmptyString(meta.timezone),
      },
      metricDefinitionVersion: literalOne(value.metricDefinitionVersion),
      occupancy: {
        reason: occupancyReason(occupancy.reason),
        status: unavailable(occupancy.status),
      },
      profileFavorites: sampledMetric(
        value.profileFavorites,
        "therapist_metrics.profile_favorites",
        "favorites",
      ),
      therapist: {
        plan: metricsPlan(therapist.plan),
        profileId: nonEmptyString(therapist.profileId),
      },
      therapyRanking: {
        items: array(ranking.items).map(rankingItem),
        minimumSample: literalTen(ranking.minimumSample),
        observedSample: nonNegativeInteger(ranking.observedSample),
        status: rankingStatus(ranking.status),
      },
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

function metricCounter<
  TUnit extends "events" | "minutes" | "people" | "sessions",
>(
  input: unknown,
  contract: { copyKeyPrefix: string; unit: TUnit },
): TherapistMetricCounter<TUnit> {
  const value = record(input);
  const direction = metricDirection(value.direction);
  const directionCopyKey = nonEmptyString(value.directionCopyKey);

  if (directionCopyKey !== `${contract.copyKeyPrefix}.${direction}`) {
    throw new Error("Invalid metric direction copy key.");
  }

  if (value.unit !== contract.unit) {
    throw new Error("Invalid metric unit.");
  }

  return {
    direction,
    directionCopyKey: directionCopyKey as TherapistMetricDirectionCopyKey,
    previousValue: nonNegativeInteger(value.previousValue),
    status: metricState(value.status),
    unit: contract.unit,
    value: nonNegativeInteger(value.value),
  };
}

function sampledMetric<TUnit extends "favorites" | "percent">(
  input: unknown,
  copyKeyPrefix: string,
  unit: TUnit,
) {
  const value = record(input);
  const status = sampledStatus(value.status);
  const minimumSample = literalTen(value.minimumSample);
  const observedSample = nonNegativeInteger(value.observedSample);

  if (value.unit !== unit) throw new Error("Invalid sampled metric unit.");

  if (status === "insufficient_sample") {
    if (
      value.value !== null ||
      value.previousValue !== null ||
      value.direction !== null ||
      value.directionCopyKey !== null
    ) {
      throw new Error("Insufficient samples must not expose values.");
    }

    return {
      direction: null,
      directionCopyKey: null,
      minimumSample,
      observedSample,
      previousValue: null,
      status,
      unit,
      value: null,
    } as const;
  }

  const direction = metricDirection(value.direction);
  const directionCopyKey = nonEmptyString(value.directionCopyKey);
  if (directionCopyKey !== `${copyKeyPrefix}.${direction}`) {
    throw new Error("Invalid sampled metric copy key.");
  }

  return {
    direction,
    directionCopyKey: directionCopyKey as TherapistMetricDirectionCopyKey,
    minimumSample,
    observedSample,
    previousValue: nullableNonNegativeNumber(value.previousValue),
    status,
    unit,
    value: nonNegativeNumber(value.value),
  } as const;
}

function activityPoint(input: unknown) {
  const value = record(input);
  const date = nonEmptyString(value.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid metric date.");
  }

  return {
    date,
    sessionsCompleted: nonNegativeInteger(value.sessionsCompleted),
  };
}

function rankingItem(input: unknown) {
  const value = record(input);
  return {
    counter: metricCounter(
      value.counter,
      overviewMetricContracts.therapyBookings,
    ),
    therapyId: nonEmptyString(value.therapyId),
    therapyName: nonEmptyString(value.therapyName),
  };
}

function dateTime(value: unknown) {
  const parsed = nonEmptyString(value);
  if (Number.isNaN(Date.parse(parsed))) throw new Error("Invalid date.");
  return parsed;
}

function literalOne(value: unknown): 1 {
  if (value !== 1) throw new Error("Invalid contract version.");
  return 1;
}

function literalThirty(value: unknown): 30 {
  if (value !== 30) throw new Error("Invalid period.");
  return 30;
}

function overviewPeriod(value: unknown): 30 | 60 | 90 | 120 {
  if (value !== 30 && value !== 60 && value !== 90 && value !== 120) {
    throw new Error("Invalid period.");
  }
  return value;
}

function literalTen(value: unknown): 10 {
  if (value !== 10) throw new Error("Invalid minimum sample.");
  return 10;
}

function metricDirection(value: unknown): TherapistMetricDirection {
  if (value !== "up" && value !== "stable" && value !== "down") {
    throw new Error("Invalid metric direction.");
  }
  return value;
}

function metricState(value: unknown): "empty" | "ready" {
  if (value !== "empty" && value !== "ready") {
    throw new Error("Invalid metric state.");
  }
  return value;
}

function emptyOrReady(value: unknown): "empty" | "ready" {
  return metricState(value);
}

function sampledStatus(value: unknown): "insufficient_sample" | "ready" {
  if (value !== "insufficient_sample" && value !== "ready") {
    throw new Error("Invalid sampled metric state.");
  }
  return value;
}

function discoveryStatus(
  value: unknown,
): "empty" | "processing" | "ready" | "unavailable" {
  if (
    value !== "empty" &&
    value !== "processing" &&
    value !== "ready" &&
    value !== "unavailable"
  ) {
    throw new Error("Invalid discovery state.");
  }
  return value;
}

function rankingStatus(
  value: unknown,
): "empty" | "insufficient_sample" | "ready" {
  if (
    value !== "empty" &&
    value !== "insufficient_sample" &&
    value !== "ready"
  ) {
    throw new Error("Invalid ranking state.");
  }
  return value;
}

function discoveryReason(value: unknown): "privacy_activation_pending" | null {
  if (value === null) return null;
  if (value !== "privacy_activation_pending") {
    throw new Error("Invalid discovery reason.");
  }
  return value;
}

function occupancyReason(
  value: unknown,
): "historical_availability_not_versioned" {
  if (value !== "historical_availability_not_versioned") {
    throw new Error("Invalid occupancy reason.");
  }
  return value;
}

function unavailable(value: unknown): "unavailable" {
  if (value !== "unavailable") throw new Error("Invalid unavailable state.");
  return value;
}

function metricsPlan(value: unknown): "premium" | "premium_plus" {
  if (value !== "premium" && value !== "premium_plus") {
    throw new Error("Invalid metrics plan.");
  }
  return value;
}

function nonEmptyString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Invalid string.");
  }
  return value;
}

function nonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid counter value.");
  }
  return value;
}

function nonNegativeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid numeric metric value.");
  }
  return value;
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null) return null;
  return nonNegativeNumber(value);
}

function nullableDateTime(value: unknown) {
  if (value === null) return null;
  return dateTime(value);
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
