export const moodKeys = [
  "calm",
  "anxious",
  "sad",
  "confused",
  "inspired",
  "hopeful",
] as const;

export type MoodKey = (typeof moodKeys)[number];

export type PatientOverview = {
  activitySummary: PatientActivitySummary;
  favoriteProfessionals: PatientFavoriteProfessional[];
  latestMoodCheckin: PatientMoodCheckin | null;
  moodOptions: MoodOption[];
  patient: PatientOverviewPatient;
  pendingReview: PendingPatientReview | null;
  source: "demo" | "supabase";
  supportTickets: PatientSupportTicket[];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  upcomingAppointments: PatientAppointment[];
};

export type PatientOverviewPatient = {
  avatarUrl: string | null;
  id: string;
  name: string;
  patientProfileId: string;
};

export type PatientActivitySummary = {
  favoritesCount: number;
  lastActivityLabel: string | null;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
};

export type PatientAppointment = {
  endsAt: string;
  id: string;
  meetingUrl: string | null;
  professional: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  serviceLabel: string;
  startsAt: string;
  status: "confirmed" | "live";
  therapyLabel: string;
  timezone: string;
};

export type PatientFavoriteProfessional = {
  averageRating: number | null;
  avatarUrl: string | null;
  id: string;
  name: string;
  reviewCount: number;
  summary: string | null;
  specialty: string | null;
  techniques: string[];
};

export type PendingPatientReview = {
  appointmentId: string;
  confirmationState:
    | "awaiting_both"
    | "awaiting_patient"
    | "awaiting_therapist"
    | "blocked_for_review"
    | "completed"
    | "next_batch"
    | "safety_period";
  endsAt: string;
  professional: {
    avatarUrl: string | null;
    id: string;
    name: string;
  };
  serviceLabel: string;
  startsAt: string;
  therapyLabel: string;
  timezone: string;
};

export type MoodOption = {
  key: MoodKey;
  label: string;
};

export type PatientMoodCheckin = {
  checkedOn: string;
  mood: MoodKey;
};

export type PatientSupportTicket = {
  createdAt: string;
  description: string | null;
  id: string;
  resolutionSummary: string | null;
  status: "in_review" | "resolved" | "open";
  subject: string;
};

export type PatientOverviewQueryResult =
  | { data: PatientOverview; error: null }
  | { data: null; error: "not_found" | "unavailable" };
