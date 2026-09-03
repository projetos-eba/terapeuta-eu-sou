import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";
import type { SessionReadModelItem } from "@/features/bookings";
import { routes } from "@/lib/routes";

import type { TherapistAuraPageData } from "../therapist-aura/therapist-aura.types";
import {
  calculateAttendanceRate,
  calculateRevenueCents,
  calculateTrend,
  buildTherapistWeekSummary,
  mapUpcomingTherapistSessions,
  mapTherapistDashboardResponse,
  mapTherapistAuraPage,
  reconcileTherapistDashboardProfile,
  resolveTherapistAttentionItemHref,
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

  it("counts the weekly series using the calendar timezone", () => {
    const summary = buildTherapistWeekSummary(
      [
        session({
          bookingStatus: "completed",
          startsAt: "2026-08-24T03:30:00.000Z",
        }),
        session({
          bookingStatus: "no_show_patient",
          startsAt: "2026-08-25T15:00:00.000Z",
        }),
        session({
          bookingStatus: "cancelled_by_patient",
          startsAt: "2026-08-31T02:30:00.000Z",
        }),
      ],
      { localStart: "2026-08-24", timezone: "America/Sao_Paulo" },
    );

    expect(summary.days[0]).toMatchObject({
      completed: 1,
      scheduled: 1,
    });
    expect(summary.days[1]).toMatchObject({ scheduled: 1 });
    expect(summary.days[6]).toMatchObject({ cancelled: 1 });
    expect(summary.attendanceRate).toBe(50);
    expect(summary.rangeLabel).toBe("24/08 – 30/08");
  });

  it("orders the closest confirmed upcoming sessions independently of query order", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    const result = mapUpcomingTherapistSessions(
      [
        session({
          bookingId: "booking-later",
          startsAt: "2026-08-27T12:00:00.000Z",
        }),
        session({
          bookingId: "booking-soon",
          startsAt: "2026-08-25T13:00:00.000Z",
        }),
        session({
          bookingId: "booking-past",
          startsAt: "2026-08-25T11:00:00.000Z",
        }),
      ],
      now,
    );

    expect(result.map((item) => item.bookingId)).toEqual([
      "booking-soon",
      "booking-later",
    ]);
    expect(result[0]?.timezone).toBe("America/Sao_Paulo");
    expect(result[0]?.sessionReference).toBe("26G000001");
  });
});

describe("dashboard mapper", () => {
  it.each([
    ["free", "/terapeuta/sessoes?period=all#pending-confirmations"],
    [
      "premium",
      "/terapeuta/avaliacoes?tab=session#pending-session-confirmations",
    ],
    [
      "premium_plus",
      "/terapeuta/avaliacoes?tab=session#pending-session-confirmations",
    ],
  ] as const)("routes pending confirmations for %s", (plan, expectedHref) => {
    expect(
      resolveTherapistAttentionItemHref(
        {
          count: 1,
          href: routes.therapist.sessions,
          id: "pending-confirmations",
          label: "Confirmações pendentes",
          tone: "warning",
        },
        plan,
      ),
    ).toBe(expectedHref);
  });

  it("keeps legacy attention hrefs on their canonical destinations", () => {
    expect(
      resolveTherapistAttentionItemHref(
        {
          href: "/plus/perfil",
          id: "profile-completeness",
          label: "Perfil 40% completo",
          tone: "warning",
        },
        TherapistPlan.PremiumPlus,
      ),
    ).toBe(routes.therapist.profile);
    expect(
      resolveTherapistAttentionItemHref(
        {
          href: "/plus/agenda",
          id: "reschedule-requests",
          label: "Pedidos de reagendamento",
          tone: "warning",
        },
        TherapistPlan.PremiumPlus,
      ),
    ).toBe(routes.therapist.agenda);
  });

  it("uses the canonical profile readiness when the dashboard RPC is stale", () => {
    const result = reconcileTherapistDashboardProfile({
      data: {
        ...mapTherapistDashboardResponse({
          attentionItems: [
            {
              id: "profile-completeness",
              label: "Perfil 40% concluído",
              href: "/plus/perfil",
              tone: "info",
            },
          ],
          history: {},
          kpis: {},
          recentReviews: [],
          therapist: {
            name: "Vinicius Terapeuta Premium",
            plan: "premium_plus",
            profileCompleteness: 40,
            profileId: "therapist-1",
          },
          today: {},
          unreadMessagesCount: 0,
          unreadNotificationsCount: 0,
          upcomingSessions: [],
          week: { days: [], rangeLabel: "" },
        }),
        aura: null,
        auraState: "empty",
        recommendedActions: [],
      },
      profileCompleteness: 100,
    });

    expect(result.therapist.profileCompleteness).toBe(100);
    expect(result.attentionItems).toEqual([]);
  });

  it("rewrites an incomplete profile attention item with canonical readiness", () => {
    const result = reconcileTherapistDashboardProfile({
      data: {
        ...mapTherapistDashboardResponse({
          attentionItems: [
            {
              id: "profile-completeness",
              label: "Perfil 40% concluído",
              href: "/plus/perfil",
              tone: "info",
            },
          ],
          history: {},
          kpis: {},
          recentReviews: [],
          therapist: {
            name: "Terapeuta",
            plan: "premium_plus",
            profileCompleteness: 40,
            profileId: "therapist-1",
          },
          today: {},
          unreadMessagesCount: 0,
          unreadNotificationsCount: 0,
          upcomingSessions: [],
          week: { days: [], rangeLabel: "" },
        }),
        aura: null,
        auraState: "empty",
        recommendedActions: [],
      },
      profileCompleteness: 60,
    });

    expect(result.therapist.profileCompleteness).toBe(60);
    expect(result.attentionItems[0]).toMatchObject({
      label: "Perfil 60% completo",
      tone: "warning",
    });
  });

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

function session(
  overrides: Partial<SessionReadModelItem> = {},
): SessionReadModelItem {
  return {
    attendanceSource: "none",
    attendanceStatus: "unknown",
    bookingId: "booking-default",
    sessionReference: "26G000001",
    bookingStatus: "confirmed",
    bookingVersion: 1,
    cancellationDecision: null,
    cancellationRequiresReview: null,
    currency: "BRL",
    durationMinutes: 50,
    endsAt: "2026-08-25T14:00:00.000Z",
    financialStatus: "paid",
    fulfillmentStatus: null,
    grossAmountCents: 10000,
    videoSessionProvider: null,
    videoSessionStatus: null,
    modality: "online",
    patientAvatarUrl: null,
    patientName: "Pessoa TES",
    patientProfileId: "patient-1",
    priceCents: 10000,
    proposedEndsAt: null,
    proposedStartsAt: null,
    proposedTimezone: null,
    refundPending: null,
    rescheduleStatus: null,
    serviceId: "service-1",
    serviceTitle: "Terapia online",
    startsAt: "2026-08-25T13:00:00.000Z",
    therapistAmountCents: 8000,
    timezone: "America/Sao_Paulo",
    transferStatus: null,
    zoomAccess: "not_available",
    ...overrides,
  } as SessionReadModelItem;
}
