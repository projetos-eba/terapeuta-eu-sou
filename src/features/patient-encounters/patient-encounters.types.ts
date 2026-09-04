import type { BookingPrimaryAction } from "@/features/bookings/booking.types";

export type PatientEncountersPageData = {
  favoriteTherapistsCount: number;
  historyEncounters: PatientEncounter[];
  historyPagination: PatientEncountersPagination;
  metrics: PatientEncounterMetrics;
  nextEncounter: PatientEncounter | null;
  patient: PatientEncountersPatient;
  pendingFeedbackSessions: PatientPendingFeedbackSession[];
  recentJourneyTopics: string[];
  source: "demo" | "supabase";
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  upcomingEncounters: PatientEncounter[];
};

export type PatientEncountersPagination = {
  hasNext: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PatientPendingFeedbackSession = {
  bookingId: string;
  confirmationState:
    | "awaiting_both"
    | "awaiting_patient"
    | "awaiting_therapist"
    | "blocked_for_review"
    | "completed"
    | "next_batch"
    | "processing_payment"
    | "safety_period";
  endsAt: string;
  serviceLabel: string;
  startsAt: string;
  therapist: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  therapyLabel: string;
  timezone: string;
};

export type PatientEncountersPatient = {
  avatarUrl: string | null;
  id: string;
  name: string;
  patientProfileId: string;
};

export type PatientEncounterMetrics = {
  activeCount: number;
  completedCount: number;
  favoriteTherapistsCount: number;
};

export type PatientEncounter = {
  actionHint?: string;
  approachLabel: string;
  dateLabel: string;
  endsAt: string;
  id: string;
  meetingUrl: string | null;
  paymentStatus: string | null;
  primaryAction: BookingPrimaryAction;
  rescheduleStatus: string | null;
  scheduleLabel: string;
  serviceLabel: string;
  startsAt: string;
  status: PatientEncounterStatus;
  statusLabel: string;
  summaryId: string | null;
  therapist: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  therapyLabel: string;
  timezone: string;
};

export type PatientEncounterStatus =
  | "live"
  | "confirmed"
  | "pending_payment"
  | "payment_incomplete"
  | "awaiting_confirmation"
  | "reschedule_requested"
  | "completed"
  | "cancelled";

export type PatientEncountersQueryResult =
  | { data: PatientEncountersPageData; error: null }
  | { data: null; error: "not_found" | "unavailable" };
