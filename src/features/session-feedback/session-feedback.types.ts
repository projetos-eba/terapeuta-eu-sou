export type SessionFeedbackOutcome = "completed" | "not_performed";

export type SessionFeedbackReason =
  | "patient_absent"
  | "therapist_absent"
  | "internet_problem"
  | "audio_video_problem"
  | "rescheduled"
  | "late_cancellation"
  | "other";

export type SessionFeedbackStatus =
  | "loading"
  | "unavailable"
  | "before_session"
  | "waiting_for_participants"
  | "attendance_pending"
  | "eligible"
  | "incident_only"
  | "sent"
  | "error";

export type SessionConfirmationState =
  | "awaiting_both"
  | "awaiting_patient"
  | "awaiting_therapist"
  | "blocked_for_review"
  | "completed"
  | "next_batch"
  | "safety_period";

export type SessionFeedbackServerStatus = Exclude<
  SessionFeedbackStatus,
  "loading" | "sent" | "error"
>;

export type SessionFeedbackAttendance = {
  bothJoined: boolean;
  patientJoined: boolean;
  sessionClosed: boolean;
  sessionEndedAt: string | null;
  sessionEndsAt: string | null;
  sessionStartedAt: string | null;
  therapistJoined: boolean;
};

export type SessionFeedbackConfirmation = {
  confirmedAt: string;
  createdAt?: string;
  dueAt: string;
  outcome: SessionFeedbackOutcome;
  policyVersionId?: string;
  source: "manual" | "automatic";
};

export type SessionFeedbackRecord = {
  authorRole: "patient" | "therapist";
  comment: string;
  createdAt: string;
  id: string;
  notPerformedReason: SessionFeedbackReason | null;
  outcome: SessionFeedbackOutcome;
  rating: number | null;
};

export type SessionFeedbackReadPayload = {
  actorConfirmation?: SessionFeedbackConfirmation | null;
  actorRole?: "patient" | "therapist";
  attendance?: SessionFeedbackAttendance;
  confirmation: SessionFeedbackConfirmation | null;
  confirmationState?: SessionConfirmationState;
  counterpartConfirmation?: SessionFeedbackConfirmation | null;
  feedback: SessionFeedbackRecord | null;
  financial?: {
    eligibleAt: string | null;
    nextBatchAt: string | null;
    serviceConfirmedAt: string | null;
    serviceStatus: string;
    transferBlockedReason: string | null;
    transferStatus: string;
  };
  patientConfirmation?: SessionFeedbackConfirmation | null;
  policy?: {
    patientAutoConfirmationDays: number;
    therapistAutoConfirmationDays: number;
    transferSafetyHours: number;
  };
  reason?: string;
  status: SessionFeedbackServerStatus;
  therapistConfirmation?: SessionFeedbackConfirmation | null;
};

export type PatientTherapistReview = {
  comment: string;
  createdAt: string;
  id: string;
  publishedAt: string | null;
  rating: number;
  status: "hidden" | "published";
  updatedAt: string;
};

export type PatientTherapistReviewReadPayload = {
  eligible: boolean;
  review: PatientTherapistReview | null;
  therapistProfileId: string;
};

export const SESSION_FEEDBACK_REASONS: Array<{
  value: SessionFeedbackReason;
  label: string;
}> = [
  { label: "O paciente não apareceu", value: "patient_absent" },
  { label: "O terapeuta não apareceu", value: "therapist_absent" },
  { label: "Problema de internet", value: "internet_problem" },
  { label: "Problema técnico de áudio ou vídeo", value: "audio_video_problem" },
  { label: "Sessão remarcada", value: "rescheduled" },
  { label: "Cancelamento em cima da hora", value: "late_cancellation" },
  { label: "Outro motivo", value: "other" },
];

export function getSessionFeedbackReasonLabel(
  reason: SessionFeedbackReason | null | undefined,
) {
  return SESSION_FEEDBACK_REASONS.find((item) => item.value === reason)?.label ?? "Não informado";
}
