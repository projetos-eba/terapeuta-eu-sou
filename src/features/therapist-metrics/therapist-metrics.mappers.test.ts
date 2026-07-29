import { describe, expect, it } from "vitest";

import {
  TherapistMetricsError,
  type TherapistMetricsErrorCode,
} from "./therapist-metrics.errors";
import { mapTherapistMetricsFoundation } from "./therapist-metrics.mappers";

describe("therapist metrics mapper", () => {
  it("maps the three approved no-lock counters", () => {
    const data = mapTherapistMetricsFoundation(rawFoundation());

    expect(data.counters).toMatchObject({
      peopleServed: {
        direction: "up",
        directionCopyKey: "therapist_metrics.people_served.up",
        unit: "people",
        value: 8,
      },
      serviceMinutes: {
        direction: "down",
        directionCopyKey: "therapist_metrics.service_minutes.down",
        unit: "minutes",
        value: 390,
      },
      sessionsCompleted: {
        direction: "stable",
        directionCopyKey: "therapist_metrics.sessions_completed.stable",
        unit: "sessions",
        value: 10,
      },
    });
  });

  it("rejects a counter without its canonical directional copy key", () => {
    const input = rawFoundation();
    input.counters.peopleServed.directionCopyKey =
      "therapist_metrics.people_served.celebration";

    expectMetricsError(
      () => mapTherapistMetricsFoundation(input),
      "invalid_contract",
    );
  });

  it("rejects negative, fractional or invented counter values", () => {
    const input = rawFoundation();
    input.counters.sessionsCompleted.value = -1;

    expectMetricsError(
      () => mapTherapistMetricsFoundation(input),
      "invalid_contract",
    );
  });

  it("does not accept the Free plan in this capability-protected contract", () => {
    const input = rawFoundation() as ReturnType<typeof rawFoundation> & {
      therapist: { plan: string; profileId: string };
    };
    input.therapist.plan = "free";

    expectMetricsError(
      () => mapTherapistMetricsFoundation(input),
      "invalid_contract",
    );
  });
});

function expectMetricsError(
  callback: () => unknown,
  code: TherapistMetricsErrorCode,
) {
  try {
    callback();
    throw new Error("Expected therapist metrics parser to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(TherapistMetricsError);
    expect((error as TherapistMetricsError).code).toBe(code);
  }
}

function rawFoundation() {
  return {
    contractVersion: 1,
    counters: {
      peopleServed: {
        direction: "up",
        directionCopyKey: "therapist_metrics.people_served.up",
        previousValue: 6,
        status: "ready",
        unit: "people",
        value: 8,
      },
      serviceMinutes: {
        direction: "down",
        directionCopyKey: "therapist_metrics.service_minutes.down",
        previousValue: 420,
        status: "ready",
        unit: "minutes",
        value: 390,
      },
      sessionsCompleted: {
        direction: "stable",
        directionCopyKey: "therapist_metrics.sessions_completed.stable",
        previousValue: 10,
        status: "ready",
        unit: "sessions",
        value: 10,
      },
    },
    meta: {
      computedAt: "2026-07-28T16:00:00.000Z",
      freshThrough: "2026-07-28T03:00:00.000Z",
      periodDays: 30,
      periodEnd: "2026-07-28T03:00:00.000Z",
      periodStart: "2026-06-28T03:00:00.000Z",
      previousPeriodEnd: "2026-06-28T03:00:00.000Z",
      previousPeriodStart: "2026-05-29T03:00:00.000Z",
      timezone: "America/Sao_Paulo",
    },
    metricDefinitionVersion: 1,
    therapist: {
      plan: "premium_plus",
      profileId: "c1000000-0000-4000-8000-000000000001",
    },
  };
}
