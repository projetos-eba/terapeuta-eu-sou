import { describe, expect, it } from "vitest";

import { buildAuraRecommendations } from "./therapist-aura.rules";
import type {
  AuraSampledRate,
  TherapistAuraMeta,
  TherapistAuraSignals,
} from "./therapist-aura.types";

describe("buildAuraRecommendations", () => {
  it("returns no recommendations when every signal is empty or stable", () => {
    expect(
      buildAuraRecommendations({
        dismissals: [],
        meta: metaFixture(),
        signals: signalsFixture(),
      }),
    ).toEqual([]);
  });

  it("emits all MVP recommendations from valid aggregate signals", () => {
    const recommendations = buildAuraRecommendations({
      dismissals: [],
      meta: metaFixture(),
      signals: signalsFixture({
        bookingReadiness: {
          publicBookableServices: 2,
          servicesWithFutureAvailability: 0,
          status: "ready",
          windowDays: 14,
        },
        continuity: {
          returnRate: readyRate({
            direction: "down",
            previousValue: 62,
            value: 44,
          }),
        },
        reviews: {
          pendingReplyCount: 3,
          status: "ready",
        },
        sessions: {
          cancellationRate: readyRate({
            direction: "up",
            previousValue: 5,
            value: 18,
          }),
          noShowRate: readyRate({
            direction: "up",
            previousValue: 4,
            value: 15,
          }),
        },
      }),
    });

    expect(recommendations.map((item) => item.ruleKey)).toEqual([
      "aura.booking_readiness.no_future_slots.v1",
      "aura.reviews.pending_reply.v1",
      "aura.sessions.cancellation_increased.v1",
      "aura.sessions.no_show_increased.v1",
      "aura.continuity.return_rate_decreased.v1",
    ]);
  });

  it("does not emit rate recommendations when sample is insufficient", () => {
    const recommendations = buildAuraRecommendations({
      dismissals: [],
      meta: metaFixture(),
      signals: signalsFixture({
        continuity: { returnRate: insufficientRate(4) },
        sessions: {
          cancellationRate: insufficientRate(3),
          noShowRate: insufficientRate(7),
        },
      }),
    });

    expect(recommendations).toHaveLength(0);
  });

  it("filters dismissed recommendations by stable recommendation key", () => {
    const meta = metaFixture();
    const first = buildAuraRecommendations({
      dismissals: [],
      meta,
      signals: signalsFixture({
        reviews: {
          pendingReplyCount: 1,
          status: "ready",
        },
      }),
    })[0];

    expect(
      buildAuraRecommendations({
        dismissals: [{ recommendationKey: first.id }],
        meta,
        signals: signalsFixture({
          reviews: {
            pendingReplyCount: 1,
            status: "ready",
          },
        }),
      }),
    ).toEqual([]);
  });
});

function metaFixture(): TherapistAuraMeta {
  return {
    computedAt: "2026-07-31T12:00:00.000Z",
    freshThrough: "2026-07-31T03:00:00.000Z",
    periodDays: 30,
    periodEnd: "2026-07-31T03:00:00.000Z",
    periodStart: "2026-07-01T03:00:00.000Z",
    previousPeriodEnd: "2026-07-01T03:00:00.000Z",
    previousPeriodStart: "2026-06-01T03:00:00.000Z",
    timezone: "America/Sao_Paulo",
  };
}

function signalsFixture(
  overrides: Partial<TherapistAuraSignals> = {},
): TherapistAuraSignals {
  return {
    bookingReadiness: {
      publicBookableServices: 1,
      servicesWithFutureAvailability: 1,
      status: "ready",
      windowDays: 14,
    },
    continuity: {
      returnRate: readyRate({
        direction: "stable",
        previousValue: 50,
        value: 50,
      }),
    },
    reviews: {
      pendingReplyCount: 0,
      status: "empty",
    },
    sessions: {
      cancellationRate: readyRate({
        direction: "stable",
        previousValue: 10,
        value: 10,
      }),
      noShowRate: readyRate({
        direction: "stable",
        previousValue: 10,
        value: 10,
      }),
    },
    ...overrides,
  };
}

function readyRate({
  direction,
  previousValue,
  value,
}: {
  direction: "down" | "stable" | "up";
  previousValue: number;
  value: number;
}): AuraSampledRate {
  return {
    direction,
    minimumSample: 10,
    observedSample: 20,
    previousValue,
    status: "ready",
    unit: "percent",
    value,
  };
}

function insufficientRate(observedSample: number): AuraSampledRate {
  return {
    direction: null,
    minimumSample: 10,
    observedSample,
    previousValue: null,
    status: "insufficient_sample",
    unit: "percent",
    value: null,
  };
}
