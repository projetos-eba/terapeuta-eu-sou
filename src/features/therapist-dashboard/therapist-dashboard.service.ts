import "server-only";

import { cache } from "react";

import { TherapistPlan } from "@/domain/tes";
import {
  getTherapistAgendaPage,
  getTherapistCalendar,
} from "@/features/therapist-agenda";
import { getTherapistAuraPage } from "@/features/therapist-aura/therapist-aura.service";
import { getTherapistMetricsPage } from "@/features/therapist-metrics/therapist-metrics.service";
import { getTherapistReviewsPage } from "@/features/therapist-reviews/therapist-reviews.service";
import { getTherapistSessionsPage } from "@/features/therapist-sessions/therapist-sessions.service";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import {
  calculateTrend,
  buildTherapistWeekSummary,
  createUnavailableTherapistWeek,
  mapUpcomingTherapistSessions,
} from "./therapist-dashboard.mappers";
import { createEmptyTherapistDashboardData } from "./therapist-dashboard-empty";
import {
  mapTherapistDashboardResponse,
  mapTherapistAuraPage,
} from "./therapist-dashboard.mappers";
import { queryTherapistDashboard } from "./therapist-dashboard.queries";
import type {
  TherapistDashboardPageData,
  TherapistDashboardQueryInput,
} from "./therapist-dashboard.types";

export const getTherapistDashboardPage = cache(
  async function getTherapistDashboardPage({
    profileId,
    accessToken,
    avatarUrl,
    name,
    plan,
    profileCompleteness,
  }: TherapistDashboardQueryInput): Promise<TherapistDashboardPageData> {
    if (plan !== TherapistPlan.PremiumPlus) {
      const base = await getTherapistBaseDashboardPage({
        accessToken,
        avatarUrl,
        name,
        plan,
        profileCompleteness,
        profileId,
      });

      if (plan === TherapistPlan.Premium) {
        return enrichPremiumDashboard(base, accessToken, profileId);
      }

      return base;
    }

    const [dashboard, auraResult, timeline] = await Promise.all([
      queryTherapistDashboard(accessToken),
      getTherapistAuraPage({
        accessToken,
        periodDays: 30,
        profileId,
      }),
      getTherapistDashboardTimeline({ accessToken, profileId }),
    ]);
    const main = mapTherapistDashboardResponse(dashboard);

    if (main.therapist.profileId !== profileId) {
      throw new TherapistDashboardError("forbidden");
    }

    const recommendations = auraResult.ok
      ? mapTherapistAuraPage(auraResult.data)
      : {
          aura: null,
          auraState: "unavailable" as const,
          recommendedActions: [],
        };

    return {
      ...main,
      ...recommendations,
      upcomingSessions: timeline.upcomingSessions,
      upcomingSessionsState: timeline.upcomingSessionsState,
      week: timeline.week,
    };
  },
);

async function getTherapistBaseDashboardPage({
  accessToken,
  avatarUrl,
  name,
  plan,
  profileCompleteness,
  profileId,
}: TherapistDashboardQueryInput): Promise<TherapistDashboardPageData> {
  const now = new Date();
  const previousMonthStart = startOfMonth(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  );
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 90);

  const result = await getTherapistSessionsPage({
    accessToken,
    filters: {
      limit: 100,
      periodEnd: rangeEnd.toISOString(),
      periodStart: previousMonthStart.toISOString(),
    },
    profileId,
  });

  if (result.status === "error") {
    throw new TherapistDashboardError("unavailable");
  }

  const sessions = result.status === "success" ? result.data.items : [];
  const currentMonthStart = startOfMonth(now);
  const currentMonthSessions = sessions.filter(
    (session) =>
      session.startsAt >= currentMonthStart.toISOString() &&
      isCountedSession(session.bookingStatus),
  );
  const previousMonthSessions = sessions.filter(
    (session) =>
      session.startsAt >= previousMonthStart.toISOString() &&
      session.startsAt < currentMonthStart.toISOString() &&
      isCountedSession(session.bookingStatus),
  );
  const todayKey = dateKeyInTimezone(
    now.toISOString(),
    sessions[0]?.timezone ?? "America/Sao_Paulo",
  );
  const todaySessions = sessions.filter(
    (session) =>
      dateKeyInTimezone(
        session.startsAt,
        session.timezone ?? "America/Sao_Paulo",
      ) === todayKey &&
      isActiveSession(session.bookingStatus),
  );
  const timeline = await getTherapistDashboardTimeline({
    accessToken,
    profileId,
  });

  return {
    attentionItems: [
      {
        href: "/terapeuta/agenda",
        id: "base-dashboard-agenda",
        label: sessions.length
          ? "Acompanhe seus próximos horários na agenda"
          : "Configure sua agenda para começar a receber reservas",
        tone: "info",
      },
      {
        href: "/terapeuta/perfil",
        id: "base-dashboard-profile",
        label: `Seu perfil está ${profileCompleteness}% completo`,
        tone: profileCompleteness < 100 ? "warning" : "info",
      },
    ],
    aura: null,
    auraState: "empty",
    history: {
      activePatients: 0,
      averageRating: null,
      completedSessions: sessions.filter(
        (session) => session.bookingStatus === "completed",
      ).length,
    },
    kpis: {
      activePatients: emptyKpi(),
      monthlyNetRevenueCents: emptyKpi(),
      monthlySessions: {
        trend: calculateTrend(
          currentMonthSessions.length,
          previousMonthSessions.length,
        ),
        value: currentMonthSessions.length,
      },
      profileViews: emptyKpi(),
    },
    recentReviews: [],
    recommendedActions: [],
    therapist: {
      avatarUrl,
      name,
      plan,
      profileCompleteness,
      profileId,
    },
    today: {
      newConnections: 0,
      pendingPayments: 0,
      pendingReviewReplies: 0,
      reservedMinutesToday: todaySessions.reduce(
        (total, session) => total + session.durationMinutes,
        0,
      ),
      rescheduleRequests: 0,
      sessionsToday: todaySessions.length,
    },
    unreadMessagesCount: 0,
    unreadNotificationsCount: 0,
    upcomingSessions: timeline.upcomingSessions,
    upcomingSessionsState: timeline.upcomingSessionsState,
    week: timeline.week,
  };
}

async function getTherapistDashboardTimeline({
  accessToken,
  profileId,
}: {
  accessToken: string;
  profileId: string;
}) {
  const now = new Date();
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 90);

  const [calendarResult, agendaResult] = await Promise.all([
    getTherapistCalendar({
      accessToken,
      profileId,
      view: "week",
    }),
    getTherapistAgendaPage({
      accessToken,
      profileId,
      rangeEnd: rangeEnd.toISOString(),
      rangeStart: now.toISOString(),
    }),
  ]);

  const week =
    calendarResult.status === "success"
      ? buildTherapistWeekSummary(calendarResult.data.bookings, {
          localStart: calendarResult.data.range.localStart,
          timezone: calendarResult.data.timezone,
        })
      : createUnavailableTherapistWeek();

  const upcomingSessions =
    agendaResult.status === "success"
      ? mapUpcomingTherapistSessions(agendaResult.data.bookings, now)
      : [];

  return {
    upcomingSessions,
    upcomingSessionsState:
      agendaResult.status === "error"
        ? ("unavailable" as const)
        : upcomingSessions.length
          ? ("ready" as const)
          : ("empty" as const),
    week,
  };
}

async function enrichPremiumDashboard(
  base: TherapistDashboardPageData,
  accessToken: string,
  profileId: string,
) {
  const [reviewsResult, metricsResult] = await Promise.all([
    getTherapistReviewsPage({ accessToken, profileId }),
    getTherapistMetricsPage({
      accessToken,
      periodDays: 30,
      profileId,
    }),
  ]);

  const reviews =
    reviewsResult.status === "success" ? reviewsResult.data : null;
  const metrics =
    metricsResult.status === "success" ? metricsResult.data : null;

  return {
    ...base,
    history: {
      ...base.history,
      averageRating: reviews?.metrics.averageRating ?? null,
    },
    kpis: {
      ...base.kpis,
      profileViews: metrics
        ? {
            trend: calculateTrend(
              metrics.discovery.stages.profileViews.value,
              metrics.discovery.stages.profileViews.previousValue ?? 0,
            ),
            value: metrics.discovery.stages.profileViews.value,
          }
        : base.kpis.profileViews,
    },
    recentReviews:
      reviews?.reviews.slice(0, 3).map((review, index) => ({
        comment: review.comment,
        id: review.id,
        patientInitial: review.patientInitials.slice(0, 1),
        patientName: review.patientName,
        publishedAt:
          review.publishedAt ??
          new Date(Date.now() - index * 86400000).toISOString(),
        rating: review.rating,
      })) ?? [],
    today: {
      ...base.today,
      pendingReviewReplies: reviews?.metrics.pendingReplies ?? 0,
    },
  };
}

function emptyKpi() {
  return {
    trend: { direction: "flat" as const, percent: 0 },
    value: 0,
  };
}

function isActiveSession(status: string) {
  return ["confirmed", "completed"].includes(status);
}

function isCountedSession(status: string) {
  return ![
    "draft",
    "pending_payment",
    "cancelled_by_patient",
    "cancelled_by_therapist",
    "refunded",
  ].includes(status);
}

function startOfMonth(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function dateKeyInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
