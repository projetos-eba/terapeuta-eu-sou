import type {
  BookingStatus,
  SessionFinancialStatus,
} from "@/domain/tes";

export type BookingDetailPerspective = "patient" | "therapist" | "admin";

export type BookingDetailStatus = BookingStatus | "live";

export type BookingDetailPageData = {
  booking: {
    canJoin: boolean;
    dateLabel: string;
    durationLabel: string;
    endsAt: string;
    id: string;
    minutesUntilStart: number | null;
    paymentStatus: SessionFinancialStatus | null;
    startsAt: string;
    status: BookingDetailStatus;
    statusLabel: string;
    timeRangeLabel: string;
    timezone: string;
  };
  cancellationPolicy: {
    freeUntilHours: number;
    lateCancelFeePercent: number;
    noShowFeePercent: number;
  };
  intake: {
    focusArea: string;
    sharedNote: string;
    therapyGoal: string;
    visibility: "patient_therapist" | "private_patient" | "support";
  };
  journey: {
    completedEncountersCount: number;
    lastExploredTopic: string;
    startedAtLabel: string;
    therapistName: string;
  };
  onlineSession: {
    joinRecommendation: string;
    meetingUrl: string | null;
    provider: "zoom" | "google_meet" | "external";
    securityNote: string;
  };
  patient: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  receipt: {
    amountCents: number | null;
    currency: string;
    paidAt: string | null;
    receiptUrl: string | null;
  };
  service: {
    id: string;
    objective: string;
    therapyName: string;
    therapySlug: string;
    title: string;
  };
  therapist: {
    avatarUrl: string | null;
    id: string;
    isOnline: boolean;
    name: string;
    profileHref: string;
    ratingAverage: number | null;
    reviewsCount: number;
    roleLabel: string;
  };
};

export type BookingDetailQueryInput = {
  accessToken: string | null;
  bookingId: string;
  profileId: string;
};

export type BookingDetailQueryResult =
  | { data: BookingDetailPageData; error: null }
  | { data: null; error: "not_found" | "unavailable" };
