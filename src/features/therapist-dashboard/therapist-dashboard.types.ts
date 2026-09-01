import type { TherapistPlan } from "@/domain/tes";

export type TherapistDashboardTrend = {
  direction: "down" | "flat" | "up";
  percent: number | null;
};

export type TherapistDashboardDataState = "empty" | "ready" | "unavailable";

export type TherapistDashboardKpi = {
  trend: TherapistDashboardTrend;
  value: number;
};

export type TherapistDashboardPageData = {
  attentionItems: Array<{
    count?: number;
    href: string;
    id: string;
    label: string;
    tone: "info" | "warning";
  }>;
  aura: null | {
    computedAt: string;
    observations: string[];
    periodDays: 30 | 90;
    suggestions: string[];
  };
  auraState: "disabled" | "empty" | "ready" | "unavailable";
  history: {
    activePatients: number;
    averageRating: number | null;
    completedSessions: number;
  };
  kpis: {
    activePatients: TherapistDashboardKpi;
    monthlyNetRevenueCents: TherapistDashboardKpi;
    monthlySessions: TherapistDashboardKpi;
    profileViews: TherapistDashboardKpi;
  };
  recentReviews: Array<{
    comment: string;
    id: string;
    patientInitial: string;
    patientName: string;
    publishedAt: string;
    rating: number;
  }>;
  recommendedActions: Array<{
    body: string;
    href: string;
    id: string;
    title: string;
  }>;
  therapist: {
    avatarUrl: string | null;
    name: string;
    plan: TherapistPlan;
    profileCompleteness: number;
    profileId: string;
  };
  today: {
    newConnections: number;
    pendingPayments: number;
    pendingReviewReplies: number;
    reservedMinutesToday: number;
    rescheduleRequests: number;
    sessionsToday: number;
  };
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  upcomingSessions: Array<{
    bookingId: string;
    patientAvatarUrl: string | null;
    patientName: string;
    serviceTitle: string;
    startsAt: string;
    timezone: string;
  }>;
  upcomingSessionsState: TherapistDashboardDataState;
  week: {
    attendanceRate: number;
    days: Array<{
      cancelled: number;
      completed: number;
      date: string;
      label: string;
      scheduled: number;
    }>;
    rangeLabel: string;
    state: TherapistDashboardDataState;
  };
};

export type TherapistDashboardQueryInput = {
  accessToken: string;
  avatarUrl: string | null;
  name: string;
  plan: TherapistPlan;
  profileCompleteness: number;
  profileId: string;
};
