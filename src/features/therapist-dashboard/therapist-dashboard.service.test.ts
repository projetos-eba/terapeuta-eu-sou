import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TherapistPlan } from "@/domain/tes";

const auraPageMock = vi.hoisted(() => vi.fn());
const pendingConfirmationsMock = vi.hoisted(() => vi.fn());
const queryDashboardMock = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/features/therapist-agenda", () => ({
  getTherapistAgendaPage: vi.fn().mockResolvedValue({ status: "error" }),
  getTherapistCalendar: vi.fn().mockResolvedValue({ status: "error" }),
}));

vi.mock("@/features/therapist-aura/therapist-aura.service", () => ({
  getTherapistAuraPage: auraPageMock,
}));

vi.mock("@/features/therapist-metrics/therapist-metrics.service", () => ({
  getTherapistMetricsPage: vi.fn(),
}));

vi.mock("@/features/therapist-reviews/therapist-reviews.service", () => ({
  getTherapistReviewsPage: vi.fn(),
}));

vi.mock("@/features/therapist-sessions/therapist-sessions.service", () => ({
  getTherapistPendingConfirmationsSummary: pendingConfirmationsMock,
  getTherapistSessionsPage: vi.fn(),
}));

vi.mock("./therapist-dashboard.queries", () => ({
  queryTherapistDashboard: queryDashboardMock,
}));

vi.mock("./therapist-dashboard.mappers", () => ({
  buildTherapistWeekSummary: vi.fn(),
  calculateTrend: vi.fn(),
  createUnavailableTherapistWeek: () => ({
    attendanceRate: 0,
    days: [],
    rangeLabel: "",
    state: "unavailable",
  }),
  mapUpcomingTherapistSessions: vi.fn(() => []),
  mapTherapistAuraPage: vi.fn(),
  mapTherapistDashboardResponse: () => dashboardFixture(),
  reconcileTherapistDashboardProfile: ({ data }: { data: unknown }) => data,
}));

import { getTherapistDashboardPage } from "./therapist-dashboard.service";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getTherapistDashboardPage", () => {
  beforeEach(() => {
    pendingConfirmationsMock.mockResolvedValue({
      data: {
        generatedAt: "2026-09-03T12:00:00.000Z",
        pendingBookingIds: [],
        pendingSessions: [],
        pendingCount: 0,
        therapistProfileId: "profile-id",
        version: 1,
      },
      status: "success",
    });
  });

  it("does not execute Aura reads for Premium Plus while the launch is disabled", async () => {
    vi.stubEnv("AURA_ENABLED", "false");
    queryDashboardMock.mockResolvedValue({});

    const data = await getTherapistDashboardPage({
      accessToken: "token",
      avatarUrl: null,
      name: "Ana",
      plan: TherapistPlan.PremiumPlus,
      profileCompleteness: 100,
      profileId: "profile-id",
    });

    expect(auraPageMock).not.toHaveBeenCalled();
    expect(data.auraState).toBe("disabled");
    expect(data.recommendedActions).toEqual([]);
  });

  it("restores the Aura read for Premium Plus when the launch is enabled", async () => {
    vi.stubEnv("AURA_ENABLED", "true");
    queryDashboardMock.mockResolvedValue({});
    auraPageMock.mockResolvedValue({
      code: "unavailable",
      message: "Indisponível.",
      ok: false,
    });

    await getTherapistDashboardPage({
      accessToken: "token",
      avatarUrl: null,
      name: "Ana",
      plan: TherapistPlan.PremiumPlus,
      profileCompleteness: 100,
      profileId: "profile-id",
    });

    expect(auraPageMock).toHaveBeenCalledWith({
      accessToken: "token",
      periodDays: 30,
      plan: TherapistPlan.PremiumPlus,
      profileId: "profile-id",
    });
  });

  it("adds pending confirmations to the Premium Plus attention items", async () => {
    vi.stubEnv("AURA_ENABLED", "false");
    queryDashboardMock.mockResolvedValue({});
    pendingConfirmationsMock.mockResolvedValue({
      data: {
        generatedAt: "2026-09-03T12:00:00.000Z",
        pendingBookingIds: ["booking-1", "booking-2"],
        pendingSessions: [
          { bookingId: "booking-1", sessionReference: "26S000001" },
          { bookingId: "booking-2", sessionReference: "26S000002" },
        ],
        pendingCount: 2,
        therapistProfileId: "profile-id",
        version: 1,
      },
      status: "success",
    });

    const data = await getTherapistDashboardPage({
      accessToken: "token",
      avatarUrl: null,
      name: "Ana",
      plan: TherapistPlan.PremiumPlus,
      profileCompleteness: 100,
      profileId: "profile-id",
    });

    expect(data.attentionItems).toContainEqual({
      count: 2,
      href: "/terapeuta/sessoes",
      id: "pending-confirmations",
      label: "Confirmações pendentes",
      tone: "warning",
    });
  });
});

function dashboardFixture() {
  return {
    attentionItems: [],
    aura: null,
    auraState: "empty" as const,
    history: {
      activePatients: 0,
      averageRating: null,
      completedSessions: 0,
    },
    kpis: {
      activePatients: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      monthlyNetRevenueCents: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      monthlySessions: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
      profileViews: {
        trend: { direction: "flat" as const, percent: 0 },
        value: 0,
      },
    },
    recentReviews: [],
    recommendedActions: [
      { body: "", href: "/terapeuta/agenda", id: "action", title: "" },
    ],
    therapist: {
      avatarUrl: null,
      name: "Ana",
      plan: TherapistPlan.PremiumPlus,
      profileCompleteness: 100,
      profileId: "profile-id",
    },
    today: {
      newConnections: 0,
      pendingPayments: 0,
      pendingReviewReplies: 0,
      reservedMinutesToday: 0,
      rescheduleRequests: 0,
      sessionsToday: 0,
    },
    unreadMessagesCount: 0,
    unreadNotificationsCount: 0,
  };
}
