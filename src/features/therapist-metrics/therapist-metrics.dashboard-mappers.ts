import { TherapistMetricsError } from "./therapist-metrics.errors";
import {
  mapTherapistInterestMetrics,
  mapTherapistSessionMetrics,
} from "./therapist-metrics.detail-mappers";
import { mapTherapistMetricsOverview } from "./therapist-metrics.mappers";
import type {
  TherapistMetricsDashboard,
  TherapistFutureAgenda,
  TherapistMetricsOccupancy,
  TherapistOccupancyHeatmapPoint,
  TherapistOccupancyPoint,
} from "./therapist-metrics.types";

export function mapTherapistMetricsDashboard(
  input: unknown,
): TherapistMetricsDashboard {
  try {
    const value = record(input);
    const overview = mapTherapistMetricsOverview(value.overview);
    const sessions = mapTherapistSessionMetrics(value.sessions);
    const interest = mapTherapistInterestMetrics(value.interest);
    const periodDays = metricsPeriod(overview.meta.periodDays);

    if (
      (value.contractVersion !== 2 &&
        value.contractVersion !== 3 &&
        value.contractVersion !== 4) ||
      (value.metricDefinitionVersion !== 2 &&
        value.metricDefinitionVersion !== 3 &&
        value.metricDefinitionVersion !== 4) ||
      (value.contractVersion === 4 && value.futureAgenda === undefined) ||
      overview.therapist.profileId !== sessions.therapist.profileId ||
      overview.therapist.profileId !== interest.therapist.profileId
    ) {
      throw new Error("Invalid dashboard contract.");
    }

    if (sessions.contractVersion !== 1) {
      throw new Error("Invalid dashboard session contract.");
    }

    return {
      contractVersion: value.contractVersion,
      futureAgenda:
        value.contractVersion === 4
          ? mapFutureAgenda(value.futureAgenda)
          : undefined,
      interest,
      meta: { ...overview.meta, periodDays },
      metricDefinitionVersion: value.metricDefinitionVersion,
      occupancy: mapOccupancy(value.occupancy, periodDays),
      overview,
      sessions,
      therapist: overview.therapist,
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

function mapFutureAgenda(input: unknown): TherapistFutureAgenda {
  const value = record(input);
  const status = value.status;
  const reason = value.reason;

  if (
    (status !== "available" &&
      status !== "insufficient_data" &&
      status !== "unavailable") ||
    (reason !== null && reason !== "no_active_services" && reason !== "no_availability")
  ) {
    throw new Error("Invalid future agenda status.");
  }

  const capacityMinutes = nonNegativeInteger(value.capacityMinutes);
  const reservedMinutes = nonNegativeInteger(value.reservedMinutes);
  const occupancyRate = nullablePercentage(value.occupancyRate);

  if (reservedMinutes > capacityMinutes) {
    throw new Error("Invalid future agenda capacity.");
  }

  return {
    availableMinutes: nonNegativeInteger(value.availableMinutes),
    capacityMinutes,
    occupancyRate,
    reason,
    reservedMinutes,
    reservedSessionCount: nonNegativeInteger(value.reservedSessionCount),
    status,
    windowEnd: date(value.windowEnd),
    windowStart: date(value.windowStart),
  };
}

function mapOccupancy(
  input: unknown,
  requiredCoverageDays: 30 | 60,
): TherapistMetricsOccupancy {
  const value = record(input);
  const status = value.status;
  const coverageDays = nonNegativeInteger(value.coverageDays);
  const coverageStart = nullableDate(value.coverageStart);

  if (value.requiredCoverageDays !== requiredCoverageDays) {
    throw new Error("Invalid occupancy period.");
  }

  if (status === "forming") {
    if (value.reason !== "history_in_formation") {
      throw new Error("Invalid occupancy reason.");
    }
    return {
      coverageDays,
      coverageStart,
      reason: "history_in_formation",
      requiredCoverageDays,
      status,
    };
  }

  if ((status !== "ready" && status !== "empty") || coverageStart === null) {
    throw new Error("Invalid occupancy status.");
  }

  return {
    coverageDays,
    coverageStart,
    current: occupancySummary(value.current),
    heatmap: array(value.heatmap).map(heatmapPoint),
    previous: occupancySummary(value.previous),
    requiredCoverageDays,
    series: array(value.series).map(occupancyPoint),
    status,
  };
}

function metricsPeriod(value: number): 30 | 60 {
  if (value !== 30 && value !== 60) {
    throw new Error("Invalid dashboard period.");
  }
  return value;
}

function occupancySummary(input: unknown) {
  const value = record(input);
  return {
    occupiedMinutes: nonNegativeInteger(value.occupiedMinutes),
    offeredMinutes: nonNegativeInteger(value.offeredMinutes),
    percentage: nullablePercentage(value.percentage),
  };
}

function occupancyPoint(input: unknown): TherapistOccupancyPoint {
  const value = record(input);
  return {
    date: date(value.date),
    occupiedMinutes: nonNegativeInteger(value.occupiedMinutes),
    offeredMinutes: nonNegativeInteger(value.offeredMinutes),
    percentage: nullablePercentage(value.percentage),
  };
}

function heatmapPoint(input: unknown): TherapistOccupancyHeatmapPoint {
  const value = record(input);
  const dayOfWeek = nonNegativeInteger(value.dayOfWeek);
  const hourBucketStart = nonNegativeInteger(value.hourBucketStart);
  if (dayOfWeek > 6 || hourBucketStart > 23)
    throw new Error("Invalid heatmap point.");
  return {
    dayOfWeek,
    hourBucketStart,
    occupiedMinutes: nonNegativeInteger(value.occupiedMinutes),
    offeredMinutes: nonNegativeInteger(value.offeredMinutes),
    percentage: nullablePercentage(value.percentage),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected object.");
  }
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected array.");
  return value;
}

function nonNegativeInteger(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0)
    throw new Error("Invalid integer.");
  return Number(value);
}

function nullablePercentage(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "number" || value < 0 || value > 100) {
    throw new Error("Invalid percentage.");
  }
  return value;
}

function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid date.");
  }
  return value;
}

function nullableDate(value: unknown) {
  if (value === null) return null;
  return date(value);
}
