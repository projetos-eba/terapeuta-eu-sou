import { TherapistMetricsError } from "./therapist-metrics.errors";
import type {
  TherapistInterestMetrics,
  TherapistInterestSegmentKey,
  TherapistMetricDirection,
  TherapistMetricDirectionCopyKey,
  TherapistMetricProtectedCollection,
  TherapistMetricsCommonMeta,
  TherapistSessionEvolutionComparison,
  TherapistSessionMetrics,
  TherapistSessionOutcomeKey,
} from "./therapist-metrics.types";

export function mapTherapistSessionEvolutionComparison(
  input: unknown,
): TherapistSessionEvolutionComparison {
  try {
    const value = record(input);
    const meta = commonMeta(value.meta);
    const points = array(value.points).map((point, expectedIndex) => {
      const item = record(point);
      const index = nonNegativeInteger(item.index);
      if (index !== expectedIndex) {
        throw new Error("Comparison points are not sequential.");
      }

      return {
        current: nonNegativeInteger(item.current),
        currentDate: metricDate(item.currentDate),
        index,
        previous: nonNegativeInteger(item.previous),
        previousDate: metricDate(item.previousDate),
      };
    });

    if (points.length !== meta.periodDays) {
      throw new Error("Comparison series does not cover the selected period.");
    }

    return {
      contractVersion: literal(value.contractVersion, 1),
      meta,
      metricDefinitionVersion: literal(value.metricDefinitionVersion, 1),
      points,
      status: emptyOrReady(value.status),
      therapist: therapist(value.therapist),
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

export function mapTherapistSessionMetrics(
  input: unknown,
): TherapistSessionMetrics {
  try {
    const value = record(input);
    const summary = record(value.summary);
    const evolution = record(value.evolution);
    const cancellationReasons = record(value.cancellationReasons);

    return {
      cancellationReasons: {
        reason: literal(
          cancellationReasons.reason,
          "cancellation_taxonomy_not_versioned",
        ),
        status: literal(cancellationReasons.status, "unavailable"),
      },
      contractVersion: literal(value.contractVersion, 1),
      evolution: {
        points: array(evolution.points).map((point) => {
          const item = record(point);
          return {
            date: metricDate(item.date),
            noShows: nonNegativeInteger(item.noShows),
            sessionsCancelled: nonNegativeInteger(item.sessionsCancelled),
            sessionsCompleted: nonNegativeInteger(item.sessionsCompleted),
            sessionsRescheduled: nonNegativeInteger(item.sessionsRescheduled),
          };
        }),
        status: emptyOrReady(evolution.status),
      },
      heatmap: protectedCollection(value.heatmap, (item) => ({
        dayOfWeek: dayOfWeek(item.dayOfWeek),
        hourBucketStart: hourBucket(item.hourBucketStart),
        sessions: nonNegativeInteger(item.sessions),
      })),
      meta: commonMeta(value.meta),
      metricDefinitionVersion: literal(value.metricDefinitionVersion, 1),
      outcomeDistribution: protectedCollection(
        value.outcomeDistribution,
        (item) => ({
          key: outcomeKey(item.key),
          label: nonEmptyString(item.label),
          percentage: percentage(item.percentage),
          value: nonNegativeInteger(item.value),
        }),
      ),
      presenceByDay: protectedCollection(value.presenceByDay, (item) => ({
        dayOfWeek: dayOfWeek(item.dayOfWeek),
        percentage: percentage(item.percentage),
        sample: nonNegativeInteger(item.sample),
      })),
      presenceByHour: protectedCollection(value.presenceByHour, (item) => ({
        hourBucketStart: hourBucket(item.hourBucketStart),
        percentage: percentage(item.percentage),
        sample: nonNegativeInteger(item.sample),
      })),
      summary: {
        operationalPresence: sampledMetric(
          summary.operationalPresence,
          "therapist_metrics.operational_presence",
          "percent",
        ),
        reservedDurationAverage: counter(
          summary.reservedDurationAverage,
          "therapist_metrics.reserved_duration_average",
          "minutes",
        ),
        sessionsCancelled: counter(
          summary.sessionsCancelled,
          "therapist_metrics.sessions_cancelled",
          "sessions",
        ),
        sessionsCompleted: counter(
          summary.sessionsCompleted,
          "therapist_metrics.sessions_completed",
          "sessions",
        ),
        sessionsRescheduled: counter(
          summary.sessionsRescheduled,
          "therapist_metrics.sessions_rescheduled",
          "sessions",
        ),
      },
      therapist: therapist(value.therapist),
      therapyDistribution: protectedCollection(
        value.therapyDistribution,
        (item) => ({
          percentage: percentage(item.percentage),
          sessions: nonNegativeInteger(item.sessions),
          therapyId: nonEmptyString(item.therapyId),
          therapyName: nonEmptyString(item.therapyName),
        }),
      ),
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

export function mapTherapistInterestMetrics(
  input: unknown,
): TherapistInterestMetrics {
  try {
    const value = record(input);
    const access = record(value.access);
    const base = {
      contractVersion: literal(value.contractVersion, 1),
      meta: commonMeta(value.meta),
      metricDefinitionVersion: literal(value.metricDefinitionVersion, 1),
      therapist: therapist(value.therapist),
    } as const;
    const accessStatus = oneOf(access.status, "capability_locked", "ready");
    const requiredPlan = literal(access.requiredPlan, "premium_plus");

    if (accessStatus === "capability_locked") {
      return {
        ...base,
        access: {
          requiredPlan,
          status: accessStatus,
        },
      };
    }

    const summary = record(value.summary);
    const segments = protectedCollection(value.segments, (item) => ({
      key: segmentKey(item.key),
      percentage: percentage(item.percentage),
      value: nonNegativeInteger(item.value),
    }));

    return {
      ...base,
      access: {
        requiredPlan,
        status: accessStatus,
      },
      availabilityGap: unavailable(
        value.availabilityGap,
        "availability_gap_event_not_implemented",
      ),
      baseEvolution: protectedCollection(value.baseEvolution, (item) => ({
        date: metricDate(item.date),
        newPeople: nonNegativeInteger(item.newPeople),
        totalPeople: nonNegativeInteger(item.totalPeople),
      })),
      cohorts: protectedCollection(value.cohorts, (item) => ({
        cohortMonth: metricDate(item.cohortMonth),
        cohortSize: nonNegativeInteger(item.cohortSize),
        retention: array(item.retention).map((entry) => {
          const point = record(entry);
          return {
            monthOffset: boundedInteger(point.monthOffset, 0, 5),
            percentage: percentage(point.percentage),
          };
        }),
      })),
      exitReasons: unavailable(
        value.exitReasons,
        "relationship_exit_taxonomy_not_versioned",
      ),
      favoriteConversion: unavailable(
        value.favoriteConversion,
        "favorite_conversion_linkage_not_available",
      ),
      journeyThemes: unavailable(
        value.journeyThemes,
        "free_text_analysis_prohibited",
      ),
      segments: {
        ...segments,
        definitionVersion: literal(record(value.segments).definitionVersion, 1),
      },
      sentiment: unavailable(
        value.sentiment,
        "sentiment_schema_and_consent_not_implemented",
      ),
      summary: {
        peopleReturned: sampledMetric(
          summary.peopleReturned,
          "therapist_metrics.people_returned",
          "people",
        ),
        profileFavorites: sampledMetric(
          summary.profileFavorites,
          "therapist_metrics.profile_favorites",
          "favorites",
        ),
        returnRate: sampledMetric(
          summary.returnRate,
          "therapist_metrics.return_rate",
          "percent",
        ),
        sessionsPerPerson: sampledMetric(
          summary.sessionsPerPerson,
          "therapist_metrics.sessions_per_person",
          "ratio",
        ),
      },
      therapyReturn: protectedCollection(value.therapyReturn, (item) => ({
        people: nonNegativeInteger(item.people),
        returnedPeople: nonNegativeInteger(item.returnedPeople),
        returnRate: percentage(item.returnRate),
        therapyId: nonEmptyString(item.therapyId),
        therapyName: nonEmptyString(item.therapyName),
      })),
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

function commonMeta(input: unknown): TherapistMetricsCommonMeta {
  const value = record(input);
  return {
    computedAt: dateTime(value.computedAt),
    freshThrough: dateTime(value.freshThrough),
    periodDays: oneOf(value.periodDays, 30, 60, 90, 120),
    periodEnd: dateTime(value.periodEnd),
    periodStart: dateTime(value.periodStart),
    previousPeriodEnd: dateTime(value.previousPeriodEnd),
    previousPeriodStart: dateTime(value.previousPeriodStart),
    timezone: nonEmptyString(value.timezone),
  };
}

function therapist(input: unknown) {
  const value = record(input);
  return {
    plan: oneOf(value.plan, "premium", "premium_plus"),
    profileId: nonEmptyString(value.profileId),
  };
}

function counter<TUnit extends "minutes" | "sessions">(
  input: unknown,
  prefix: string,
  unit: TUnit,
) {
  const value = record(input);
  const direction = directionValue(value.direction);
  const directionCopyKey = nonEmptyString(value.directionCopyKey);
  if (directionCopyKey !== `${prefix}.${direction}` || value.unit !== unit) {
    throw new Error("Invalid metric counter contract.");
  }

  return {
    direction,
    directionCopyKey: directionCopyKey as TherapistMetricDirectionCopyKey,
    previousValue: nonNegativeInteger(value.previousValue),
    status: emptyOrReady(value.status),
    unit,
    value: nonNegativeInteger(value.value),
  };
}

function sampledMetric<
  TUnit extends "favorites" | "people" | "percent" | "ratio",
>(input: unknown, prefix: string, unit: TUnit) {
  const value = record(input);
  const status = oneOf(value.status, "insufficient_sample", "ready");
  const minimumSample = literal(value.minimumSample, 10);
  const observedSample = nonNegativeInteger(value.observedSample);

  if (value.unit !== unit) throw new Error("Invalid sampled metric unit.");

  if (status === "insufficient_sample") {
    if (
      value.value !== null ||
      value.previousValue !== null ||
      value.direction !== null ||
      value.directionCopyKey !== null
    ) {
      throw new Error("Protected metric leaked a partial value.");
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

  const direction = directionValue(value.direction);
  const directionCopyKey = nonEmptyString(value.directionCopyKey);
  if (directionCopyKey !== `${prefix}.${direction}`) {
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

function protectedCollection<T>(
  input: unknown,
  mapItem: (value: Record<string, unknown>) => T,
): TherapistMetricProtectedCollection<T> {
  const value = record(input);
  const status = oneOf(value.status, "empty", "insufficient_sample", "ready");
  const items = array(value.items).map((item) => mapItem(record(item)));

  if (status !== "ready" && items.length > 0) {
    throw new Error("Protected collection leaked partial data.");
  }

  return {
    items,
    minimumSample: literal(value.minimumSample, 10),
    observedSample: nonNegativeInteger(value.observedSample),
    status,
  };
}

function unavailable<TReason extends string>(
  input: unknown,
  reason: TReason,
): { reason: TReason; status: "unavailable" } {
  const value = record(input);
  return {
    reason: literal(value.reason, reason),
    status: literal(value.status, "unavailable"),
  };
}

function outcomeKey(value: unknown): TherapistSessionOutcomeKey {
  return oneOf(
    value,
    "cancelled_by_patient",
    "cancelled_by_therapist",
    "completed",
    "no_show_patient",
    "no_show_therapist",
  );
}

function segmentKey(value: unknown): TherapistInterestSegmentKey {
  return oneOf(value, "active", "inactive", "new", "paused", "recurring");
}

function directionValue(value: unknown): TherapistMetricDirection {
  return oneOf(value, "down", "stable", "up");
}

function emptyOrReady(value: unknown) {
  return oneOf(value, "empty", "ready");
}

function dateTime(value: unknown) {
  const parsed = nonEmptyString(value);
  if (Number.isNaN(Date.parse(parsed))) throw new Error("Invalid date.");
  return parsed;
}

function metricDate(value: unknown) {
  const parsed = nonEmptyString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw new Error("Invalid metric date.");
  }
  return parsed;
}

function dayOfWeek(value: unknown) {
  return boundedInteger(value, 1, 7);
}

function hourBucket(value: unknown) {
  const parsed = boundedInteger(value, 0, 22);
  if (parsed % 2 !== 0) throw new Error("Invalid hour bucket.");
  return parsed;
}

function percentage(value: unknown) {
  const parsed = nonNegativeNumber(value);
  if (parsed > 100) throw new Error("Invalid percentage.");
  return parsed;
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const parsed = nonNegativeInteger(value);
  if (parsed < minimum || parsed > maximum) {
    throw new Error("Integer is outside the allowed range.");
  }
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
