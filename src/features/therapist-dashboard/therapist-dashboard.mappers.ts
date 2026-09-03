import { TherapistPlan } from "@/domain/tes";
import type { SessionReadModelItem } from "@/features/bookings";
import { getCanonicalTherapistPath } from "@/features/therapist-shell/therapist-route-policy";
import { routes } from "@/lib/routes";

import type { TherapistAuraPageData } from "../therapist-aura/therapist-aura.types";
import { TherapistDashboardError } from "./therapist-dashboard.errors";
import type {
  TherapistDashboardKpi,
  TherapistDashboardPageData,
  TherapistDashboardTrend,
} from "./therapist-dashboard.types";

const SCHEDULED_BOOKING_STATUSES = new Set([
  "confirmed",
  "completed",
  "no_show_patient",
  "no_show_therapist",
]);

const CANCELLED_BOOKING_STATUSES = new Set([
  "cancelled_by_patient",
  "cancelled_by_therapist",
  "refunded",
]);

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

export function buildTherapistWeekSummary(
  bookings: SessionReadModelItem[],
  input: { localStart: string; timezone: string },
): TherapistDashboardPageData["week"] {
  const start = input.localStart.slice(0, 10);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDateKey(start, index);
    const dayBookings = bookings.filter(
      (booking) => dateKeyInTimezone(booking.startsAt, input.timezone) === date,
    );

    return {
      cancelled: dayBookings.filter((booking) =>
        CANCELLED_BOOKING_STATUSES.has(booking.bookingStatus),
      ).length,
      completed: dayBookings.filter(
        (booking) => booking.bookingStatus === "completed",
      ).length,
      date,
      label: formatWeekdayLabel(date),
      scheduled: dayBookings.filter((booking) =>
        SCHEDULED_BOOKING_STATUSES.has(booking.bookingStatus),
      ).length,
    };
  });

  const completed = bookings.filter(
    (booking) => booking.bookingStatus === "completed",
  ).length;
  const noShows = bookings.filter((booking) =>
    ["no_show_patient", "no_show_therapist"].includes(booking.bookingStatus),
  ).length;

  return {
    attendanceRate: calculateAttendanceRate(completed, noShows),
    days,
    rangeLabel: `${formatDateKey(start)} – ${formatDateKey(addDateKey(start, 6))}`,
    state: days.some((day) => day.cancelled || day.completed || day.scheduled)
      ? "ready"
      : "empty",
  };
}

export function mapUpcomingTherapistSessions(
  bookings: SessionReadModelItem[],
  now: Date,
) {
  return bookings
    .filter(
      (booking) =>
        booking.bookingStatus === "confirmed" &&
        new Date(booking.startsAt).getTime() >= now.getTime(),
    )
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() -
        new Date(second.startsAt).getTime(),
    )
    .slice(0, 4)
    .map((booking) => ({
      bookingId: booking.bookingId,
      patientAvatarUrl: booking.patientAvatarUrl,
      patientName: booking.patientName,
      serviceTitle: booking.serviceTitle,
      sessionReference: booking.sessionReference,
      startsAt: booking.startsAt,
      timezone: booking.timezone,
    }));
}

export function createUnavailableTherapistWeek(): TherapistDashboardPageData["week"] {
  return {
    attendanceRate: 0,
    days: [],
    rangeLabel: "Semana atual",
    state: "unavailable",
  };
}

export function mapTherapistDashboardResponse(
  value: unknown,
): Omit<
  TherapistDashboardPageData,
  "aura" | "auraState" | "recommendedActions"
> {
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
        href: getCanonicalTherapistPath(
          string(row.href, routes.therapist.home),
        ),
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
        sessionReference: string(row.sessionReference),
        startsAt: string(row.startsAt),
        timezone: string(row.timezone, "America/Sao_Paulo"),
      };
    }),
    upcomingSessionsState: "ready",
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
      state: "ready",
    },
  };
}

export function mapTherapistAuraPage(
  auraPage: TherapistAuraPageData,
): Pick<
  TherapistDashboardPageData,
  "aura" | "auraState" | "recommendedActions"
> {
  const observations: string[] = [];
  const suggestions: string[] = [];
  const actions: TherapistDashboardPageData["recommendedActions"] = [];

  for (const recommendation of auraPage.recommendations) {
    if (recommendation.tone === "attention") {
      observations.push(recommendation.body);
    } else {
      suggestions.push(recommendation.body);
    }

    actions.push({
      body: recommendation.body,
      href: getCanonicalTherapistPath(recommendation.actionHref),
      id: recommendation.id,
      title: recommendation.title,
    });
  }

  return {
    aura: auraPage.recommendations.length
      ? {
          computedAt: auraPage.meta.computedAt,
          observations,
          periodDays: auraPage.meta.periodDays,
          suggestions,
        }
      : null,
    auraState: auraPage.recommendations.length ? "ready" : "empty",
    recommendedActions: actions,
  };
}

export function reconcileTherapistDashboardProfile({
  data,
  profileCompleteness,
}: {
  data: TherapistDashboardPageData;
  profileCompleteness: number;
}): TherapistDashboardPageData {
  const canonicalProfileCompleteness = Math.min(
    100,
    Math.max(0, Math.round(profileCompleteness)),
  );

  return {
    ...data,
    attentionItems: data.attentionItems
      .map((item) => {
        const routedItem = {
          ...item,
          href: resolveTherapistAttentionItemHref(item, data.therapist.plan),
        };

        if (!isProfileAttentionItem(routedItem)) return routedItem;

        const tone: TherapistDashboardPageData["attentionItems"][number]["tone"] =
          canonicalProfileCompleteness < 100 ? "warning" : "info";

        return {
          ...routedItem,
          label: `Perfil ${canonicalProfileCompleteness}% completo`,
          tone,
        };
      })
      .filter(
        (item) =>
          !isProfileAttentionItem(item) || canonicalProfileCompleteness < 100,
      ),
    therapist: {
      ...data.therapist,
      profileCompleteness: canonicalProfileCompleteness,
    },
  };
}

export function resolveTherapistAttentionItemHref(
  item: TherapistDashboardPageData["attentionItems"][number],
  plan: TherapistPlan,
) {
  if (
    item.id === "profile-completeness" ||
    item.id === "base-dashboard-profile"
  ) {
    return routes.therapist.profile;
  }

  if (item.id === "pending-payments") {
    return routes.therapist.sessions;
  }

  if (item.id === "reschedule-requests") {
    return routes.therapist.agenda;
  }

  if (item.id === "pending-confirmations") {
    return plan === TherapistPlan.Free
      ? `${routes.therapist.sessions}?period=all#pending-confirmations`
      : `${routes.therapist.reviews}?tab=session#pending-session-confirmations`;
  }

  if (item.id === "base-dashboard-agenda") {
    return routes.therapist.agenda;
  }

  return getCanonicalTherapistPath(item.href);
}

function isProfileAttentionItem(
  item: TherapistDashboardPageData["attentionItems"][number],
) {
  return (
    item.id === "profile-completeness" || item.id === "base-dashboard-profile"
  );
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

function addDateKey(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatWeekdayLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "")
    .toUpperCase();
}
