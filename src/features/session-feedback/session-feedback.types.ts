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
  dueAt: string;
  outcome: SessionFeedbackOutcome;
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
  attendance?: SessionFeedbackAttendance;
  confirmation: SessionFeedbackConfirmation | null;
  feedback: SessionFeedbackRecord | null;
  reason?: string;
  status: SessionFeedbackServerStatus;
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
