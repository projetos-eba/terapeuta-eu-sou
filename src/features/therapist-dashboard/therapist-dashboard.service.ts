import "server-only";

import { cache } from "react";

import { TherapistPlan } from "@/domain/tes";
import { getTherapistMetricsPage } from "@/features/therapist-metrics/therapist-metrics.service";
import { getTherapistReviewsPage } from "@/features/therapist-reviews/therapist-reviews.service";
import {
  getTherapistSessionsPage,
} from "@/features/therapist-sessions/therapist-sessions.service";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import { calculateAttendanceRate, calculateTrend } from "./therapist-dashboard.mappers";
import { createEmptyTherapistDashboardData } from "./therapist-dashboard-empty";
import {
  mapTherapistDashboardResponse,
  mapTherapistRecommendations,
} from "./therapist-dashboard.mappers";
import {
  queryTherapistDashboard,
  queryTherapistRecommendations,
} from "./therapist-dashboard.queries";
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

    const [dashboard, recommendationResult] = await Promise.all([
      queryTherapistDashboard(accessToken),
      queryRecommendationsSafely(accessToken),
    ]);
    const main = mapTherapistDashboardResponse(dashboard);

    if (main.therapist.profileId !== profileId) {
      throw new TherapistDashboardError("forbidden");
    }

    const recommendations = recommendationResult
      ? mapTherapistRecommendations(recommendationResult)
      : { aura: null, recommendedActions: [] };

    return { ...main, ...recommendations };
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
  const currentWeekStart = startOfWeek(now);
  const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
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

  const sessions = result.data?.items ?? [];
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
  const weekSessions = sessions.filter((session) => {
    const dateKey = dateKeyInTimezone(session.startsAt);
    return dateKey >= dateKeyInTimezone(currentWeekStart.toISOString()) &&
      dateKey <= dateKeyInTimezone(addDays(currentWeekStart, 6).toISOString());
  });
  const todayKey = dateKeyInTimezone(now.toISOString());
  const todaySessions = sessions.filter(
    (session) =>
      dateKeyInTimezone(session.startsAt) === todayKey &&
      isActiveSession(session.bookingStatus),
  );
  const completed = weekSessions.filter(
    (session) => session.bookingStatus === "completed",
  ).length;
  const noShows = weekSessions.filter((session) =>
    ["no_show_patient", "no_show_therapist"].includes(session.bookingStatus),
  ).length;

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
    upcomingSessions: sessions
      .filter(
        (session) =>
          session.bookingStatus === "confirmed" &&
          new Date(session.startsAt).getTime() >= now.getTime(),
      )
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt))
      .slice(0, 4)
      .map((session) => ({
        bookingId: session.bookingId,
        patientAvatarUrl: session.patientAvatarUrl,
        patientName: session.patientName,
        serviceTitle: session.serviceTitle,
        startsAt: session.startsAt,
      })),
    week: {
      attendanceRate: calculateAttendanceRate(completed, noShows),
      days: Array.from({ length: 7 }, (_, index) => {
        const day = addDays(currentWeekStart, index);
        const key = dateKeyInTimezone(day.toISOString());
        const daySessions = weekSessions.filter(
          (session) => dateKeyInTimezone(session.startsAt) === key,
        );
        return {
          cancelled: daySessions.filter((session) =>
            [
              "cancelled_by_patient",
              "cancelled_by_therapist",
              "refunded",
            ].includes(session.bookingStatus),
          ).length,
          completed: daySessions.filter(
            (session) => session.bookingStatus === "completed",
          ).length,
          date: key,
          label: new Intl.DateTimeFormat("pt-BR", {
            weekday: "short",
          })
            .format(day)
            .replace(".", "")
            .toUpperCase(),
          scheduled: daySessions.filter((session) =>
            isScheduledSession(session.bookingStatus),
          ).length,
        };
      }),
      rangeLabel: `${formatShortDate(currentWeekStart)} – ${formatShortDate(
        addDays(currentWeekStart, 6),
      )}`,
    },
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

  const reviews = reviewsResult.status === "success" ? reviewsResult.data : null;
  const metrics = metricsResult.status === "success" ? metricsResult.data : null;

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
          review.publishedAt ?? new Date(Date.now() - index * 86400000).toISOString(),
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

function isScheduledSession(status: string) {
  return [
    "confirmed",
    "completed",
    "no_show_patient",
    "no_show_therapist",
  ].includes(status);
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function startOfMonth(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKeyInTimezone(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

async function queryRecommendationsSafely(accessToken: string) {
  try {
    return await queryTherapistRecommendations(accessToken);
  } catch {
    console.warn(
      "[therapist-dashboard] Aura recommendations are temporarily unavailable.",
    );
    return null;
  }
}
