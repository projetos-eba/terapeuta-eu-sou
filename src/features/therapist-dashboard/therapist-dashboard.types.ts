import type { TherapistPlan } from "@/domain/tes";

export type TherapistDashboardTrend = {
  direction: "down" | "flat" | "up";
  percent: number | null;
};

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
    observations: string[];
    suggestions: string[];
  };
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
  }>;
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

export type AuraRecommendationRow = {
  body: string;
  context: unknown;
  id: string;
  source_rule_key: string;
  title: string;
};
