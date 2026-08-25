import { routes } from "@/lib/routes";
import type { AuthenticatedTherapistSession } from "@/lib/auth/therapist-session";

import type { TherapistDashboardPageData } from "./therapist-dashboard.types";
import type { TherapistHomeReadiness } from "./therapist-home-readiness.types";

export function createEmptyTherapistDashboardData({
  readiness,
  session,
}: {
  readiness: TherapistHomeReadiness;
  session: Pick<
    AuthenticatedTherapistSession,
    "avatarUrl" | "name" | "plan" | "profileId"
  >;
}): TherapistDashboardPageData {
  return {
    attentionItems: [
      {
        href: routes.therapist.agenda,
        id: "empty-dashboard-agenda",
        label: "Acompanhe sua agenda conforme as reservas chegarem",
        tone: "info",
      },
      {
        href: routes.therapist.profile,
        id: "empty-dashboard-profile",
        label: "Mantenha seu perfil público atualizado",
        tone: "info",
      },
    ],
    aura: null,
    auraState: "empty",
    history: {
      activePatients: 0,
      averageRating: null,
      completedSessions: 0,
    },
    kpis: {
      activePatients: emptyKpi(),
      monthlyNetRevenueCents: emptyKpi(),
      monthlySessions: emptyKpi(),
      profileViews: emptyKpi(),
    },
    recentReviews: [],
    recommendedActions: [
      {
        body: "Quando suas primeiras reservas chegarem, acompanhe horários, pagamentos e avaliações por aqui.",
        href: routes.therapist.agenda,
        id: "first-bookings",
        title: "Seu painel já está pronto para os primeiros movimentos",
      },
    ],
    therapist: {
      avatarUrl: session.avatarUrl,
      name: session.name,
      plan: session.plan,
      profileCompleteness: readiness.profileCompleteness,
      profileId: session.profileId,
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
    upcomingSessions: [],
    upcomingSessionsState: "empty",
    week: {
      attendanceRate: 0,
      days: currentWeekDays(),
      rangeLabel: "Primeira semana",
      state: "empty",
    },
  };
}

function emptyKpi() {
  return {
    trend: {
      direction: "flat" as const,
      percent: 0,
    },
    value: 0,
  };
}

function currentWeekDays() {
  const start = startOfWeek(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      cancelled: 0,
      completed: 0,
      date: date.toISOString().slice(0, 10),
      label: dayLabels[index] ?? "",
      scheduled: 0,
    };
  });
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

const dayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
