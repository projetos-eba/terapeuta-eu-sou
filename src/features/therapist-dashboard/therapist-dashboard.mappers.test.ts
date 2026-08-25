import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";

import type { TherapistAuraPageData } from "../therapist-aura/therapist-aura.types";
import {
  calculateAttendanceRate,
  calculateRevenueCents,
  calculateTrend,
  mapTherapistDashboardResponse,
  mapTherapistAuraPage,
} from "./therapist-dashboard.mappers";

describe("dashboard calculations", () => {
  it("calculates attendance rate and handles zero division", () => {
    expect(calculateAttendanceRate(7, 1)).toBe(88);
    expect(calculateAttendanceRate(0, 0)).toBe(0);
  });

  it("calculates trends including empty previous periods", () => {
    expect(calculateTrend(12, 10)).toEqual({
      direction: "up",
      percent: 20,
    });
    expect(calculateTrend(0, 0)).toEqual({
      direction: "flat",
      percent: 0,
    });
    expect(calculateTrend(5, 0)).toEqual({
      direction: "up",
      percent: null,
    });
  });

  it("sums only paid net revenue", () => {
    expect(
      calculateRevenueCents([
        { netAmountCents: 1000, status: "paid" },
        { netAmountCents: 500, status: "pending" },
        { netAmountCents: 2400, status: "paid" },
      ]),
    ).toBe(3400);
  });
});

describe("dashboard mapper", () => {
  it("maps empty periods without inventing data", () => {
    const result = mapTherapistDashboardResponse({
      attentionItems: [],
      history: {},
      kpis: {},
      recentReviews: [],
      therapist: {
        name: "Ana Oliveira",
        plan: "premium_plus",
        profileId: "therapist-1",
      },
      today: {},
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
      upcomingSessions: [],
      week: { days: [], rangeLabel: "" },
    });

    expect(result.today.sessionsToday).toBe(0);
    expect(result.kpis.monthlySessions.value).toBe(0);
    expect(result.upcomingSessions).toEqual([]);
  });

  it("separates observations, suggestions and actions", () => {
    const result = mapTherapistAuraPage({
      ...emptyAuraPage(),
      recommendations: [
        {
          actionHref: routes.therapist.profile,
          actionLabel: "Revisar perfil",
          actionRouteKey: "profile",
          body: "Sinal agregado",
          evidenceLabel: "Fonte agregada",
          id: "1",
          priority: 90,
          ruleKey: "aura.profile.v1",
          ruleVersion: 1,
          title: "Sinal",
          tone: "attention",
        },
        {
          actionHref: routes.therapist.reviews,
          actionLabel: "Responder avaliações",
          actionRouteKey: "reviews",
          body: "Ação segura",
          evidenceLabel: "Fonte agregada",
          id: "2",
          priority: 80,
          ruleKey: "aura.reviews.v1",
          ruleVersion: 1,
          title: "Responda",
          tone: "care",
        },
      ],
    });

    expect(result.aura?.observations).toEqual(["Sinal agregado"]);
    expect(result.recommendedActions[0]?.href).toBe(routes.therapist.profile);
    expect(result.recommendedActions[1]?.href).toBe(routes.therapist.reviews);
  });
});

function emptyAuraPage(): TherapistAuraPageData {
  return {
    contractVersion: 1,
    dismissals: [],
    meta: {
      computedAt: "2026-08-23T12:00:00.000Z",
      freshThrough: "2026-08-23T12:00:00.000Z",
      periodDays: 30,
      periodEnd: "2026-08-23T03:00:00.000Z",
      periodStart: "2026-07-24T03:00:00.000Z",
      previousPeriodEnd: "2026-07-24T03:00:00.000Z",
      previousPeriodStart: "2026-06-24T03:00:00.000Z",
      timezone: "America/Sao_Paulo",
    },
    recommendations: [],
    ruleRegistryVersion: 1,
    signals: {
      bookingReadiness: {
        publicBookableServices: 0,
        servicesWithFutureAvailability: 0,
        status: "empty",
        windowDays: 14,
      },
      continuity: { returnRate: insufficientRate() },
      reviews: { pendingReplyCount: 0, status: "empty", windowDays: 30 },
      sessions: {
        cancellationRate: insufficientRate(),
        noShowRate: insufficientRate(),
      },
    },
    therapist: { plan: "premium_plus", profileId: "therapist-1" },
  };
}

function insufficientRate() {
  return {
    direction: null,
    minimumSample: 10 as const,
    observedSample: 0,
    previousValue: null,
    status: "insufficient_sample" as const,
    unit: "percent" as const,
    value: null,
  };
}
