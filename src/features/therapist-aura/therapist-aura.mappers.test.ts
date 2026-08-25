import { describe, expect, it } from "vitest";

import { mapTherapistAuraSignals } from "./therapist-aura.mappers";

describe("mapTherapistAuraSignals", () => {
  it("does not re-render a persisted recommendation dismissed in the same window", () => {
    const result = mapTherapistAuraSignals({
      contractVersion: 1,
      dismissals: [
        {
          dismissedAt: "2026-08-24T12:00:00.000Z",
          periodEnd: "2026-08-24T03:00:00.000Z",
          periodStart: "2026-07-25T03:00:00.000Z",
          recommendationKey: "persisted:e2000000-0000-4000-8000-000000000001",
          ruleKey: "aura.reviews.pending_reply.v1",
          ruleVersion: 1,
        },
      ],
      meta: metaFixture(),
      recommendations: [persistedFixture()],
      ruleRegistryVersion: 1,
      signals: signalsFixture(),
      therapist: {
        plan: "premium_plus",
        profileId: "c1000000-0000-4000-8000-000000000001",
      },
    });

    expect(result.recommendations).toEqual([]);
  });

  it("keeps one recommendation when live and persisted records share a rule", () => {
    const result = mapTherapistAuraSignals({
      contractVersion: 1,
      dismissals: [],
      meta: metaFixture(),
      recommendations: [persistedFixture()],
      ruleRegistryVersion: 1,
      signals: {
        ...signalsFixture(),
        reviews: {
          pendingReplyCount: 6,
          status: "ready",
          windowDays: 30,
        },
      },
      therapist: {
        plan: "premium_plus",
        profileId: "c1000000-0000-4000-8000-000000000001",
      },
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.title).toBe(
      "Avaliações aguardam uma resposta",
    );
  });
});

function persistedFixture() {
  return {
    actionRouteKey: "reviews",
    body: "Resumo agregado para validação.",
    evidence: {
      observedSample: 6,
      periodDays: 30,
      source: "local_validation",
    },
    expiresAt: "2026-08-25T03:00:00.000Z",
    generatedAt: "2026-08-14T12:00:00.000Z",
    id: "e2000000-0000-4000-8000-000000000001",
    priority: 78,
    ruleKey: "aura.reviews.pending_reply.v1",
    ruleVersion: 1,
    title: "Validação local — 10 dias",
  };
}

function metaFixture() {
  return {
    computedAt: "2026-08-24T12:00:00.000Z",
    freshThrough: "2026-08-24T12:00:00.000Z",
    periodDays: 30,
    periodEnd: "2026-08-24T03:00:00.000Z",
    periodStart: "2026-07-25T03:00:00.000Z",
    previousPeriodEnd: "2026-07-25T03:00:00.000Z",
    previousPeriodStart: "2026-06-25T03:00:00.000Z",
    timezone: "America/Sao_Paulo",
  };
}

function signalsFixture() {
  return {
    bookingReadiness: {
      publicBookableServices: 0,
      servicesWithFutureAvailability: 0,
      status: "empty",
      windowDays: 14,
    },
    continuity: { returnRate: insufficientRate() },
    reviews: {
      pendingReplyCount: 0,
      status: "empty",
      windowDays: 30,
    },
    sessions: {
      cancellationRate: insufficientRate(),
      noShowRate: insufficientRate(),
    },
  };
}

function insufficientRate() {
  return {
    direction: null,
    minimumSample: 10,
    observedSample: 0,
    previousValue: null,
    status: "insufficient_sample",
    unit: "percent",
    value: null,
  };
}
