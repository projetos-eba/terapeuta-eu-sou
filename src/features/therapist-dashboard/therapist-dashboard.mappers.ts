import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import type {
  AuraRecommendationRow,
  TherapistDashboardKpi,
  TherapistDashboardPageData,
  TherapistDashboardTrend,
} from "./therapist-dashboard.types";

export function calculateAttendanceRate(completed: number, noShows: number) {
  const denominator = completed + noShows;
  return denominator === 0 ? 0 : Math.round((completed / denominator) * 100);
}

export function calculateTrend(
  current: number,
  previous: number,
): TherapistDashboardTrend {
  if (previous === 0) {
    return {
      direction: current === 0 ? "flat" : "up",
      percent: current === 0 ? 0 : null,
    };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
    percent: Math.abs(percent),
  };
}

export function calculateRevenueCents(
  payments: Array<{ netAmountCents: number; status: string }>,
) {
  return payments
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => total + payment.netAmountCents, 0);
}

export function mapTherapistDashboardResponse(
  value: unknown,
): Omit<TherapistDashboardPageData, "aura" | "recommendedActions"> {
  if (!isRecord(value)) throw new TherapistDashboardError("invalid_response");

  const therapist = record(value.therapist);
  const today = record(value.today);
  const week = record(value.week);
  const kpis = record(value.kpis);
  const history = record(value.history);
  const plan = string(therapist.plan);

  if (
    plan !== TherapistPlan.Free &&
    plan !== TherapistPlan.Premium &&
    plan !== TherapistPlan.PremiumPlus
  ) {
    throw new TherapistDashboardError("invalid_response");
  }

  return {
    attentionItems: array(value.attentionItems).map((item, index) => {
      const row = record(item);
      return {
        count: optionalNumber(row.count),
        href: string(row.href, routes.therapist.plusHome),
        id: string(row.id, `attention-${index}`),
        label: string(row.label, "Item de atenção"),
        tone: row.tone === "warning" ? "warning" : "info",
      };
    }),
    history: {
      activePatients: number(history.activePatients),
      averageRating: nullableNumber(history.averageRating),
      completedSessions: number(history.completedSessions),
    },
    kpis: {
      activePatients: mapKpi(kpis.activePatients),
      monthlyNetRevenueCents: mapKpi(kpis.monthlyNetRevenueCents),
      monthlySessions: mapKpi(kpis.monthlySessions),
      profileViews: mapKpi(kpis.profileViews),
    },
    recentReviews: array(value.recentReviews).map((item, index) => {
      const row = record(item);
      const patientName = string(row.patientName, "Paciente");
      return {
        comment: string(row.comment),
        id: string(row.id, `review-${index}`),
        patientInitial: string(row.patientInitial, patientName.slice(0, 1)),
        patientName,
        publishedAt: string(row.publishedAt),
        rating: number(row.rating),
      };
    }),
    therapist: {
      avatarUrl: nullableString(therapist.avatarUrl),
      name: string(therapist.name, "Terapeuta"),
      plan,
      profileCompleteness: number(therapist.profileCompleteness),
      profileId: string(therapist.profileId),
    },
    today: {
      newConnections: number(today.newConnections),
      pendingPayments: number(today.pendingPayments),
      pendingReviewReplies: number(today.pendingReviewReplies),
      reservedMinutesToday: number(today.reservedMinutesToday),
      rescheduleRequests: number(today.rescheduleRequests),
      sessionsToday: number(today.sessionsToday),
    },
    unreadMessagesCount: number(value.unreadMessagesCount),
    unreadNotificationsCount: number(value.unreadNotificationsCount),
    upcomingSessions: array(value.upcomingSessions).map((item) => {
      const row = record(item);
      return {
        bookingId: string(row.bookingId),
        patientAvatarUrl: nullableString(row.patientAvatarUrl),
        patientName: string(row.patientName, "Paciente"),
        serviceTitle: string(row.serviceTitle, "Sessão"),
        startsAt: string(row.startsAt),
      };
    }),
    week: {
      attendanceRate: number(week.attendanceRate),
      days: array(week.days).map((item) => {
        const row = record(item);
        return {
          cancelled: number(row.cancelled),
          completed: number(row.completed),
          date: string(row.date),
          label: string(row.label),
          scheduled: number(row.scheduled),
        };
      }),
      rangeLabel: string(week.rangeLabel),
    },
  };
}

export function mapTherapistRecommendations(rows: AuraRecommendationRow[]) {
  const observations: string[] = [];
  const suggestions: string[] = [];
  const actions: TherapistDashboardPageData["recommendedActions"] = [];

  for (const row of rows) {
    const context = record(row.context);
    const kind = string(context.kind, "suggestion");

    if (kind === "observation") {
      observations.push(row.body);
    } else if (kind === "action") {
      actions.push({
        body: row.body,
        href: string(context.action_href, routes.therapist.plusProfile),
        id: row.id,
        title: row.title,
      });
    } else {
      suggestions.push(row.body);
    }
  }

  return {
    aura:
      observations.length || suggestions.length
        ? { observations, suggestions }
        : null,
    recommendedActions: actions,
  };
}

function mapKpi(value: unknown): TherapistDashboardKpi {
  const row = record(value);
  const trend = record(row.trend);
  const direction: TherapistDashboardTrend["direction"] =
    trend.direction === "up" || trend.direction === "down"
      ? trend.direction
      : "flat";

  return {
    trend: {
      direction,
      percent: nullableNumber(trend.percent),
    },
    value: number(row.value),
  };
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
