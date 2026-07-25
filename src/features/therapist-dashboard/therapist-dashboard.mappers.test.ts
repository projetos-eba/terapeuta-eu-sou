import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";

import {
  calculateAttendanceRate,
  calculateRevenueCents,
  calculateTrend,
  mapTherapistDashboardResponse,
  mapTherapistRecommendations,
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
    const result = mapTherapistRecommendations([
      {
        body: "Sinal agregado",
        context: { kind: "observation" },
        id: "1",
        source_rule_key: "signal",
        title: "Sinal",
      },
      {
        body: "Ação segura",
        context: { action_href: "/plus/perfil", kind: "action" },
        id: "2",
        source_rule_key: "action",
        title: "Atualize",
      },
    ]);

    expect(result.aura?.observations).toEqual(["Sinal agregado"]);
    expect(result.recommendedActions[0]?.href).toBe(routes.therapist.profile);
  });
});
