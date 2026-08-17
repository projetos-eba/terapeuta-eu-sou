import { TherapistMetricsError } from "./therapist-metrics.errors";
import {
  mapTherapistInterestMetrics,
  mapTherapistSessionMetrics,
} from "./therapist-metrics.detail-mappers";
import { mapTherapistMetricsOverview } from "./therapist-metrics.mappers";
import type {
  TherapistMetricsDashboard,
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

    if (
      value.contractVersion !== 2 ||
      value.metricDefinitionVersion !== 2 ||
      overview.therapist.profileId !== sessions.therapist.profileId ||
      overview.therapist.profileId !== interest.therapist.profileId
    ) {
      throw new Error("Invalid dashboard contract.");
    }

    return {
      contractVersion: 2,
      interest,
      meta: overview.meta,
      metricDefinitionVersion: 2,
      occupancy: mapOccupancy(value.occupancy, overview.meta.periodDays),
      overview,
      sessions,
      therapist: overview.therapist,
    };
  } catch (error) {
    if (error instanceof TherapistMetricsError) throw error;
    throw new TherapistMetricsError("invalid_contract");
  }
}

function mapOccupancy(
  input: unknown,
  requiredCoverageDays: 30 | 90,
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
